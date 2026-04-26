using System.ComponentModel.DataAnnotations;

namespace TespitSozluk.API.DTOs;

public class CreateTopicDto
{
    [Required(ErrorMessage = "Başlık boş olamaz.")]
    [MaxLength(60, ErrorMessage = "Başlık en fazla 60 karakter olabilir.")]
    public string Title { get; set; } = string.Empty;

    public bool IsAnonymous { get; set; }

    /// <summary>
    /// Başlıkla birlikte atomik oluşturulacak ilk entry içeriği (HTML).
    /// Boş gönderilebilir; ancak `Poll` da yoksa controller BadRequest döner.
    /// </summary>
    [MaxLength(100000, ErrorMessage = "Bir entry maksimum 100.000 karakter olabilir.")]
    public string FirstEntryContent { get; set; } = string.Empty;

    /// <summary>
    /// Opsiyonel anket. Doluysa ilk entry ile birlikte 1:1 ilişkili Poll oluşturulur.
    /// Entry içeriği boş olsa dahi anket varsa oluşturmaya izin verilir.
    /// </summary>
    public CreatePollDto? Poll { get; set; }
}
