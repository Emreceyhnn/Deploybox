using Docker.DotNet;
using StackExchange.Redis;
using DeployBox.Orchestrator.Services;
using DeployBox.Orchestrator;

var builder = Host.CreateApplicationBuilder(args);


builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var redisConnectionString = builder.Configuration.GetConnectionString("Redis")
        ?? Environment.GetEnvironmentVariable("REDIS_URL")
        ?? "localhost:6379";

    var options = ParseRedisConnectionString(redisConnectionString);
    options.AbortOnConnectFail = false;
    options.ConnectRetry = 5;

    return ConnectionMultiplexer.Connect(options);
});

// StackExchange.Redis's ConfigurationOptions.Parse only understands its own
// "host:port,password=x,..." format, not a redis:// URI (which REDIS_URL is
// conventionally set to, e.g. "redis://:password@host:6379") — normalize the
// URI form here so a password-protected Redis actually authenticates instead
// of silently mis-parsing the password into the host string.
static ConfigurationOptions ParseRedisConnectionString(string connectionString)
{
    if (connectionString.StartsWith("redis://", StringComparison.OrdinalIgnoreCase) ||
        connectionString.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase))
    {
        var uri = new Uri(connectionString);
        var options = new ConfigurationOptions
        {
            EndPoints = { { uri.Host, uri.Port > 0 ? uri.Port : 6379 } },
            Ssl = connectionString.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase),
        };

        if (!string.IsNullOrEmpty(uri.UserInfo))
        {
            var parts = uri.UserInfo.Split(':', 2);
            var password = parts.Length == 2 ? parts[1] : parts[0];
            if (!string.IsNullOrEmpty(password))
            {
                options.Password = Uri.UnescapeDataString(password);
            }
        }

        return options;
    }

    return ConfigurationOptions.Parse(connectionString);
}


builder.Services.AddSingleton<IDockerClient>(sp =>
{
    var dockerUri = OperatingSystem.IsWindows() 
        ? new Uri("npipe://./pipe/docker_engine") 
        : new Uri("unix:///var/run/docker.sock");

    return new DockerClientConfiguration(dockerUri).CreateClient();
});


builder.Services.AddHttpClient();
builder.Services.AddScoped<IGitService, GitService>();
builder.Services.AddScoped<IDockerfileGeneratorService, DockerfileGeneratorService>();
builder.Services.AddScoped<IDockerBuildService, DockerBuildService>();
builder.Services.AddScoped<IDockerContainerService, DockerContainerService>();
builder.Services.AddScoped<IDeploymentLogService, DeploymentLogService>();
builder.Services.AddScoped<IDeploymentStatusService, DeploymentStatusService>();
builder.Services.AddScoped<INginxConfigService, NginxConfigService>();
builder.Services.AddScoped<IDeploymentProcessor, DeploymentProcessor>();

builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();