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

    /// <summary>Takip edilen kullanıcıya yazar takibi bildirimi (SaveChanges öncesi).</summary>
    void TryNotifyOnUserFollow(Guid followedUserId, Guid followerId, string message);

    /// <summary>Başlık sahibine başlık takibi bildirimi (SaveChanges öncesi).</summary>
    void TryNotifyTopicAuthorOnFollow(Guid topicId, Guid topicAuthorId, Guid followerId, string message);

    /// <summary>Başlık takibi geri alındığında ilgili bildirimi kaldırır (SaveChanges öncesi).</summary>
    void RemoveTopicFollowNotification(Guid topicAuthorId, Guid followerId, Guid topicId);
}
