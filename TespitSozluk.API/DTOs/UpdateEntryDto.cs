using System.ComponentModel.DataAnnotations;

namespace TespitSozluk.API.DTOs;

public class UpdateEntryDto
{
    [MaxLength(100000, ErrorMessage = "Bir entry maksimum 100.000 karakter olabilir.")]
    public string Content { get; set; } = string.Empty;
}
