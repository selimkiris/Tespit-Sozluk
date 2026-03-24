namespace TespitSozluk.API.Services;

/// <summary>Entry beğeni / beğenmeme / kaydetme için entry sahibine bildirim.</summary>
public interface IEntryInteractionNotificationService
{
    /// <summary>Entry sahibi ile eylemi yapan aynı kişi değilse bildirim ekler (SaveChanges öncesi).</summary>
    void TryNotifyEntryOwner(Guid entryId, Guid entryAuthorId, Guid actorUserId, string type, string message);

    /// <summary>Entry-odaklı bildirimi (beğeni / kaka / kaydet) geri alındığında kaldırır (SaveChanges öncesi).</summary>
    void RemoveEntryInteractionNotification(Guid entryOwnerUserId, Guid actorUserId, Guid entryId, string type);

    /// <summary>Takip bildirimini takipten çıkıldığında kaldırır (SaveChanges öncesi).</summary>
    void RemoveFollowNotifications(Guid followedUserId, Guid followerId);
}
