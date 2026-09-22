using System.Text.Json;
using DeployBox.Orchestrator.Models;
using DeployBox.Orchestrator.Services;
using StackExchange.Redis;

namespace DeployBox.Orchestrator;

public class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;
    private readonly IConnectionMultiplexer _redis;
    private readonly IServiceProvider _serviceProvider;
    private readonly IConfiguration _configuration;

    public Worker(
        ILogger<Worker> logger,
        IConnectionMultiplexer redis,
        IServiceProvider serviceProvider,
        IConfiguration configuration)
    {
        _logger = logger;
        _redis = redis;
        _serviceProvider = serviceProvider;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var db = _redis.GetDatabase();
        string queueKey = "deploy:queue";
        var timeoutMinutes = _configuration.GetValue<int?>("JobTimeoutMinutes") ?? 10;

        _logger.LogInformation("DeployBox Orchestrator is up and listening to the queue: {queue} (Timeout: {Timeout}min)", queueKey, timeoutMinutes);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // We pull data from the Redis List structure in a blocking manner (ListLeftPop).
                // It waits with a 2 second timeout so it doesn't get stuck while the app is shutting down (cancellation).
                var queueItem = await db.ListLeftPopAsync(queueKey);

                if (!queueItem.IsNull)
                {
                    string payloadJson = queueItem!;
                    _logger.LogInformation("New job picked up from the queue!");

                    var payload = JsonSerializer.Deserialize<DeploymentPayload>(payloadJson);

                    if (payload != null)
                    {
                        // Safely call the Scoped service from within the BackgroundService (Singleton)
                        using var scope = _serviceProvider.CreateScope();
                        var processor = scope.ServiceProvider.GetRequiredService<IDeploymentProcessor>();

                        // Create a CancellationTokenSource for the job's timeout
                        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                        timeoutCts.CancelAfter(TimeSpan.FromMinutes(timeoutMinutes));

                        try
                        {
                            await processor.ProcessDeploymentAsync(payload, timeoutCts.Token);
                        }
                        catch (OperationCanceledException ex) when (!stoppingToken.IsCancellationRequested)
                        {
                            _logger.LogError(ex, "⏰ Deploy timed out (Timeout - {Timeout}min)! DeploymentId: {Id}", timeoutMinutes, payload.DeploymentId);
                        }
                    }
                }
                else
                {
                    // Wait briefly if the queue is empty, to avoid overloading the processor
                    await Task.Delay(1000, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error occurred while listening to the queue.");
                await Task.Delay(2000, stoppingToken);
            }
        }
    }
}