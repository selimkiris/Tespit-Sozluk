using System.ComponentModel.DataAnnotations;

namespace TespitSozluk.API.DTOs;

public class CreateEntryDto
{
    public Guid TopicId { get; set; }

    [MaxLength(100000, ErrorMessage = "Bir entry maksimum 100.000 karakter olabilir.")]
    public string Content { get; set; } = string.Empty;

    /// <summary>Tam anonim paylaşım (varsayılan: false)</summary>
    public bool IsAnonymous { get; set; }

    /// <summary>
    /// Opsiyonel anket. Null ise entry normal şekilde oluşturulur; bu alanın varlığı
    /// standart entry oluşturma akışını etkilemez.
    /// </summary>
    public CreatePollDto? Poll { get; set; }
}
