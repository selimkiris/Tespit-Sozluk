using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace TespitSozluk.API.DTOs;

public class UpdateTopicDto
{
    [JsonPropertyName("title")]
    [Required(ErrorMessage = "Başlık boş olamaz.")]
    [StringLength(54, ErrorMessage = "Başlık en fazla 54 karakter olabilir.")]
    public string Title { get; set; } = string.Empty;
}
