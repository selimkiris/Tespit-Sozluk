using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.Entities;
using TespitSozluk.API.Helpers;

namespace TespitSozluk.API.Services;

public sealed class MessagingPermissionService : IMessagingPermissionService
{
    private const string DenyByPreference =
        "Alıcının mesajlaşma tercihleri bu mesaja izin vermiyor.";

    private readonly AppDbContext _context;
    private readonly INoviceStatusService _noviceStatus;

    public MessagingPermissionService(AppDbContext context, INoviceStatusService noviceStatus)
    {
        _context = context;
        _noviceStatus = noviceStatus;
    }

    public async Task<MessagingSendEvaluation> EvaluateSendAsync(
        Guid senderId,
        Guid recipientId,
        CancellationToken cancellationToken = default)
    {
        if (senderId == recipientId)
        {
            return new MessagingSendEvaluation
            {
                IsAllowed = false,
                DenyMessage = "Kendinize mesaj gönderemezsiniz."
            };
        }

        var recipient = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == recipientId)
            .Select(u => new
            {
                u.MessagingInboxMode,
                u.MessagingMinLevelThreshold
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (recipient == null)
        {
            return new MessagingSendEvaluation
            {
                IsAllowed = false,
                RecipientNotFound = true
            };
        }

        if (recipient.MessagingInboxMode == MessagingInboxMode.Everyone)
        {
            return new MessagingSendEvaluation { IsAllowed = true };
        }

        var senderRow = await _context.Users
            .AsNoTracking()
            .Where(u => u.Id == senderId)
            .Select(u => new { u.Role, u.CreatedAt })
            .FirstOrDefaultAsync(cancellationToken);

        if (senderRow == null)
        {
            return new MessagingSendEvaluation
            {
                IsAllowed = false,
                DenyMessage = "Gönderen bulunamadı."
            };
        }

        var entryCount = await _context.Entries
            .AsNoTracking()
            .CountAsync(e => e.AuthorId == senderId && !e.IsAnonymous, cancellationToken);

        var topicCount = await _context.Topics
            .AsNoTracking()
            .CountAsync(
                t => t.AuthorId == senderId && !t.IsAnonymous,
                cancellationToken);

        var utc = DateTime.UtcNow;

        switch (recipient.MessagingInboxMode)
        {
            case MessagingInboxMode.EveryoneExceptNovices:
            {
                var isNov = _noviceStatus.IsNovice(
                    senderRow.Role,
                    senderId,
                    senderRow.CreatedAt,
                    entryCount,
                    topicCount);
                if (isNov)
                {
                    return new MessagingSendEvaluation
                    {
                        IsAllowed = false,
                        DenyMessage = DenyByPreference
                    };
                }

                break;
            }
            case MessagingInboxMode.OnlyFromUsersIFollow:
            {
                var follows = await _context.UserFollows
                    .AsNoTracking()
                    .AnyAsync(
                        uf => uf.FollowerId == recipientId && uf.FollowingId == senderId,
                        cancellationToken);
                if (!follows)
                {
                    return new MessagingSendEvaluation
                    {
                        IsAllowed = false,
                        DenyMessage = DenyByPreference
                    };
                }

                break;
            }
            case MessagingInboxMode.MinimumLevel:
            {
                var min = recipient.MessagingMinLevelThreshold;
                if (min == null)
                {
                    min = 0;
                }

                var levelIdx = UserLevelHelper.GetLevelIndex(
                    senderRow.CreatedAt,
                    entryCount,
                    topicCount,
                    utc);
                if (levelIdx < min)
                {
                    return new MessagingSendEvaluation
                    {
                        IsAllowed = false,
                        DenyMessage = DenyByPreference
                    };
                }

                break;
            }
            default:
                return new MessagingSendEvaluation
                {
                    IsAllowed = false,
                    DenyMessage = DenyByPreference
                };
        }

        return new MessagingSendEvaluation { IsAllowed = true };
    }
}
