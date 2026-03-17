using System.Text.Json.Serialization;

namespace TespitSozluk.API.DTOs;

public class UpdateTopicDto
{
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;
}
