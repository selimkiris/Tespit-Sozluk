using System.ComponentModel.DataAnnotations;

namespace TespitSozluk.API.DTOs;

public class CreateTopicDto
{
    [Required(ErrorMessage = "Başlık boş olamaz.")]
    [StringLength(70, ErrorMessage = "Başlık en fazla 70 karakter olabilir.")]
    public string Title { get; set; } = string.Empty;
}
