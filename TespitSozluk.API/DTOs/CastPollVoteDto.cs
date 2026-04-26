namespace TespitSozluk.API.DTOs;

public class CastPollVoteDto
{
    /// <summary>
    /// Oylanacak seçenek Id'leri. AllowMultiple=false ise tek Id beklenir; çoklu modda
    /// kullanıcının aynı ankete bağlı istediği kadar seçenek yollayabileceği set.
    /// Boş liste = oyu geri çek.
    /// </summary>
    public List<Guid> OptionIds { get; set; } = new();
}
