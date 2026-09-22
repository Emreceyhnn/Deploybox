using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace DeployBox.Orchestrator.Services;

public interface IDeploymentStatusService
{
    Task UpdateStatusInDbAsync(
        string deploymentId,
        string status,
        string? imageTag = null,
        int? hostPort = null,
        string? errorMessage = null,
        DateTime? startedAt = null,
        DateTime? finishedAt = null);

    Task<bool> IsSupersededAsync(string projectId, string deploymentId);
}

public class DeploymentStatusService : IDeploymentStatusService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<DeploymentStatusService> _logger;

    public DeploymentStatusService(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        IConnectionMultiplexer redis,
        ILogger<DeploymentStatusService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _redis = redis;
        _logger = logger;
    }

    public async Task UpdateStatusInDbAsync(
        string deploymentId,
        string status,
        string? imageTag = null,
        int? hostPort = null,
        string? errorMessage = null,
        DateTime? startedAt = null,
        DateTime? finishedAt = null)
    {
        try
        {
            var clientApiUrl = _configuration["ClientApiUrl"]
                ?? Environment.GetEnvironmentVariable("CLIENT_API_URL")
                ?? "http://localhost:3000";

            var apiToken = _configuration["OrchestratorApiToken"]
                ?? Environment.GetEnvironmentVariable("ORCHESTRATOR_API_TOKEN");

            var client = _httpClientFactory.CreateClient();
            var endpoint = $"{clientApiUrl.TrimEnd('/')}/api/deployments/{deploymentId}/status";

            var body = new
            {
                status,
                imageTag,
                hostPort,
                containerPort = hostPort,
                errorMessage,
                startedAt = startedAt?.ToString("o"),
                finishedAt = finishedAt?.ToString("o")
            };

            using var httpRequest = new HttpRequestMessage(HttpMethod.Patch, endpoint)
            {
                Content = JsonContent.Create(body)
            };
            if (!string.IsNullOrEmpty(apiToken))
            {
                httpRequest.Headers.Add("x-orchestrator-token", apiToken);
            }

            var response = await client.SendAsync(httpRequest);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Deployment status update returned HTTP {StatusCode}. Endpoint: {Endpoint}", response.StatusCode, endpoint);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred while sending deployment status to the Next.js API. DeploymentId: {Id}", deploymentId);
        }
    }

    public async Task<bool> IsSupersededAsync(string projectId, string deploymentId)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(projectId))
            {
                return false;
            }

            var redisDb = _redis.GetDatabase();
            var latestDeploymentId = await redisDb.StringGetAsync($"deploy:latest:{projectId}");
            if (!latestDeploymentId.IsNullOrEmpty && latestDeploymentId.ToString() != deploymentId)
            {
                return true;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error while checking Redis deploy:latest.");
        }
        return false;
    }
}
