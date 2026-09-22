using LibGit2Sharp;
using Microsoft.Extensions.Logging;

namespace DeployBox.Orchestrator.Services;

public interface IGitService
{
    Task CloneRepositoryAsync(string url, string branch, string localPath, CancellationToken cancelToken);

    /// <summary>
    /// Deletes a directory tree that may contain read-only files (as git
    /// packs/objects always are) — plain Directory.Delete throws
    /// UnauthorizedAccessException on those without clearing the attribute
    /// first. Exposed publicly so callers other than this service (e.g. the
    /// post-deploy cleanup of the cloned repo directory) can safely remove
    /// the same kind of tree.
    /// </summary>
    void DeleteDirectoryRecursive(string path);
}

public class GitService : IGitService
{
    private readonly ILogger<GitService> _logger;

    public GitService(ILogger<GitService> logger)
    {
        _logger = logger;
    }

    public void DeleteDirectoryRecursive(string path)
    {
        var dirInfo = new DirectoryInfo(path);
        foreach (var file in dirInfo.EnumerateFiles("*", SearchOption.AllDirectories))
        {
            if (file.IsReadOnly)
            {
                file.IsReadOnly = false;
            }
        }

        Directory.Delete(path, true);
    }

    public async Task CloneRepositoryAsync(string url, string branch, string localPath, CancellationToken cancelToken)
    {
        await Task.Run(() =>
        {
            if (Directory.Exists(url))
            {
                if (Path.GetFullPath(url) != Path.GetFullPath(localPath))
                {
                    if (Directory.Exists(localPath))
                    {
                        DeleteDirectoryRecursive(localPath);
                    }

                    Directory.CreateDirectory(localPath);
                    foreach (var file in Directory.GetFiles(url, "*", SearchOption.AllDirectories))
                    {
                        var relativePath = Path.GetRelativePath(url, file);
                        var destFile = Path.Combine(localPath, relativePath);
                        Directory.CreateDirectory(Path.GetDirectoryName(destFile)!);
                        File.Copy(file, destFile, true);
                    }
                }
                return;
            }

            if (Directory.Exists(localPath))
            {
                DeleteDirectoryRecursive(localPath);
            }

            var options = new CloneOptions
            {
                BranchName = string.IsNullOrWhiteSpace(branch) ? "main" : branch,
                Checkout = true
            };

            Repository.Clone(url, localPath, options);
        }, cancelToken);
    }
}
