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
    private readonly string _confDir;

    public NginxConfigService(
        ILogger<NginxConfigService> logger,
        string? templatePath = null,
        string? confDir = null)
    {
        _logger = logger;
        _templatePath = templatePath ?? Path.Combine(AppContext.BaseDirectory, "Templates", "nginx-site.conf.template");

        // gateway-nginx (a separate container) doesn't use the
        // sites-available/sites-enabled symlink convention — its nginx.conf
        // does a flat `include /etc/nginx/conf.d/*.conf`. The orchestrator
        // only shares that directory with it via the /home/gateway/conf.d
        // volume mount (see docker-compose.yml), mounted here at
        // /etc/nginx/conf.d — writing to sites-available/enabled would land
        // in a directory gateway-nginx never reads.
        var isLinux = OperatingSystem.IsLinux();
        var defaultConfDir = isLinux ? "/etc/nginx/conf.d" : Path.Combine(AppContext.BaseDirectory, "nginx", "conf.d");

        _confDir = confDir ?? defaultConfDir;
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

            var confDir = Directory.Exists(_confDir) ? _confDir : Path.Combine(AppContext.BaseDirectory, "nginx", "conf.d");
            if (!Directory.Exists(confDir))
            {
                Directory.CreateDirectory(confDir);
            }

            var configPath = Path.Combine(confDir, $"{subdomain}.conf");

            // gateway-nginx's nginx.conf does `include /etc/nginx/conf.d/*.conf`
            // directly — no sites-available/enabled symlink step needed, a
            // single write here is enough for it to pick this site up.
            await File.WriteAllTextAsync(configPath, configContent, cancellationToken);
            _logger.LogInformation("Nginx config written: {Path}", configPath);

            // Syntax test (nginx -t) & zero-downtime reload (nginx -s reload)
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
