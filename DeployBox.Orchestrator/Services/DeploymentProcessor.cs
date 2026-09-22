using DeployBox.Orchestrator.Models;
using Microsoft.Extensions.Logging;

namespace DeployBox.Orchestrator.Services;

public interface IDeploymentProcessor
{
    Task ProcessDeploymentAsync(DeploymentPayload payload, CancellationToken cancellationToken);
}

public class DeploymentProcessor : IDeploymentProcessor
{
    // How many recent image tags to keep per project (subdomain) — bounds
    // disk usage while still letting a user roll back to one of their last
    // few deployments without a full rebuild.
    private const int KeptImageCount = 5;

    private readonly ILogger<DeploymentProcessor> _logger;
    private readonly IGitService _gitService;
    private readonly IDockerfileGeneratorService _dockerfileGeneratorService;
    private readonly IDockerBuildService _dockerBuildService;
    private readonly IDockerContainerService _dockerContainerService;
    private readonly IDeploymentLogService _logService;
    private readonly IDeploymentStatusService _statusService;
    private readonly INginxConfigService? _nginxConfigService;
    private readonly Microsoft.Extensions.Configuration.IConfiguration? _configuration;

    public DeploymentProcessor(
        ILogger<DeploymentProcessor> logger,
        IGitService gitService,
        IDockerfileGeneratorService dockerfileGeneratorService,
        IDockerBuildService dockerBuildService,
        IDockerContainerService dockerContainerService,
        IDeploymentLogService logService,
        IDeploymentStatusService statusService,
        INginxConfigService? nginxConfigService = null,
        Microsoft.Extensions.Configuration.IConfiguration? configuration = null)
    {
        _logger = logger;
        _gitService = gitService;
        _dockerfileGeneratorService = dockerfileGeneratorService;
        _dockerBuildService = dockerBuildService;
        _dockerContainerService = dockerContainerService;
        _logService = logService;
        _statusService = statusService;
        _nginxConfigService = nginxConfigService;
        _configuration = configuration;
    }

    public async Task ProcessDeploymentAsync(DeploymentPayload payload, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Deploy process started. DeploymentId: {Id}", payload.DeploymentId);

        // Every deploy clones the repo into a unique temp directory
        // (Path.GetTempPath()/deploybox/{deploymentId}) that was previously
        // never cleaned up on any path — success, failure, or timeout. Left
        // unchecked, every single deploy permanently consumes disk with a
        // full repo clone, eventually exhausting the host. Track it here so
        // the outer finally can always remove it regardless of outcome.
        var tempPath = Path.Combine(Path.GetTempPath(), "deploybox", payload.DeploymentId);

        try
        {
            if (await _statusService.IsSupersededAsync(payload.ProjectId, payload.DeploymentId))
            {
                _logger.LogInformation("Deployment {Id} was cancelled because it was superseded by a newer push/deploy.", payload.DeploymentId);
                await _logService.SendLogAsync(payload.DeploymentId, "This deploy was cancelled because a newer push arrived.", LogType.Error);
                await _statusService.UpdateStatusInDbAsync(payload.DeploymentId, DeploymentStatus.Cancelled, errorMessage: "Cancelled because a newer push arrived.", finishedAt: DateTime.UtcNow);
                return;
            }

            await _logService.SendLogAsync(payload.DeploymentId, "Deploy process started...");

            // A rollback reuses a previously built image (still on disk
            // within the recent-image retention window — see
            // PruneOldImagesAsync's keepCount) instead of re-cloning and
            // rebuilding from source. This makes "go back to what was
            // running a few deploys ago" fast and independent of whether the
            // source repository/branch has since changed.
            var isRollback = string.Equals(payload.TriggerType, "rollback", StringComparison.OrdinalIgnoreCase);
            string imageTag;

            if (isRollback)
            {
                if (string.IsNullOrWhiteSpace(payload.ImageTag))
                {
                    throw new InvalidOperationException("Rollback deployment is missing the target image tag.");
                }

                imageTag = payload.ImageTag;
                await _logService.SendLogAsync(payload.DeploymentId, $"Rolling back to existing image {imageTag} (skipping clone/build)...");

                var imageStillExists = await _dockerBuildService.ImageExistsAsync(imageTag, cancellationToken);
                if (!imageStillExists)
                {
                    throw new InvalidOperationException(
                        $"Cannot roll back: image {imageTag} is no longer available (it may have been pruned). " +
                        "Only recent deployments can be rolled back to.");
                }
            }
            else
            {
                // 1. Git Clone step
                await _statusService.UpdateStatusInDbAsync(payload.DeploymentId, DeploymentStatus.Cloning, startedAt: DateTime.UtcNow);
                await _logService.SendLogAsync(payload.DeploymentId, "Downloading / cloning repository...");

                var repoUrl = payload.RepoFullName.StartsWith("http", StringComparison.OrdinalIgnoreCase) || Directory.Exists(payload.RepoFullName)
                    ? payload.RepoFullName
                    : $"https://github.com/{payload.RepoFullName}.git";

                await _gitService.CloneRepositoryAsync(repoUrl, payload.Branch, tempPath, cancellationToken);
                await _logService.SendLogAsync(payload.DeploymentId, "Repository cloned successfully.");

                // 1.5 .env file creation step
                if (!string.IsNullOrWhiteSpace(payload.EnvVars))
                {
                    var envPath = Path.Combine(tempPath, ".env");
                    await File.WriteAllTextAsync(envPath, payload.EnvVars, cancellationToken);
                    await _logService.SendLogAsync(payload.DeploymentId, ".env file created and written to the project root.");
                }

                // 1.6 Auto-generate a Dockerfile if the repo doesn't already have one,
                // so users don't need to know Docker to deploy (Node.js, Python,
                // .NET, and static HTML projects are auto-detected).
                var dockerfileGenerated = _dockerfileGeneratorService.EnsureDockerfile(tempPath, payload.ContainerPort);
                if (dockerfileGenerated)
                {
                    await _logService.SendLogAsync(
                        payload.DeploymentId,
                        "No Dockerfile found — generated one automatically based on your project type.");
                }

                // 2. Docker image build step
                if (await _statusService.IsSupersededAsync(payload.ProjectId, payload.DeploymentId))
                {
                    _logger.LogInformation("Deployment {Id} was cancelled because a new push arrived before the build.", payload.DeploymentId);
                    await _logService.SendLogAsync(payload.DeploymentId, "This deploy was cancelled because a newer push arrived.", LogType.Error);
                    await _statusService.UpdateStatusInDbAsync(payload.DeploymentId, DeploymentStatus.Cancelled, errorMessage: "Cancelled because a newer push arrived.", finishedAt: DateTime.UtcNow);
                    return;
                }

                await _statusService.UpdateStatusInDbAsync(payload.DeploymentId, DeploymentStatus.Building);
                await _logService.SendLogAsync(payload.DeploymentId, "Building Docker image...");

                var commitTag = !string.IsNullOrWhiteSpace(payload.CommitSha) && payload.CommitSha.Length >= 7
                    ? payload.CommitSha[..7]
                    : payload.DeploymentId[..8];

                imageTag = string.IsNullOrWhiteSpace(payload.ImageTag) || payload.ImageTag == "latest"
                    ? $"deploybox/{payload.Subdomain}:{commitTag}"
                    : payload.ImageTag;

                await _dockerBuildService.BuildImageAsync(
                    tempPath,
                    imageTag,
                    msg => _logService.SendLogAsync(payload.DeploymentId, msg),
                    cancellationToken
                );
                await _logService.SendLogAsync(payload.DeploymentId, "Docker image built successfully.");
            }

            // 3. Container deploy step
            if (await _statusService.IsSupersededAsync(payload.ProjectId, payload.DeploymentId))
            {
                _logger.LogInformation("Deployment {Id} was cancelled because a new push arrived before the container step.", payload.DeploymentId);
                await _logService.SendLogAsync(payload.DeploymentId, "This deploy was cancelled because a newer push arrived.", LogType.Error);
                await _statusService.UpdateStatusInDbAsync(payload.DeploymentId, DeploymentStatus.Cancelled, errorMessage: "Cancelled because a newer push arrived.", finishedAt: DateTime.UtcNow);
                return;
            }

            await _statusService.UpdateStatusInDbAsync(payload.DeploymentId, DeploymentStatus.Deployed);
            await _logService.SendLogAsync(payload.DeploymentId, "Starting container...");
            var containerName = $"deploybox-{payload.Subdomain}";

            var (hostPort, containerIp, actualContainerPort) = await _dockerContainerService.DeployContainerAsync(imageTag, containerName, payload.ContainerPort, payload.EnvVars, cancellationToken);
            await _logService.SendLogAsync(payload.DeploymentId, $"Container started successfully (Host Port: {hostPort}).");

            // Stream runtime logs in the background for a limited time after the container comes up.
            // Not awaited so it doesn't block the Worker; the deploy job continues without waiting for this process.
            _ = StreamRuntimeLogsInBackgroundAsync(payload.DeploymentId, containerName, cancellationToken);

            // Wait for the app inside the container to actually accept
            // connections before pointing nginx at it. Without this, nginx
            // was being reloaded immediately after `docker start` returned —
            // which only means the process launched, not that it's listening
            // yet (npm installs, DB connection warmup, JIT/cold starts can
            // easily take longer than container startup) — producing a
            // window of 502s for real users right after "Successfully
            // published!" was reported.
            //
            // This connects to the container's own IP on the shared Docker
            // network, not the published host port — the orchestrator runs
            // inside its own container, so a host-published port is not
            // reachable via 127.0.0.1 from here.
            await _logService.SendLogAsync(payload.DeploymentId, "Waiting for the app to become ready...");
            if (string.IsNullOrEmpty(containerIp))
            {
                throw new InvalidOperationException("Could not determine the deployed container's network address.");
            }
            var isReady = await WaitForContainerReadyAsync(containerIp, actualContainerPort, cancellationToken);
            if (!isReady)
            {
                throw new TimeoutException(
                    $"The application did not start listening on port {actualContainerPort} within the readiness window. " +
                    "Check that it binds to 0.0.0.0 (not just localhost) and starts within a reasonable time.");
            }
            await _logService.SendLogAsync(payload.DeploymentId, "App is up and accepting connections.");

            if (_nginxConfigService != null)
            {
                await _nginxConfigService.CreateAndEnableConfigAsync(payload.Subdomain, containerIp, actualContainerPort, cancellationToken);
                await _logService.SendLogAsync(payload.DeploymentId, $"Nginx configuration written to /etc/nginx/conf.d/{payload.Subdomain}.conf.");
            }

            var appDomain = _configuration?["AppDomain"]
                ?? Environment.GetEnvironmentVariable("APP_DOMAIN")
                ?? (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development" ? "localhost:3000" : "emreceyhan.xyz");

            var isDev = appDomain.Contains("localhost") || Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") == "Development";
            var protocol = appDomain.StartsWith("http://") || appDomain.StartsWith("https://") ? "" : (isDev ? "http://" : "https://");

            string liveUrl;
            if (isDev && hostPort > 0)
            {
                liveUrl = $"http://localhost:{hostPort}";
            }
            else
            {
                liveUrl = $"{protocol}{payload.Subdomain}.{appDomain}";
            }

            await _logService.SendLogAsync(payload.DeploymentId, $"Successfully published! URL: {liveUrl}", LogType.Success);
            await _statusService.UpdateStatusInDbAsync(payload.DeploymentId, DeploymentStatus.Success, imageTag: imageTag, hostPort: hostPort > 0 ? hostPort : null, finishedAt: DateTime.UtcNow);

            // Now that the new container is confirmed running, prune old
            // image tags for this project down to a small rolling window —
            // otherwise each redeploy leaves the prior commit's image layers
            // on disk forever. Keeping the last few (not just the newest)
            // is what makes "rollback to a recent deployment" possible
            // without a full rebuild.
            await _dockerBuildService.PruneOldImagesAsync(payload.Subdomain, imageTag, KeptImageCount, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred during deploy: {Id}", payload.DeploymentId);
            var isTimeout = cancellationToken.IsCancellationRequested || ex is OperationCanceledException || ex is TaskCanceledException;
            var errorMessage = FormatUserFriendlyErrorMessage(ex, isTimeout);

            await _logService.SendLogAsync(payload.DeploymentId, $"Error: {errorMessage}", LogType.Error);
            await _statusService.UpdateStatusInDbAsync(payload.DeploymentId, DeploymentStatus.Failed, errorMessage: errorMessage, finishedAt: DateTime.UtcNow);
        }
        finally
        {
            // Clean up the cloned repo directory regardless of outcome —
            // success, failure, cancellation, or timeout all leave a full
            // repo clone behind otherwise, since this ID is unique per
            // deployment and nothing else ever revisits or clears it.
            try
            {
                if (Directory.Exists(tempPath))
                {
                    _gitService.DeleteDirectoryRecursive(tempPath);
                }
            }
            catch (Exception cleanupEx)
            {
                _logger.LogWarning(cleanupEx, "Failed to clean up temp clone directory for deployment {Id}: {Path}", payload.DeploymentId, tempPath);
            }
        }
    }

    // A plain TCP connect is not a reliable readiness signal under Docker
    // Desktop/WSL2's port-forwarding (docker-proxy/vpnkit): the host accepts
    // and completes the TCP handshake for a published port as soon as the
    // container exists, even if nothing inside the container is listening —
    // confirmed by reproducing it directly (`curl` gets "Empty reply from
    // server" against a container whose only process is `sleep infinity`).
    // An actual HTTP request is required to prove something in the container
    // is really receiving and responding to traffic; any response at all
    // (even a 404/500) counts as "up," since we don't know the app's routes.
    private static async Task<bool> WaitForContainerReadyAsync(string containerIp, int containerPort, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(containerIp) || containerPort <= 0) return false;

        using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        var deadline = DateTime.UtcNow.AddSeconds(30);
        var delay = TimeSpan.FromMilliseconds(300);

        while (DateTime.UtcNow < deadline)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                using var response = await httpClient.GetAsync($"http://{containerIp}:{containerPort}/", cancellationToken);
                // Any HTTP response — including 404/500 — proves the app is
                // actually accepting and answering requests, which is what
                // matters for cutting nginx over to it.
                return true;
            }
            catch
            {
                // Connection refused, reset, or timed out while the app is
                // still starting — expected, keep polling until the deadline.
            }

            await Task.Delay(delay, cancellationToken);
            delay = TimeSpan.FromMilliseconds(Math.Min(delay.TotalMilliseconds * 1.5, 2000));
        }

        return false;
    }

    private async Task StreamRuntimeLogsInBackgroundAsync(string deploymentId, string containerName, CancellationToken parentToken)
    {
        // We limit runtime log following to a fixed window, independent of the deploy job's timeout.
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(parentToken);
        cts.CancelAfter(TimeSpan.FromMinutes(5));

        try
        {
            await _dockerContainerService.StreamContainerLogsAsync(
                containerName,
                line => _logService.SendLogAsync(deploymentId, line),
                cts.Token);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Unexpected error during runtime log streaming. Container: {ContainerName}", containerName);
        }
    }

    private static string FormatUserFriendlyErrorMessage(Exception ex, bool isTimeout)
    {
        if (isTimeout)
        {
            return "Deploy operation timed out (Timeout - 10 minutes). The process took too long and was stopped for safety reasons.";
        }

        if (ex is FileNotFoundException fnfEx && fnfEx.Message.Contains("Dockerfile"))
        {
            return "Dockerfile not found: Make sure your project's root directory contains a valid 'Dockerfile'.";
        }

        if (ex is InvalidOperationException && ex.Message.Contains("auto-generate a Dockerfile"))
        {
            return ex.Message;
        }

        if (ex is LibGit2Sharp.NotFoundException || ex is LibGit2Sharp.NameConflictException || ex.Message.Contains("Host not found") || ex.Message.Contains("404"))
        {
            return $"Could not clone Git repository: Invalid repository address or access permission. ({ex.Message})";
        }

        if (ex.Message.Contains("npipe") || ex.Message.Contains("docker.sock") || ex.Message.Contains("Docker daemon"))
        {
            return "Could not connect to the Docker Engine service: Please check that the Docker service is active and running.";
        }

        return ex.Message;
    }
}