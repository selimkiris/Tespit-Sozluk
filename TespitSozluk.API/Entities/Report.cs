namespace TespitSozluk.API.Entities;

public class Report
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReporterId { get; set; }
    public User Reporter { get; set; } = null!;
    public Guid? ReportedEntryId { get; set; }
    public Entry? ReportedEntry { get; set; }
    public Guid? ReportedTopicId { get; set; }
    public Topic? ReportedTopic { get; set; }
    public Guid? ReportedUserId { get; set; }
    public User? ReportedUser { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Details { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsResolved { get; set; } = false;
}
