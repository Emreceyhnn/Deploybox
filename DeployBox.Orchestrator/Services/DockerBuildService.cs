using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace DeployBox.Orchestrator.Services;

public interface IDockerBuildService
{
    Task BuildImageAsync(string sourcePath, string imageTag, Func<string, Task>? onLogMessage, CancellationToken cancelToken);

    /// <summary>
    /// Removes old images for this project (matched by the
    /// "deploybox/{subdomain}" repository prefix), keeping only the
    /// <paramref name="keepCount"/> most recently built tags (the tag just
    /// built is always kept as one of them). Without this, every single
    /// deploy would leave its predecessor's image layers on disk forever —
    /// an unbounded disk leak on any host that sees regular deploys. Keeping
    /// a small window (rather than only the latest) is what makes rollback
    /// to a recent deployment possible without a full rebuild.
    /// </summary>
    Task PruneOldImagesAsync(string subdomain, string keepImageTag, int keepCount, CancellationToken cancelToken);

    /// <summary>
    /// Checks whether an image tag still exists locally — used before a
    /// rollback to give a clear error instead of a confusing container-start
    /// failure if the target image has since been pruned.
    /// </summary>
    Task<bool> ImageExistsAsync(string imageTag, CancellationToken cancelToken);
}

// Builds via the `docker build` CLI (with BuildKit enabled) rather than the
// Docker Engine API directly: Docker.DotNet's ImageBuildParameters does not
// support the BuildKit session/grpc protocol, so any Dockerfile using
// BuildKit-only syntax (RUN --mount=type=cache, heredocs, etc. — extremely
// common in real-world Node/Python Dockerfiles) fails against the legacy
// builder with "the --mount option requires BuildKit". Shelling out to the
// `docker` CLI (already required on the host/container running this
// orchestrator, since it also runs `docker run` via the Engine API) gets full
// BuildKit support for free.
public class DockerBuildService : IDockerBuildService
{
    private readonly ILogger<DockerBuildService> _logger;

    public DockerBuildService(ILogger<DockerBuildService> logger)
    {
        _logger = logger;
    }

    public async Task BuildImageAsync(string sourcePath, string imageTag, Func<string, Task>? onLogMessage, CancellationToken cancelToken)
    {
        var dockerfilePath = Path.Combine(sourcePath, "Dockerfile");
        if (!File.Exists(dockerfilePath))
        {
            throw new FileNotFoundException($"Dockerfile not found in directory '{sourcePath}'.");
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = "docker",
            ArgumentList = { "build", "--progress=plain", "-t", imageTag, "." },
            WorkingDirectory = sourcePath,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        startInfo.Environment["DOCKER_BUILDKIT"] = "1";

        using var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };

        var errorLines = new List<string>();

        process.OutputDataReceived += (_, e) =>
        {
            if (string.IsNullOrEmpty(e.Data)) return;
            _logger.LogInformation("Docker Build: {Message}", e.Data);
            onLogMessage?.Invoke(e.Data).GetAwaiter().GetResult();
        };

        process.ErrorDataReceived += (_, e) =>
        {
            if (string.IsNullOrEmpty(e.Data)) return;
            // `docker build --progress=plain` writes its normal step-by-step
            // progress to stderr, not just fatal errors, so this is still
            // routed to the log stream (not treated as a failure by itself).
            errorLines.Add(e.Data);
            _logger.LogInformation("Docker Build: {Message}", e.Data);
            onLogMessage?.Invoke(e.Data).GetAwaiter().GetResult();
        };

        if (!process.Start())
        {
            throw new InvalidOperationException("Failed to start the `docker build` process.");
        }

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        await process.WaitForExitAsync(cancelToken);

        if (process.ExitCode != 0)
        {
            var summary = SummarizeFailure(errorLines);
            throw new Exception($"Docker build error (exit code {process.ExitCode}): {summary}");
        }
    }

    public async Task<bool> ImageExistsAsync(string imageTag, CancellationToken cancelToken)
    {
        var inspectInfo = new ProcessStartInfo
        {
            FileName = "docker",
            ArgumentList = { "image", "inspect", imageTag },
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        using var process = Process.Start(inspectInfo);
        if (process == null) return false;

        await process.WaitForExitAsync(cancelToken);
        return process.ExitCode == 0;
    }

    public async Task PruneOldImagesAsync(string subdomain, string keepImageTag, int keepCount, CancellationToken cancelToken)
    {
        try
        {
            // `-t {{.CreatedAt}}` sorts newest-first so "keep the N most
            // recent" is a straightforward Take/Skip over this list, rather
            // than trusting docker image ls's default ordering.
            var listInfo = new ProcessStartInfo
            {
                FileName = "docker",
                ArgumentList =
                {
                    "image", "ls",
                    "--filter", $"reference=deploybox/{subdomain}",
                    "--format", "{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}",
                },
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };

            using var listProcess = Process.Start(listInfo);
            if (listProcess == null) return;

            var output = await listProcess.StandardOutput.ReadToEndAsync(cancelToken);
            await listProcess.WaitForExitAsync(cancelToken);

            var allTags = output
                .Split('\n', StringSplitOptions.RemoveEmptyEntries)
                .Select(line =>
                {
                    var parts = line.Split('\t', 2);
                    return parts.Length == 2 ? (createdAt: parts[0].Trim(), tag: parts[1].Trim()) : default;
                })
                .Where(entry => !string.IsNullOrEmpty(entry.tag))
                // docker's CreatedAt format ("2024-01-15 10:30:00 +0000 UTC")
                // sorts correctly as a plain string since it's already
                // year-first/zero-padded — no need to parse it as a DateTime.
                .OrderByDescending(entry => entry.createdAt)
                .Select(entry => entry.tag)
                .ToList();

            // Always keep the tag just built even if, for some reason, it
            // didn't sort as the newest (e.g. clock skew) — then keep the
            // next most recent ones up to keepCount total.
            var keepSet = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { keepImageTag };
            foreach (var tag in allTags)
            {
                if (keepSet.Count >= keepCount) break;
                keepSet.Add(tag);
            }

            var staleTags = allTags.Where(tag => !keepSet.Contains(tag)).ToList();

            foreach (var tag in staleTags)
            {
                var rmInfo = new ProcessStartInfo
                {
                    FileName = "docker",
                    ArgumentList = { "rmi", "-f", tag },
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };

                using var rmProcess = Process.Start(rmInfo);
                if (rmProcess != null)
                {
                    await rmProcess.WaitForExitAsync(cancelToken);
                    if (rmProcess.ExitCode == 0)
                    {
                        _logger.LogInformation("Pruned stale image {Tag} for subdomain {Subdomain}.", tag, subdomain);
                    }
                    else
                    {
                        // Non-fatal: an image still referenced by another running
                        // container (e.g. a rollback target) will fail to remove —
                        // that's expected and safe to skip.
                        _logger.LogWarning("Could not prune image {Tag} for subdomain {Subdomain} (exit code {Code}).", tag, subdomain, rmProcess.ExitCode);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            // Image pruning is best-effort cleanup, never a reason to fail a
            // deployment that otherwise succeeded.
            _logger.LogWarning(ex, "Error while pruning old images for subdomain {Subdomain}.", subdomain);
        }
    }

    // `docker build` failures bury the actual cause under boilerplate: for
    // `npm ci`/`pip install`/etc. failures specifically, the last few lines
    // are almost always generic "Usage: ..." / "Run 'x help y'" text from the
    // failing tool, not the reason it failed. Prefer lines that look like the
    // real error signal (npm's "npm error <detail>" lines minus its usage
    // block, explicit "ERROR:"/"error:" lines) over a blind tail of the output.
    private static string SummarizeFailure(List<string> errorLines)
    {
        bool IsNoise(string line)
        {
            var trimmed = line.TrimStart();
            return trimmed.StartsWith("npm notice", StringComparison.OrdinalIgnoreCase)
                || trimmed.Equals("npm error", StringComparison.OrdinalIgnoreCase)
                || trimmed.StartsWith("npm error Usage", StringComparison.OrdinalIgnoreCase)
                || trimmed.StartsWith("npm error Options", StringComparison.OrdinalIgnoreCase)
                || trimmed.StartsWith("npm error [", StringComparison.OrdinalIgnoreCase)
                || trimmed.StartsWith("npm error aliases", StringComparison.OrdinalIgnoreCase)
                || trimmed.StartsWith("npm error Run \"npm help", StringComparison.OrdinalIgnoreCase)
                || trimmed.StartsWith("npm error A complete log", StringComparison.OrdinalIgnoreCase);
        }

        var signal = errorLines
            .Where(l => !string.IsNullOrWhiteSpace(l) && !IsNoise(l))
            .Where(l =>
                l.Contains("npm error", StringComparison.OrdinalIgnoreCase) ||
                l.Contains("ERROR:", StringComparison.Ordinal) ||
                l.Contains("error:", StringComparison.OrdinalIgnoreCase))
            .TakeLast(8)
            .ToList();

        var chosen = signal.Count > 0 ? signal : errorLines.TakeLast(5).ToList();
        return string.Join(" | ", chosen);
    }
}
