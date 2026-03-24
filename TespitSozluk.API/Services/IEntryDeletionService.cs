using TespitSozluk.API.Entities;

namespace TespitSozluk.API.Services;

/// <summary>
/// Entry silme ve bağlı başlığın (Topic) boş kalması halinde kaldırılması.
/// Projede Entry/Topic için IsDeleted (soft delete) yok; varsa <see cref="EntryDeletionService"/> içinde bayrak güncellemesi yapılmalıdır.
/// </summary>
public interface IEntryDeletionService
{
    /// <summary>
    /// Entry'yi kalıcı olarak siler; veritabanında aynı TopicId için kalan entry sayısı 0 ise Topic'i de kaldırır.
    /// </summary>
    Task DeleteEntryAndPruneEmptyTopicAsync(Entry entry, CancellationToken cancellationToken = default);
}
