using System.ComponentModel.DataAnnotations;

namespace TespitSozluk.API.DTOs;

public class UpdateEntryDto
{
    [MaxLength(100000, ErrorMessage = "Bir entry maksimum 100.000 karakter olabilir.")]
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Kullanıcı bu alanı yollarsa entry'nin anonimlik durumu güncellenir.
    /// Gönderilmezse (null) mevcut değer korunur.
    /// Entry, ilgili başlığın ilk entry'si ise başlığın IsAnonymous'ı da aynı değere çekilir.
    /// </summary>
    public bool? IsAnonymous { get; set; }
}
