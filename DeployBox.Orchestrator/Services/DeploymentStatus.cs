namespace DeployBox.Orchestrator.Services;

public static class DeploymentStatus
{
    public const string Queued = "queued";
    public const string Cloning = "clonning";
    public const string Building = "building";
    public const string Deployed = "deployed";
    public const string Success = "success";
    public const string Failed = "failed";
    public const string Cancelled = "cancelled";
}
