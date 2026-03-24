namespace TespitSozluk.API.DTOs;

public class DraftsPagedResponseDto
{
    public List<DraftResponseDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
