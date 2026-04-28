using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.Entities;

namespace TespitSozluk.API.Services;

public static class EntryInteractionNotificationTypes
{
    public const string Like = "Like";
    public const string Dislike = "Dislike";
    public const string Save = "Save";
    public const string Follow = "Follow";
    public const string Mention = "Mention";
    public const string TopicFollow = "TopicFollow";
    public const string Badge = "Badge";
}

public class EntryInteractionNotificationService : IEntryInteractionNotificationService
{
    private readonly AppDbContext _context;

    public EntryInteractionNotificationService(AppDbContext context)
    {
        _context = context;
    }

    public void TryNotifyEntryOwner(Guid entryId, Guid entryAuthorId, Guid actorUserId, string type, string message)
    {
        if (actorUserId == entryAuthorId || entryAuthorId == Guid.Empty)
            return;

        _context.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = entryAuthorId,
            SenderId = actorUserId,
            Type = type,
            Message = message,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
            EntryId = entryId
        });
    }

    public void RemoveEntryInteractionNotification(Guid entryOwnerUserId, Guid actorUserId, Guid entryId, string type)
    {
        var rows = _context.Notifications
            .Where(n => n.UserId == entryOwnerUserId && n.SenderId == actorUserId && n.EntryId == entryId && n.Type == type)
            .ToList();
        _context.Notifications.RemoveRange(rows);
    }

    public void RemoveFollowNotifications(Guid followedUserId, Guid followerId)
    {
        var rows = _context.Notifications
            .Where(n => n.UserId == followedUserId && n.SenderId == followerId && n.Type == EntryInteractionNotificationTypes.Follow)
            .ToList();
        _context.Notifications.RemoveRange(rows);
    }

    public void TryNotifyOnUserFollow(Guid followedUserId, Guid followerId, string message)
    {
        if (followedUserId == Guid.Empty || followerId == Guid.Empty || followedUserId == followerId)
            return;

        _context.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = followedUserId,
            SenderId = followerId,
            Type = EntryInteractionNotificationTypes.Follow,
            Message = message,
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });
    }

    public void TryNotifyTopicAuthorOnFollow(Guid topicId, Guid topicAuthorId, Guid followerId, string message)
    {
        if (followerId == topicAuthorId || topicAuthorId == Guid.Empty)
            return;

        _context.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = topicAuthorId,
            SenderId = followerId,
            Type = EntryInteractionNotificationTypes.TopicFollow,
            Message = message,
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
            EntryId = null,
            TopicId = topicId
        });
    }

    public void RemoveTopicFollowNotification(Guid topicAuthorId, Guid followerId, Guid topicId)
    {
        var rows = _context.Notifications
            .Where(n =>
                n.UserId == topicAuthorId &&
                n.SenderId == followerId &&
                n.TopicId == topicId &&
                n.Type == EntryInteractionNotificationTypes.TopicFollow)
            .ToList();
        _context.Notifications.RemoveRange(rows);
    }
}
