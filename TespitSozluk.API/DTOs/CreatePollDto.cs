using System.ComponentModel.DataAnnotations;

namespace TespitSozluk.API.DTOs;

/// <summary>
/// Entry / Draft / Topic akışlarında opsiyonel olarak gönderilebilen anket tanımı.
/// Null ise anket oluşturulmaz; mevcut akış değişmeden çalışır.
///
/// NOT: `Question` taslak akışında null/boş olabilir (kısmen doldurulmuş anket
/// taslağı kaydedilebilsin diye). Yayınlama (entry create / publish) anında
/// `PollService.CreatePollForEntry` içinde **zorunlu** olarak doğrulanır.
/// </summary>
public class CreatePollDto
{
    [MaxLength(500, ErrorMessage = "Anket sorusu en fazla 500 karakter olabilir.")]
    public string? Question { get; set; }

    /// <summary>Başlangıçta girilen seçenekler. Yayınlamada en az 2, en fazla 100 seçenek olmalıdır.</summary>
    public List<string> Options { get; set; } = new();

    public bool AllowMultiple { get; set; }

    public bool AllowUserOptions { get; set; }
}
