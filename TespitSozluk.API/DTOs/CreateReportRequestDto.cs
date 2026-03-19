namespace TespitSozluk.API.DTOs;

public class CreateReportRequestDto
{
    public Guid? EntryId { get; set; }
    public Guid? TopicId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string? Details { get; set; }
}
