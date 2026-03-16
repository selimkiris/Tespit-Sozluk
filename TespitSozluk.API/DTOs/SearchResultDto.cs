namespace TespitSozluk.API.DTOs;

public class SearchResultDto
{
    public List<TopicResponseDto> Topics { get; set; } = [];
    public List<EntryResponseDto> Entries { get; set; } = [];
}
