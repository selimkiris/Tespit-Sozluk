namespace TespitSozluk.API.DTOs;

public class UpdateCoverRequest
{
    /// <summary>Galeri görsel kimliği (istemci sabit listesi). Özel URL ile birlikte gönderilirse yok sayılabilir.</summary>
    public string? CoverChoiceKey { get; set; }

    /// <summary>ImgBB veya doğrudan görüntü adresi (HTTPS önerilir).</summary>
    public string? CoverUrl { get; set; }
}
