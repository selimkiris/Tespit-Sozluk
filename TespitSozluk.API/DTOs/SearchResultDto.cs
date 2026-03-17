namespace TespitSozluk.API.DTOs;

public class SearchResultDto
{
    public List<TopicSearchResultDto> Topics { get; set; } = [];
    public List<UserSearchResultDto> Users { get; set; } = [];
}

public class TopicSearchResultDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
}
