using Microsoft.Extensions.Logging;

namespace DeployBox.Orchestrator.Services;

public interface INginxConfigService
{
    Task<string> GenerateConfigAsync(string subdomain, string containerIp, int containerPort);
    Task CreateAndEnableConfigAsync(string subdomain, string containerIp, int containerPort, CancellationToken cancellationToken = default);
    Task ReloadNginxAsync(CancellationToken cancellationToken = default);
}

public class NginxConfigService : INginxConfigService
{
    private readonly ILogger<NginxConfigService> _logger;
    private readonly string _templatePath;
    private readonly string _sitesAvailableDir;
    private readonly string _sitesEnabledDir;

    public NginxConfigService(
        ILogger<NginxConfigService> logger,
        string? templatePath = null,
        string? sitesAvailableDir = null,
        string? sitesEnabledDir = null)
    {
        _logger = logger;
        _templatePath = templatePath ?? Path.Combine(AppContext.BaseDirectory, "Templates", "nginx-site.conf.template");
        
        var isLinux = OperatingSystem.IsLinux();
        var defaultAvailable = isLinux ? "/etc/nginx/sites-available" : Path.Combine(AppContext.BaseDirectory, "nginx", "sites-available");
        var defaultEnabled = isLinux ? "/etc/nginx/sites-enabled" : Path.Combine(AppContext.BaseDirectory, "nginx", "sites-enabled");

        _sitesAvailableDir = sitesAvailableDir ?? defaultAvailable;
        _sitesEnabledDir = sitesEnabledDir ?? defaultEnabled;
    }

    public async Task<string> GenerateConfigAsync(string subdomain, string containerIp, int containerPort)
    {
        var templateFile = _templatePath;
        if (!File.Exists(templateFile))
        {
            var devTemplatePath = Path.Combine(Directory.GetCurrentDirectory(), "Templates", "nginx-site.conf.template");
            if (File.Exists(devTemplatePath))
            {
                templateFile = devTemplatePath;
            }
            else
            {
                throw new FileNotFoundException($"Nginx template file not found: {_templatePath}");
            }
        }

        var content = await File.ReadAllTextAsync(templateFile);
        return content
            .Replace("{{SUBDOMAIN}}", subdomain)
            .Replace("{{CONTAINER_IP}}", containerIp)
            .Replace("{{CONTAINER_PORT}}", containerPort.ToString());
    }

    public async Task CreateAndEnableConfigAsync(string subdomain, string containerIp, int containerPort, CancellationToken cancellationToken = default)
    {
        try
        {
            var configContent = await GenerateConfigAsync(subdomain, containerIp, containerPort);

            try
            {
                if (!Directory.Exists(_sitesAvailableDir))
                {
                    Directory.CreateDirectory(_sitesAvailableDir);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not access the sites-available directory ({Path}), using local fallback.", _sitesAvailableDir);
            }

            try
            {
                if (!Directory.Exists(_sitesEnabledDir))
                {
                    Directory.CreateDirectory(_sitesEnabledDir);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not access the sites-enabled directory ({Path}), using local fallback.", _sitesEnabledDir);
            }

            var availablePath = Path.Combine(Directory.Exists(_sitesAvailableDir) ? _sitesAvailableDir : Path.Combine(AppContext.BaseDirectory, "nginx", "sites-available"), $"{subdomain}.conf");
            var enabledPath = Path.Combine(Directory.Exists(_sitesEnabledDir) ? _sitesEnabledDir : Path.Combine(AppContext.BaseDirectory, "nginx", "sites-enabled"), $"{subdomain}.conf");

            var availableDir = Path.GetDirectoryName(availablePath);
            if (!string.IsNullOrEmpty(availableDir) && !Directory.Exists(availableDir))
            {
                Directory.CreateDirectory(availableDir);
            }

            var enabledDir = Path.GetDirectoryName(enabledPath);
            if (!string.IsNullOrEmpty(enabledDir) && !Directory.Exists(enabledDir))
            {
                Directory.CreateDirectory(enabledDir);
            }

            // 1. Write to sites-available/{subdomain}.conf (overwrite if it exists)
            await File.WriteAllTextAsync(availablePath, configContent, cancellationToken);
            _logger.LogInformation("Nginx config written to sites-available folder: {Path}", availablePath);

            // 2. Create sites-enabled/{subdomain}.conf symlink (ln -s) (overwrite if it exists)
            if (File.Exists(enabledPath) || Directory.Exists(enabledPath))
            {
                try
                {
                    File.Delete(enabledPath);
                }
                catch (Exception delEx)
                {
                    _logger.LogWarning(delEx, "Warning while deleting old symlink/file: {Path}", enabledPath);
                }
            }

            try
            {
                File.CreateSymbolicLink(enabledPath, availablePath);
                _logger.LogInformation("Nginx symlink linked into sites-enabled folder: {Link} -> {Target}", enabledPath, availablePath);
            }
            catch (Exception symlinkEx)
            {
                _logger.LogWarning(symlinkEx, "Permission error/warning while creating symlink. Falling back to file copy.");
                File.Copy(availablePath, enabledPath, overwrite: true);
            }

            // 3. Syntax test (nginx -t) & zero-downtime reload (nginx -s reload)
            await ReloadNginxAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while auto-generating Nginx configuration. Subdomain: {Subdomain}", subdomain);
            throw;
        }
    }

    public async Task ReloadNginxAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            // The nginx serving traffic (gateway-nginx) is a separate
            // container from the orchestrator, which only shares the sites
            // volume with it — running `nginx -t`/`nginx -s reload` directly
            // would test/reload a copy of nginx that (if present at all)
            // isn't the one actually listening on 80/443. Exec into the real
            // container instead, via the docker CLI already required for
            // building/running deployments.
            var gatewayContainer = Environment.GetEnvironmentVariable("GATEWAY_NGINX_CONTAINER") ?? "gateway-nginx";

            // 1. Syntax test: nginx -t
            var testProcessInfo = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "docker",
                ArgumentList = { "exec", gatewayContainer, "nginx", "-t" },
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using (var testProcess = new System.Diagnostics.Process { StartInfo = testProcessInfo })
            {
                testProcess.Start();

                var testStderrTask = testProcess.StandardError.ReadToEndAsync(cancellationToken);
                var testStdoutTask = testProcess.StandardOutput.ReadToEndAsync(cancellationToken);

                await testProcess.WaitForExitAsync(cancellationToken);

                var testStderr = await testStderrTask;
                var testStdout = await testStdoutTask;

                if (testProcess.ExitCode != 0)
                {
                    var errorOutput = string.IsNullOrWhiteSpace(testStderr) ? testStdout : testStderr;
                    _logger.LogError("Nginx syntax test (nginx -t) failed: {Error}", errorOutput);
                    throw new InvalidOperationException($"Nginx syntax test (nginx -t) failed: {errorOutput.Trim()}");
                }

                _logger.LogInformation("Nginx syntax test (nginx -t) validated successfully.");
            }

            // 2. Zero-downtime reload: nginx -s reload
            var reloadProcessInfo = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "docker",
                ArgumentList = { "exec", gatewayContainer, "nginx", "-s", "reload" },
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using (var reloadProcess = new System.Diagnostics.Process { StartInfo = reloadProcessInfo })
            {
                reloadProcess.Start();

                var reloadStderrTask = reloadProcess.StandardError.ReadToEndAsync(cancellationToken);
                await reloadProcess.WaitForExitAsync(cancellationToken);

                var reloadStderr = await reloadStderrTask;

                if (reloadProcess.ExitCode != 0)
                {
                    _logger.LogError("Nginx reload (nginx -s reload) failed: {Error}", reloadStderr);
                    throw new InvalidOperationException($"Nginx reload (nginx -s reload) failed: {reloadStderr.Trim()}");
                }

                _logger.LogInformation("Nginx reloaded without downtime (nginx -s reload).");
            }
        }
        catch (System.ComponentModel.Win32Exception)
        {
            // docker CLI is not installed in PATH (e.g. local dev environment)
            _logger.LogWarning("The docker CLI was not found on the system. (nginx -t / nginx -s reload skipped)");
        }
    }
}
