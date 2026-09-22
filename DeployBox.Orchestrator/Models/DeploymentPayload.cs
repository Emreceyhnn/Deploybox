namespace DeployBox.Orchestrator.Models;

public class DeploymentPayload
{
    public string DeploymentId {get;set;}=string.Empty;
    public string ProjectId {get;set;}=string.Empty;
    public string RepoFullName {get;set;}=string.Empty;
    public string CommitSha {get;set;}=string.Empty;
    public string CommitMessage {get;set;}=string.Empty;
    public string Branch {get;set;}=string.Empty;
    public string AuthorName {get;set;}=string.Empty;
    public string AuthorAvatarUrl {get;set;}=string.Empty;
    public string ImageTag {get;set;}=string.Empty;
    public int ContainerPort {get;set;}
    public string? EnvVars {get;set;}
    public string TriggerType {get;set;}=string.Empty;
    public string Status {get;set;}=string.Empty;
    public string Subdomain {get;set;}=string.Empty;
    public DateTime QueuedAt {get;set;}
    public DateTime StartedAt {get;set;}
    public DateTime FinishedAt {get;set;}
    public DateTime CreatedAt {get;set;}
    public DateTime UpdatedAt {get;set;}
}