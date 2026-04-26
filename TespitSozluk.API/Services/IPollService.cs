using TespitSozluk.API.DTOs;
using TespitSozluk.API.Entities;

namespace TespitSozluk.API.Services;

public interface IPollService
{
    /// <summary>
    /// Verilen entry Id setine ait anketleri, çağıran kullanıcının bakış açısıyla
    /// (oy kullanıp kullanmadığına göre yüzde/toplam maskeleme dahil) batch yükler.
    /// Entry'si anket içermeyenler için Dictionary'de giriş olmaz.
    /// </summary>
    Task<Dictionary<Guid, PollResponseDto>> BuildPollsForEntriesAsync(
        IReadOnlyCollection<Guid> entryIds,
        Guid? requestorId,
        CancellationToken ct = default);

    /// <summary>
    /// Entry oluşturulurken çağrılır. Dto doğrulanır ve Poll + PollOption kayıtları
    /// aynı DbContext üzerinde `Add` edilir. Çağıran `SaveChangesAsync`'i çağırır.
    /// </summary>
    /// <exception cref="PollValidationException">Doğrulama hatası.</exception>
    Poll CreatePollForEntry(Entry entry, CreatePollDto dto, Guid authorId);

    /// <summary>
    /// Mevcut entry'nin anketini günceller. Entry'nin anketi yoksa yeni oluşturur (CreatePollForEntry'ye delege).
    /// Oy verilmiş seçenekler korunur (sadece metni güncellenir); kaldırılmaya çalışılan oy alan
    /// seçenekler silinmez. AllowMultiple/AllowUserOptions her zaman güncellenir.
    /// </summary>
    Task<Poll> UpdatePollForEntryAsync(Entry entry, CreatePollDto dto, Guid authorId, CancellationToken ct = default);

    /// <summary>Entry'nin mevcut anketini ve tüm bağlı seçenek/oylarını siler. Anket yoksa noop.</summary>
    Task DeletePollForEntryAsync(Guid entryId, CancellationToken ct = default);

    Task<PollVoteResult> CastVoteAsync(Guid pollId, Guid userId, IReadOnlyList<Guid> optionIds, CancellationToken ct = default);

    Task<PollAddOptionResult> AddOptionAsync(Guid pollId, Guid userId, string text, CancellationToken ct = default);

    Task<PollResponseDto?> GetPollForUserAsync(Guid pollId, Guid? requestorId, CancellationToken ct = default);

    /// <summary>Taslak için CreatePollDto'yu jsonb olarak saklanacak string'e serileştirir. Null girdi → null.</summary>
    string? SerializeDraftPoll(CreatePollDto? dto);

    /// <summary>Jsonb olarak saklanan poll string'ini CreatePollDto'ya parse eder. Hatada null döner.</summary>
    CreatePollDto? DeserializeDraftPoll(string? json);
}

public sealed class PollValidationException : Exception
{
    public PollValidationException(string message) : base(message) { }
}

public sealed record PollVoteResult(PollResponseDto Poll);

public sealed record PollAddOptionResult(PollOptionResponseDto Option, PollResponseDto Poll);
