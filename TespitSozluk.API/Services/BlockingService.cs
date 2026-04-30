using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.Entities;

namespace TespitSozluk.API.Services;

/// <summary>
/// Engelleme + Etkileşim Temizliği. <see cref="IHostedService"/> kullanmaz: tüm temizlik,
/// istek anında ve TEK bir transaction içinde, set-tabanlı (ExecuteDeleteAsync) sorgularla
/// yapılır. Her veri tipi için ayrı bir Round-trip yerine, hangi tarafın hangi tarafla
/// ilişkili olduğunu tek SQL DELETE-WHERE-EXISTS ifadesiyle çözüyoruz; bu yüzden N+1 yok
/// ve mevcut <see cref="UserSoftDeletionService"/> ile tutarlı bir temizlik yapısı elde
/// ediyoruz.
/// </summary>
public sealed class BlockingService : IBlockingService
{
    private readonly AppDbContext _context;

    public BlockingService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<BlockOperationResult> BlockUserAsync(
        Guid blockerId,
        Guid blockedId,
        CancellationToken cancellationToken = default)
    {
        if (blockerId == blockedId)
        {
            return BlockOperationResult.SelfBlock;
        }

        // Hedef kullanıcı yoksa veya zaten soft-deleted ise engelleme anlamsızdır.
        var targetExists = await _context.Users
            .AsNoTracking()
            .AnyAsync(u => u.Id == blockedId, cancellationToken);
        if (!targetExists)
        {
            return BlockOperationResult.UserNotFound;
        }

        await using var tx = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // 1) Idempotent insert. Çift kez aynı (Blocker, Blocked) eklenirse PK çakışması
            //    olurdu; bu yüzden önce kontrol edilir. Kontrol+Insert arasında bir başka
            //    istemci aynı satırı eklerse yakalayıp no-op'a düşeriz (yarış durumu).
            var alreadyBlocked = await _context.UserBlocks
                .AnyAsync(b => b.BlockerId == blockerId && b.BlockedId == blockedId,
                    cancellationToken);
            if (!alreadyBlocked)
            {
                _context.UserBlocks.Add(new UserBlock
                {
                    BlockerId = blockerId,
                    BlockedId = blockedId,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // 2) Etkileşim Temizliği — Set-tabanlı, ExecuteDeleteAsync ile
            //    her tip için TEK round-trip. Sıralı await; PostgreSQL açık tx içinde
            //    sıralı gönderim yapar.

            // 2a) Karşılıklı oylar (EntryVotes): önce Entry.Upvotes/Downvotes denormalize
            //     sayaçlarını silinecek oy sayısı kadar düşür (aksi halde oy satırı gider
            //     sayaç kalır; engel kaldırılınca aynı entry'ye tekrar oy verilebilir =
            //     sayaç şişmesi). Ardından oy satırlarını sil.
            IQueryable<EntryVote> MutualEntryVotes() =>
                _context.EntryVotes.Where(v =>
                    (v.UserId == blockerId
                        && _context.Entries.Any(e => e.Id == v.EntryId && e.AuthorId == blockedId))
                    || (v.UserId == blockedId
                        && _context.Entries.Any(e => e.Id == v.EntryId && e.AuthorId == blockerId)));

            var voteDeltas = await MutualEntryVotes()
                .AsNoTracking()
                .GroupBy(v => v.EntryId)
                .Select(g => new
                {
                    EntryId = g.Key,
                    UpRemoved = g.Sum(v => v.IsUpvote ? 1 : 0),
                    DownRemoved = g.Sum(v => v.IsUpvote ? 0 : 1),
                })
                .ToListAsync(cancellationToken);

            foreach (var d in voteDeltas)
            {
                var up = d.UpRemoved;
                var down = d.DownRemoved;
                await _context.Entries
                    .Where(e => e.Id == d.EntryId)
                    .ExecuteUpdateAsync(
                        s => s
                            .SetProperty(e => e.Upvotes, e => e.Upvotes >= up ? e.Upvotes - up : 0)
                            .SetProperty(e => e.Downvotes, e => e.Downvotes >= down ? e.Downvotes - down : 0),
                        cancellationToken);
            }

            await MutualEntryVotes().ExecuteDeleteAsync(cancellationToken);

            // 2b) Karşılıklı takipler (UserFollows).
            await _context.UserFollows
                .Where(f =>
                    (f.FollowerId == blockerId && f.FollowingId == blockedId) ||
                    (f.FollowerId == blockedId && f.FollowingId == blockerId))
                .ExecuteDeleteAsync(cancellationToken);

            // 2c) Karşılıklı rozetler (EntryBadges): A'nın B'nin entry'sine taktığı +
            //     B'nin A'nın entry'sine taktığı rozetler.
            await _context.EntryBadges
                .Where(eb =>
                    (eb.GiverUserId == blockerId
                        && _context.Entries.Any(e => e.Id == eb.EntryId && e.AuthorId == blockedId))
                    || (eb.GiverUserId == blockedId
                        && _context.Entries.Any(e => e.Id == eb.EntryId && e.AuthorId == blockerId)))
                .ExecuteDeleteAsync(cancellationToken);

            // 2d) Karşılıklı çiviler (UserSavedEntry): A'nın B'nin entry'sini kaydetmesi +
            //     B'nin A'nın entry'sini kaydetmesi.
            await _context.UserSavedEntries
                .Where(s =>
                    (s.UserId == blockerId
                        && _context.Entries.Any(e => e.Id == s.EntryId && e.AuthorId == blockedId))
                    || (s.UserId == blockedId
                        && _context.Entries.Any(e => e.Id == s.EntryId && e.AuthorId == blockerId)))
                .ExecuteDeleteAsync(cancellationToken);

            // 2e) Engellenen kişinin açtığı başlıklara olan TAKİPLER düşürülür
            //     (yalnızca tek yön: blocker → blocked'un başlıkları).
            //     Karşılığında blocked → blocker'ın başlıklarındaki takip de düşer.
            await _context.UserTopicFollows
                .Where(utf =>
                    (utf.UserId == blockerId
                        && _context.Topics.Any(t => t.Id == utf.TopicId && t.AuthorId == blockedId))
                    || (utf.UserId == blockedId
                        && _context.Topics.Any(t => t.Id == utf.TopicId && t.AuthorId == blockerId)))
                .ExecuteDeleteAsync(cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
            return BlockOperationResult.Ok;
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<BlockOperationResult> UnblockUserAsync(
        Guid blockerId,
        Guid blockedId,
        CancellationToken cancellationToken = default)
    {
        if (blockerId == blockedId)
        {
            return BlockOperationResult.SelfBlock;
        }

        var deleted = await _context.UserBlocks
            .Where(b => b.BlockerId == blockerId && b.BlockedId == blockedId)
            .ExecuteDeleteAsync(cancellationToken);

        return deleted > 0 ? BlockOperationResult.Ok : BlockOperationResult.NotFound;
    }

    public async Task<BlockOperationResult> BlockTopicAsync(
        Guid userId,
        Guid topicId,
        CancellationToken cancellationToken = default)
    {
        var topicExists = await _context.Topics
            .AsNoTracking()
            .AnyAsync(t => t.Id == topicId, cancellationToken);
        if (!topicExists)
        {
            return BlockOperationResult.TopicNotFound;
        }

        await using var tx = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var alreadyBlocked = await _context.TopicBlocks
                .AnyAsync(tb => tb.UserId == userId && tb.TopicId == topicId, cancellationToken);
            if (!alreadyBlocked)
            {
                _context.TopicBlocks.Add(new TopicBlock
                {
                    UserId = userId,
                    TopicId = topicId,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // Mevcut başlık takibi varsa düşür (engellediği başlığı takip eden bir
            // kullanıcının olamayacağı tutarlılık kuralı).
            await _context.UserTopicFollows
                .Where(utf => utf.UserId == userId && utf.TopicId == topicId)
                .ExecuteDeleteAsync(cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
            return BlockOperationResult.Ok;
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<BlockOperationResult> UnblockTopicAsync(
        Guid userId,
        Guid topicId,
        CancellationToken cancellationToken = default)
    {
        var deleted = await _context.TopicBlocks
            .Where(tb => tb.UserId == userId && tb.TopicId == topicId)
            .ExecuteDeleteAsync(cancellationToken);

        return deleted > 0 ? BlockOperationResult.Ok : BlockOperationResult.NotFound;
    }
}
