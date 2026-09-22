namespace DeployBox.Orchestrator.Models;

public enum LogType{
    Info,
    Error,
    Success
}

public class LogMessage {
    public string DeploymentId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public LogType Type { get; set; } = LogType.Info;
}