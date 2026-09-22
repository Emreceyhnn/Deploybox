using Docker.DotNet;
using Docker.DotNet.Models;
using Microsoft.Extensions.Logging;

namespace DeployBox.Orchestrator.Services;

public interface IDockerContainerService
{
    Task<(int HostPort, string? ContainerIp, int ContainerPort)> DeployContainerAsync(string imageTag, string containerName, int containerPort, string? envVars = null, CancellationToken cancelToken = default);
    Task StreamContainerLogsAsync(string containerName, Func<string, Task> onLogLine, CancellationToken cancelToken = default);
}

public class DockerContainerService : IDockerContainerService
{
    private readonly IDockerClient _dockerClient;
    private readonly ILogger<DockerContainerService> _logger;

    public DockerContainerService(IDockerClient dockerClient, ILogger<DockerContainerService> logger)
    {
        _dockerClient = dockerClient;
        _logger = logger;
    }

    public async Task<(int HostPort, string? ContainerIp, int ContainerPort)> DeployContainerAsync(string imageTag, string containerName, int containerPort, string? envVars = null, CancellationToken cancelToken = default)
    {
        try
        {
            var existingContainers = await _dockerClient.Containers.ListContainersAsync(new ContainersListParameters
            {
                All = true,
                Filters = new Dictionary<string, IDictionary<string, bool>>
                {
                    ["name"] = new Dictionary<string, bool> { [containerName] = true }
                }
            }, cancelToken);

            if (existingContainers != null)
            {
                foreach (var container in existingContainers)
                {
                    try
                    {
                        await _dockerClient.Containers.StopContainerAsync(container.ID, new ContainerStopParameters { WaitBeforeKillSeconds = 5 }, cancelToken);
                    }
                    catch
                    {
                        // Ignore if container is already stopped
                    }

                    await _dockerClient.Containers.RemoveContainerAsync(container.ID, new ContainerRemoveParameters { Force = true }, cancelToken);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Warning while cleaning up existing container ({ContainerName}).", containerName);
        }

        int targetPort = 0;
        try
        {
            var imageInspect = await _dockerClient.Images.InspectImageAsync(imageTag, cancelToken);
            if (imageInspect?.Config?.ExposedPorts != null && imageInspect.Config.ExposedPorts.Count > 0)
            {
                var firstExposed = imageInspect.Config.ExposedPorts.Keys.FirstOrDefault();
                if (!string.IsNullOrEmpty(firstExposed))
                {
                    var portStr = firstExposed.Split('/')[0];
                    if (int.TryParse(portStr, out var expPort) && expPort > 0)
                    {
                        targetPort = expPort;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read exposed ports while inspecting the image. ImageTag: {ImageTag}", imageTag);
        }

        if (targetPort <= 0)
        {
            targetPort = containerPort > 0 ? containerPort : 3000;
        }

        var envList = new List<string>
        {
            $"PORT={targetPort}",
            "HOST=0.0.0.0",
            "HOSTNAME=0.0.0.0"
        };

        if (!string.IsNullOrWhiteSpace(envVars))
        {
            var lines = envVars.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var line in lines)
            {
                var trimmed = line.Trim();
                if (!string.IsNullOrWhiteSpace(trimmed) && !trimmed.StartsWith("#") && trimmed.Contains('='))
                {
                    envList.Add(trimmed);
                }
            }
        }

        var config = new Config
        {
            Image = imageTag,
            ExposedPorts = new Dictionary<string, EmptyStruct>
            {
                [$"{targetPort}/tcp"] = default
            },
            Env = envList
        };

        var hostConfig = new HostConfig
        {
            PortBindings = new Dictionary<string, IList<PortBinding>>
            {
                [$"{targetPort}/tcp"] = new List<PortBinding>
                {
                    new PortBinding { HostPort = "" }
                }
            },
            RestartPolicy = new RestartPolicy { Name = RestartPolicyKind.UnlessStopped },

            // Every deployed container runs arbitrary, untrusted user code —
            // without limits, one hostile or simply buggy project (fork bomb,
            // memory leak, infinite loop) can starve the host and every other
            // tenant's container. These are deliberately generous defaults
            // for a typical web app, not a hard technical ceiling.
            Memory = 512L * 1024 * 1024, // 512MB
            MemorySwap = 512L * 1024 * 1024, // equal to Memory: disables swap use beyond the memory limit
            NanoCPUs = 1_000_000_000, // 1.0 CPU core
            PidsLimit = 256, // blocks fork-bomb style DoS

            // Defense-in-depth against container breakout: drop all Linux
            // capabilities except what a normal web server/runtime needs, and
            // block privilege escalation via setuid binaries.
            CapDrop = new List<string> { "ALL" },
            SecurityOpt = new List<string> { "no-new-privileges:true" },
        };

        // The orchestrator itself runs inside a container — its own
        // 127.0.0.1 is its own network namespace, not the host's, so a
        // published host port (e.g. "-p 32768:3006") is unreachable from here
        // even though it works fine from outside. The gateway-nginx container
        // that must later proxy to this deployment has the same problem.
        // Attach the deployed container to the shared `gateway-network` so
        // both the orchestrator's readiness check and nginx's proxy_pass can
        // reach it directly by its container IP instead of a host port.
        var deployNetwork = Environment.GetEnvironmentVariable("DEPLOY_NETWORK") ?? "gateway-network";
        var networkingConfig = new NetworkingConfig
        {
            EndpointsConfig = new Dictionary<string, EndpointSettings>
            {
                [deployNetwork] = new EndpointSettings()
            }
        };

        var createResponse = await _dockerClient.Containers.CreateContainerAsync(new CreateContainerParameters(config)
        {
            Name = containerName,
            HostConfig = hostConfig,
            NetworkingConfig = networkingConfig
        }, cancelToken);

        await _dockerClient.Containers.StartContainerAsync(createResponse.ID, new ContainerStartParameters(), cancelToken);

        int assignedHostPort = 0;
        string? containerIp = null;
        try
        {
            var inspectData = await _dockerClient.Containers.InspectContainerAsync(createResponse.ID, cancelToken);
            if (inspectData?.NetworkSettings?.Ports != null)
            {
                if (inspectData.NetworkSettings.Ports.TryGetValue($"{targetPort}/tcp", out var bindings) && bindings != null && bindings.Count > 0)
                {
                    if (int.TryParse(bindings[0].HostPort, out var parsedPort))
                    {
                        assignedHostPort = parsedPort;
                    }
                }

                if (assignedHostPort <= 0)
                {
                    foreach (var kvp in inspectData.NetworkSettings.Ports)
                    {
                        if (kvp.Value != null && kvp.Value.Count > 0 && int.TryParse(kvp.Value[0].HostPort, out var fallbackPort))
                        {
                            assignedHostPort = fallbackPort;
                            break;
                        }
                    }
                }
            }

            if (inspectData?.NetworkSettings?.Networks != null
                && inspectData.NetworkSettings.Networks.TryGetValue(deployNetwork, out var networkInfo)
                && !string.IsNullOrEmpty(networkInfo?.IPAddress))
            {
                containerIp = networkInfo.IPAddress;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read the host port/IP while inspecting the container. ContainerId: {ID}", createResponse.ID);
        }

        return (assignedHostPort, containerIp, targetPort);
    }

    public async Task StreamContainerLogsAsync(string containerName, Func<string, Task> onLogLine, CancellationToken cancelToken = default)
    {
        try
        {
            var stream = await _dockerClient.Containers.GetContainerLogsAsync(
                containerName,
                tty: false,
                new ContainerLogsParameters
                {
                    Follow = true,
                    ShowStdout = true,
                    ShowStderr = true,
                    Timestamps = false,
                    Tail = "50"
                },
                cancelToken);

            await stream.CopyOutputToAsync(
                Stream.Null,
                CreateLineStream(onLogLine),
                CreateLineStream(onLogLine),
                cancelToken);
        }
        catch (OperationCanceledException)
        {
            // Follow duration expired or the job was cancelled; normal flow.
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error occurred while following container runtime logs. Container: {ContainerName}", containerName);
        }
    }

    private static Stream CreateLineStream(Func<string, Task> onLogLine)
    {
        return new LineCallbackStream(onLogLine);
    }

    private sealed class LineCallbackStream : Stream
    {
        private readonly Func<string, Task> _onLogLine;
        private readonly System.Text.StringBuilder _buffer = new();

        public LineCallbackStream(Func<string, Task> onLogLine) => _onLogLine = onLogLine;

        public override void Write(byte[] buffer, int offset, int count)
        {
            WriteAsync(buffer, offset, count, CancellationToken.None).GetAwaiter().GetResult();
        }

        public override async Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
        {
            var chunk = System.Text.Encoding.UTF8.GetString(buffer, offset, count);
            foreach (var ch in chunk)
            {
                if (ch == '\n')
                {
                    var text = _buffer.ToString().Trim();
                    _buffer.Clear();
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        await _onLogLine(text);
                    }
                }
                else if (ch != '\r')
                {
                    _buffer.Append(ch);
                }
            }
        }

        public override void Flush() { }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override bool CanRead => false;
        public override bool CanSeek => false;
        public override bool CanWrite => true;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
    }
}
