using System.ComponentModel.DataAnnotations;

namespace TespitSozluk.API.DTOs;

public class CreateTopicDto
{
    [Required(ErrorMessage = "Başlık boş olamaz.")]
    [MaxLength(100, ErrorMessage = "Başlık maksimum 100 karakter olabilir.")]
    public string Title { get; set; } = string.Empty;
}
