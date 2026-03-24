using System.ComponentModel.DataAnnotations;

namespace TespitSozluk.API.DTOs;

public class CreateTopicDto
{
    [Required(ErrorMessage = "Başlık boş olamaz.")]
    [MaxLength(60, ErrorMessage = "Başlık en fazla 60 karakter olabilir.")]
    public string Title { get; set; } = string.Empty;

    public bool IsAnonymous { get; set; }

    /// <summary>Başlıkla birlikte atomik oluşturulacak ilk entry içeriği (HTML).</summary>
    [Required(ErrorMessage = "İlk entry içeriği gerekli.")]
    [MaxLength(100000, ErrorMessage = "Bir entry maksimum 100.000 karakter olabilir.")]
    public string FirstEntryContent { get; set; } = string.Empty;
}
