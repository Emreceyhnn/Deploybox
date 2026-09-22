using System.Text.Json;
using DeployBox.Orchestrator.Models;
using StackExchange.Redis;

namespace DeployBox.Orchestrator.Services;

public interface IDeploymentLogService
{
    Task SendLogAsync(string deploymentId, string message, LogType type = LogType.Info);
}

public class DeploymentLogService : IDeploymentLogService
{
    // We keep the last N lines here for clients that reconnect and resubscribe.
    private const int BufferMaxLines = 200;
    private static readonly TimeSpan BufferTtl = TimeSpan.FromHours(1);

    private readonly IConnectionMultiplexer _redis;

    public DeploymentLogService(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public async Task SendLogAsync(string deploymentId, string message, LogType type = LogType.Info)
    {
        var log = new LogMessage
        {
            DeploymentId = deploymentId,
            Message = message,
            Type = type
        };

        var json = JsonSerializer.Serialize(log);
        var db = _redis.GetDatabase();
        var bufferKey = $"logs:{deploymentId}:buffer";

        await db.ListRightPushAsync(bufferKey, json);
        await db.ListTrimAsync(bufferKey, -BufferMaxLines, -1);
        await db.KeyExpireAsync(bufferKey, BufferTtl);

        var pubSub = _redis.GetSubscriber();
        await pubSub.PublishAsync(RedisChannel.Literal($"logs:{deploymentId}"), json);
    }
}
