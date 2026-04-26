using System.ComponentModel.DataAnnotations;

namespace TespitSozluk.API.DTOs;

public class AddPollOptionDto
{
    [Required]
    [MaxLength(300, ErrorMessage = "Seçenek metni en fazla 300 karakter olabilir.")]
    public string Text { get; set; } = string.Empty;
}
