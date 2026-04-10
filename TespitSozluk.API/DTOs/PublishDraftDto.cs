namespace TespitSozluk.API.DTOs;

/// <summary>Taslak yayınlama isteği. IsAnonymous gönderilmezse taslaktaki değer kullanılır.</summary>
public class PublishDraftDto
{
    public bool? IsAnonymous { get; set; }
}
