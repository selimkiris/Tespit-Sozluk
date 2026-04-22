using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace TespitSozluk.API.DTOs;

public class UpdateTopicDto
{
    [JsonPropertyName("title")]
    [Required(ErrorMessage = "Başlık boş olamaz.")]
    [StringLength(60, ErrorMessage = "Başlık en fazla 60 karakter olabilir.")]
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Kullanıcı bu alanı yollarsa başlığın anonimlik durumu güncellenir.
    /// Gönderilmezse (null) mevcut değer korunur.
    /// Bu alan yalnızca Topic.IsAnonymous'ı etkiler; altındaki entry'lerin anonimliğine
    /// kesinlikle dokunulmaz (başlık ve entry anonimliği tamamen bağımsızdır).
    /// </summary>
    [JsonPropertyName("isAnonymous")]
    public bool? IsAnonymous { get; set; }
}
