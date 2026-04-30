using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;

namespace TespitSozluk.API.Services;

public class UserSoftDeletionService : IUserSoftDeletionService
{
    private readonly AppDbContext _context;

    public UserSoftDeletionService(AppDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    public async Task<bool> SoftDeleteUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
        if (user is null)
            return false;

        var entryIds = await _context.Entries
            .Where(e => e.AuthorId == userId)
            .Select(e => e.Id)
            .ToListAsync(cancellationToken);

        var ownedTopicIds = await _context.Topics
            .Where(t => t.AuthorId == userId)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        // ── A) Etkileşim temizliği (kalıcı) ──────────────────────────────────
        var badges = await _context.EntryBadges
            .Where(b => b.GiverUserId == userId || entryIds.Contains(b.EntryId))
            .ToListAsync(cancellationToken);
        _context.EntryBadges.RemoveRange(badges);

        var pollVotes = await _context.PollVotes
            .Where(v => v.UserId == userId)
            .ToListAsync(cancellationToken);
        _context.PollVotes.RemoveRange(pollVotes);

        var privateMessages = await _context.PrivateMessages
            .Where(m => m.SenderId == userId || m.RecipientId == userId)
            .ToListAsync(cancellationToken);
        _context.PrivateMessages.RemoveRange(privateMessages);

        var reportsToRemove = await _context.Reports
            .Where(r =>
                r.ReporterId == userId ||
                r.ReportedUserId == userId ||
                (r.ReportedEntryId != null && entryIds.Contains(r.ReportedEntryId.Value)) ||
                (r.ReportedTopicId != null && ownedTopicIds.Contains(r.ReportedTopicId.Value)))
            .ToListAsync(cancellationToken);
        _context.Reports.RemoveRange(reportsToRemove);

        var votes = await _context.EntryVotes
            .Where(v => v.UserId == userId)
            .ToListAsync(cancellationToken);
        _context.EntryVotes.RemoveRange(votes);

        var savedEntries = await _context.UserSavedEntries
            .Where(s => s.UserId == userId)
            .ToListAsync(cancellationToken);
        _context.UserSavedEntries.RemoveRange(savedEntries);

        var follows = await _context.UserFollows
            .Where(f => f.FollowerId == userId || f.FollowingId == userId)
            .ToListAsync(cancellationToken);
        _context.UserFollows.RemoveRange(follows);

        var topicFollows = await _context.UserTopicFollows
            .Where(tf => tf.UserId == userId)
            .ToListAsync(cancellationToken);
        _context.UserTopicFollows.RemoveRange(topicFollows);

        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId || n.SenderId == userId)
            .ToListAsync(cancellationToken);
        _context.Notifications.RemoveRange(notifications);

        var drafts = await _context.DraftEntries
            .Where(d => d.AuthorId == userId)
            .ToListAsync(cancellationToken);
        _context.DraftEntries.RemoveRange(drafts);

        // ── Engelleme (Block) satırları ──────────────────────────────────────
        // UserBlock.BlockedId üzerinde Restrict FK olduğu için hard-delete fazına
        // kadar bu satırlar mutlaka temizlenmiş olmalıdır. Aynı zamanda kullanıcının
        // engellediği/engelleyen olduğu hiçbir kayıt kalmasın diye iki yönlü temizlik.
        var userBlocks = await _context.UserBlocks
            .Where(b => b.BlockerId == userId || b.BlockedId == userId)
            .ToListAsync(cancellationToken);
        _context.UserBlocks.RemoveRange(userBlocks);

        var topicBlocks = await _context.TopicBlocks
            .Where(tb => tb.UserId == userId)
            .ToListAsync(cancellationToken);
        _context.TopicBlocks.RemoveRange(topicBlocks);

        // ── B) Yasal saklama (soft delete) öncesi: etkilenecek başlık Id'leri ───
        var affectedTopicIds = await _context.Entries
            .Where(e => e.AuthorId == userId)
            .Select(e => e.TopicId)
            .Distinct()
            .ToListAsync(cancellationToken);

        // ── C) Yasal saklama (soft delete) ───────────────────────────────────
        var utcNow = DateTime.UtcNow;
        await _context.Entries
            .Where(e => e.AuthorId == userId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(e => e.IsDeleted, true)
                .SetProperty(e => e.DeletedAtUtc, utcNow), cancellationToken);

        // ── D) Boş başlık imhası + kalan başlıkta yazar anonimleştirme ───────────
        // Global filtre aktif Entry'leri sayar; bu kullanıcı dışında aktif entry
        // yoksa başlık tamamen kalıcı silinir (soft entry'ler Topic silinince FK cascade ile gider).
        foreach (var topicId in affectedTopicIds)
        {
            var activeEntryCount = await _context.Entries.CountAsync(
                e => e.TopicId == topicId,
                cancellationToken);
            var topic = await _context.Topics.FirstOrDefaultAsync(
                t => t.Id == topicId,
                cancellationToken);
            if (topic is null)
                continue;

            if (activeEntryCount == 0)
                _context.Topics.Remove(topic);
            else if (topic.AuthorId == userId)
                topic.AuthorId = null;
        }

        foreach (var topicId in ownedTopicIds.Where(id => !affectedTopicIds.Contains(id)))
        {
            var topic = await _context.Topics.FirstOrDefaultAsync(
                t => t.Id == topicId,
                cancellationToken);
            if (topic?.AuthorId == userId)
                topic.AuthorId = null;
        }

        user.IsDeleted = true;
        user.DeletedAtUtc = utcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }
}
