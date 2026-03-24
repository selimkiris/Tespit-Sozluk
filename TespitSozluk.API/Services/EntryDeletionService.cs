using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.Entities;

namespace TespitSozluk.API.Services;

public class EntryDeletionService : IEntryDeletionService
{
    private readonly AppDbContext _context;

    public EntryDeletionService(AppDbContext context)
    {
        _context = context;
    }

    public async Task DeleteEntryAndPruneEmptyTopicAsync(Entry entry, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(entry);
        var topicId = entry.TopicId;

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            _context.Entries.Remove(entry);
            await _context.SaveChangesAsync(cancellationToken);

            // Takip edilen entity / tracking sorunlarından kaçınmak için doğrudan veritabanı sayımı
            var remainingCount = await _context.Entries.AsNoTracking()
                .CountAsync(e => e.TopicId == topicId, cancellationToken);

            if (remainingCount == 0)
            {
                await _context.Topics
                    .Where(t => t.Id == topicId)
                    .ExecuteDeleteAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
