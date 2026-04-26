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

    /// <summary>
    /// Anket yönetimi (opsiyonel):
    /// - Null + RemovePoll=false: mevcut anket korunur (varsa).
    /// - Doluyu (Question + en az 2 seçenek) yollarsa:
    ///     * Entry'de anket yoksa yeni anket oluşturulur.
    ///     * Anket varsa: oy yoksa Question/Options/Settings tamamen güncellenir.
    ///       Oy verilmiş seçenekler korunur (yalnızca metni güncellenir), kaldırılmaya çalışılan
    ///       oy alan seçenekler korunur (oy bütünlüğü). Eklenen seçenekler eklenir.
    ///       AllowMultiple/AllowUserOptions her zaman güncellenebilir.
    /// </summary>
    public CreatePollDto? Poll { get; set; }

    /// <summary>True ise entry'deki mevcut anket (varsa) silinir. `Poll` yollanmışsa görmezden gelinir.</summary>
    public bool RemovePoll { get; set; }
}
