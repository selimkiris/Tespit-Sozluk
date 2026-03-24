using TespitSozluk.API.Helpers;

namespace TespitSozluk.API.Services;

public interface IEntryMentionService
{
    /// <summary>
    /// Geçerli @kullanıcı adlarını markdown bağlantısına çevirir ve etiketlenen kullanıcılar için bildirim ekler.
    /// </summary>
    Task<string> ApplyMentionsAndQueueNotificationsAsync(
        string content,
        Guid entryId,
        Guid authorId,
        MentionHelper.MentionUserMaps? preloadedMentionMaps = null,
        CancellationToken cancellationToken = default);
}
