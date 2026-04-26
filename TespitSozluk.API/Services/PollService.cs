using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Data;
using TespitSozluk.API.DTOs;
using TespitSozluk.API.Entities;

namespace TespitSozluk.API.Services;

public sealed class PollService : IPollService
{
    public const int MinOptionsOnCreate = 2;
    public const int MaxOptions = 100;
    public const int MaxOptionTextLength = 300;
    public const int MaxQuestionLength = 500;

    private static readonly JsonSerializerOptions DraftJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    private readonly AppDbContext _context;

    public PollService(AppDbContext context)
    {
        _context = context;
    }

    // ── Yaratma (entry oluşturma akışı içinde) ───────────────────────────────
    public Poll CreatePollForEntry(Entry entry, CreatePollDto dto, Guid authorId)
    {
        if (dto == null)
        {
            throw new PollValidationException("Anket verisi eksik.");
        }

        var rawOptions = (dto.Options ?? new List<string>())
            .Select(o => (o ?? string.Empty).Trim())
            .Where(o => o.Length > 0)
            .ToList();

        if (rawOptions.Count < MinOptionsOnCreate)
        {
            throw new PollValidationException("Ankette en az 2 geçerli seçenek olmalı.");
        }
        if (rawOptions.Count > MaxOptions)
        {
            throw new PollValidationException($"Ankette en fazla {MaxOptions} seçenek olabilir.");
        }
        if (rawOptions.Any(o => o.Length > MaxOptionTextLength))
        {
            throw new PollValidationException($"Seçenek metni en fazla {MaxOptionTextLength} karakter olabilir.");
        }

        var question = (dto.Question ?? string.Empty).Trim();
        // ZORUNLU: Yeni anket politikasında soru boş bırakılamaz.
        if (question.Length == 0)
        {
            throw new PollValidationException("Anket sorusu zorunludur.");
        }
        if (question.Length > MaxQuestionLength)
        {
            throw new PollValidationException($"Anket sorusu en fazla {MaxQuestionLength} karakter olabilir.");
        }

        var now = DateTime.UtcNow;
        var poll = new Poll
        {
            Id = Guid.NewGuid(),
            EntryId = entry.Id,
            Question = question,
            AllowMultiple = dto.AllowMultiple,
            AllowUserOptions = dto.AllowUserOptions,
            CreatedAt = now
        };

        var options = rawOptions
            .Select((text, i) => new PollOption
            {
                Id = Guid.NewGuid(),
                PollId = poll.Id,
                Text = text,
                SortOrder = i,
                CreatedByUserId = null, // entry sahibi tarafından oluşturulan seçenekler
                CreatedAt = now
            })
            .ToList();

        _context.Polls.Add(poll);
        _context.PollOptions.AddRange(options);
        return poll;
    }

    // ── Batch yükleme (entry feed'lerinde kullanılır) ────────────────────────
    public async Task<Dictionary<Guid, PollResponseDto>> BuildPollsForEntriesAsync(
        IReadOnlyCollection<Guid> entryIds,
        Guid? requestorId,
        CancellationToken ct = default)
    {
        var result = new Dictionary<Guid, PollResponseDto>();
        if (entryIds == null || entryIds.Count == 0) return result;

        var entryIdList = entryIds.Distinct().ToList();

        var polls = await _context.Polls.AsNoTracking()
            .Where(p => entryIdList.Contains(p.EntryId))
            .Select(p => new
            {
                p.Id,
                p.EntryId,
                p.Question,
                p.AllowMultiple,
                p.AllowUserOptions,
                EntryAuthorId = p.Entry.AuthorId,
                EntryIsAnonymous = p.Entry.IsAnonymous
            })
            .ToListAsync(ct);

        if (polls.Count == 0) return result;

        var pollIds = polls.Select(p => p.Id).ToList();

        var options = await _context.PollOptions.AsNoTracking()
            .Where(o => pollIds.Contains(o.PollId))
            .OrderBy(o => o.SortOrder).ThenBy(o => o.CreatedAt)
            .Select(o => new
            {
                o.Id,
                o.PollId,
                o.Text,
                o.SortOrder,
                o.CreatedByUserId
            })
            .ToListAsync(ct);

        var voteCounts = await _context.PollVotes.AsNoTracking()
            .Where(v => pollIds.Contains(v.PollId))
            .GroupBy(v => v.PollOptionId)
            .Select(g => new { OptionId = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        var voteCountMap = voteCounts.ToDictionary(x => x.OptionId, x => x.Count);

        var totalsByPoll = await _context.PollVotes.AsNoTracking()
            .Where(v => pollIds.Contains(v.PollId))
            .GroupBy(v => v.PollId)
            .Select(g => new { PollId = g.Key, Count = g.Select(v => v.UserId).Distinct().Count() })
            .ToListAsync(ct);
        var totalVoterMap = totalsByPoll.ToDictionary(x => x.PollId, x => x.Count);

        HashSet<Guid> userVotedPollIds = new();
        HashSet<Guid> userVotedOptionIds = new();
        if (requestorId.HasValue)
        {
            var myVotes = await _context.PollVotes.AsNoTracking()
                .Where(v => pollIds.Contains(v.PollId) && v.UserId == requestorId.Value)
                .Select(v => new { v.PollId, v.PollOptionId })
                .ToListAsync(ct);
            userVotedPollIds = myVotes.Select(v => v.PollId).ToHashSet();
            userVotedOptionIds = myVotes.Select(v => v.PollOptionId).ToHashSet();
        }

        foreach (var p in polls)
        {
            var pollOptions = options.Where(o => o.PollId == p.Id).ToList();
            var hasVoted = userVotedPollIds.Contains(p.Id);

            // Toplam oy = ankete oy kullanan distinct kullanıcı sayısı.
            // Çoklu seçimde aynı kişi birden fazla seçenek işaretlese bile 1 oy sayılır.
            var totalVoters = totalVoterMap.TryGetValue(p.Id, out var tv) ? tv : 0;

            // Bar/yüzde paydası: seçeneklere düşen oyların toplamı (çoklu seçimde > totalVoters olabilir).
            var optionVoteSum = pollOptions.Sum(o => voteCountMap.TryGetValue(o.Id, out var c) ? c : 0);

            var optionDtos = pollOptions.Select(o =>
            {
                var count = voteCountMap.TryGetValue(o.Id, out var c) ? c : 0;
                double? percent = null;
                int? voteCount = null;
                if (hasVoted)
                {
                    voteCount = count;
                    percent = optionVoteSum == 0 ? 0 : Math.Round(count * 100.0 / optionVoteSum, 1);
                }
                return new PollOptionResponseDto
                {
                    Id = o.Id,
                    Text = o.Text,
                    IsUserAdded = o.CreatedByUserId.HasValue,
                    IsVotedByCurrentUser = requestorId.HasValue && userVotedOptionIds.Contains(o.Id),
                    VoteCount = voteCount,
                    Percent = percent,
                };
            }).ToList();

            var dto = new PollResponseDto
            {
                Id = p.Id,
                Question = p.Question,
                AllowMultiple = p.AllowMultiple,
                AllowUserOptions = p.AllowUserOptions,
                Options = optionDtos,
                HasVoted = hasVoted,
                TotalVotes = hasVoted ? totalVoters : null,
                // Anonim entry'lerde entry yazarı Guid.Empty olarak maskeleniyor; burada da aynı
                // prensibi uygula ki poll owner bilgisi anonimlik kontratını bozmasın.
                OwnerId = p.EntryIsAnonymous ? Guid.Empty : p.EntryAuthorId
            };

            result[p.EntryId] = dto;
        }

        return result;
    }

    // ── Oy verme ────────────────────────────────────────────────────────────
    public async Task<PollVoteResult> CastVoteAsync(
        Guid pollId,
        Guid userId,
        IReadOnlyList<Guid> optionIds,
        CancellationToken ct = default)
    {
        var poll = await _context.Polls
            .Include(p => p.Options)
            .FirstOrDefaultAsync(p => p.Id == pollId, ct);
        if (poll == null)
        {
            throw new PollValidationException("Anket bulunamadı.");
        }

        var requestedIds = (optionIds ?? new List<Guid>()).Distinct().ToList();

        // Politika değişikliği: "Oyumu geri al" özelliği kaldırıldı, oylar kalıcıdır.
        // Boş seçenek listesi geçersiz; en az 1 seçenek gönderilmeli.
        if (requestedIds.Count == 0)
        {
            throw new PollValidationException("En az bir seçenek seçmelisiniz.");
        }

        if (!poll.AllowMultiple && requestedIds.Count > 1)
        {
            throw new PollValidationException("Bu ankette yalnızca tek seçenek seçilebilir.");
        }

        // Oy verme kalıcıdır: kullanıcı bu ankete daha önce oy verdiyse yeniden oylama
        // yapamaz (UI tarafında zaten gizli; backend'de de güvence altına al).
        var alreadyVoted = await _context.PollVotes
            .AnyAsync(v => v.PollId == pollId && v.UserId == userId, ct);
        if (alreadyVoted)
        {
            throw new PollValidationException("Bu ankete zaten oy kullandınız.");
        }

        // Gönderilen tüm seçenekler bu ankete ait olmalı.
        var validOptionIds = poll.Options.Select(o => o.Id).ToHashSet();
        if (requestedIds.Any(id => !validOptionIds.Contains(id)))
        {
            throw new PollValidationException("Geçersiz seçenek.");
        }

        var now = DateTime.UtcNow;
        foreach (var id in requestedIds)
        {
            _context.PollVotes.Add(new PollVote
            {
                Id = Guid.NewGuid(),
                PollId = pollId,
                PollOptionId = id,
                UserId = userId,
                CreatedAt = now
            });
        }

        await _context.SaveChangesAsync(ct);

        var built = await BuildPollsForEntriesAsync(new[] { poll.EntryId }, userId, ct);
        var dto = built.TryGetValue(poll.EntryId, out var p) ? p : null;
        return new PollVoteResult(dto ?? throw new InvalidOperationException("Anket yeniden yüklenemedi."));
    }

    // ── Kullanıcı seçenek ekleme (AllowUserOptions) ──────────────────────────
    public async Task<PollAddOptionResult> AddOptionAsync(Guid pollId, Guid userId, string text, CancellationToken ct = default)
    {
        var normalized = (text ?? string.Empty).Trim();
        if (normalized.Length == 0)
        {
            throw new PollValidationException("Seçenek metni boş olamaz.");
        }
        if (normalized.Length > MaxOptionTextLength)
        {
            throw new PollValidationException($"Seçenek metni en fazla {MaxOptionTextLength} karakter olabilir.");
        }

        var poll = await _context.Polls
            .Include(p => p.Options)
            .FirstOrDefaultAsync(p => p.Id == pollId, ct);
        if (poll == null)
        {
            throw new PollValidationException("Anket bulunamadı.");
        }
        if (!poll.AllowUserOptions)
        {
            throw new PollValidationException("Bu ankete kullanıcı tarafından yeni seçenek eklenemez.");
        }
        if (poll.Options.Count >= MaxOptions)
        {
            throw new PollValidationException($"Bu ankette maksimum seçenek sayısına ulaşıldı ({MaxOptions}).");
        }

        // Aynı metinli seçenek varsa yine de ekleyebiliriz ama normalde bunu caseen gereksiz
        // klavuz olarak engelle (daha temiz veri).
        var duplicate = poll.Options.Any(o =>
            string.Equals(o.Text, normalized, StringComparison.OrdinalIgnoreCase));
        if (duplicate)
        {
            throw new PollValidationException("Bu seçenek zaten mevcut.");
        }

        var nextOrder = poll.Options.Count == 0 ? 0 : poll.Options.Max(o => o.SortOrder) + 1;
        var option = new PollOption
        {
            Id = Guid.NewGuid(),
            PollId = pollId,
            Text = normalized,
            SortOrder = nextOrder,
            CreatedByUserId = userId,
            CreatedAt = DateTime.UtcNow
        };
        _context.PollOptions.Add(option);
        await _context.SaveChangesAsync(ct);

        var built = await BuildPollsForEntriesAsync(new[] { poll.EntryId }, userId, ct);
        var pollDto = built.TryGetValue(poll.EntryId, out var pd) ? pd : null;
        if (pollDto == null)
        {
            throw new InvalidOperationException("Anket yeniden yüklenemedi.");
        }
        var optionDto = pollDto.Options.First(o => o.Id == option.Id);
        return new PollAddOptionResult(optionDto, pollDto);
    }

    public async Task<PollResponseDto?> GetPollForUserAsync(Guid pollId, Guid? requestorId, CancellationToken ct = default)
    {
        var entryId = await _context.Polls.AsNoTracking()
            .Where(p => p.Id == pollId)
            .Select(p => (Guid?)p.EntryId)
            .FirstOrDefaultAsync(ct);
        if (entryId == null) return null;

        var built = await BuildPollsForEntriesAsync(new[] { entryId.Value }, requestorId, ct);
        return built.TryGetValue(entryId.Value, out var dto) ? dto : null;
    }

    // ── Entry düzenleme akışı: anketi günceller / oluşturur ─────────────────
    public async Task<Poll> UpdatePollForEntryAsync(Entry entry, CreatePollDto dto, Guid authorId, CancellationToken ct = default)
    {
        if (dto == null) throw new PollValidationException("Anket verisi eksik.");

        var existingPoll = await _context.Polls
            .Include(p => p.Options)
            .FirstOrDefaultAsync(p => p.EntryId == entry.Id, ct);

        if (existingPoll == null)
        {
            // Anket yok → oluştur. Çağıran SaveChangesAsync'i çağırır.
            return CreatePollForEntry(entry, dto, authorId);
        }

        // Validasyon (yeni anket oluşturmadakiyle aynı kurallar).
        var rawOptions = (dto.Options ?? new List<string>())
            .Select(o => (o ?? string.Empty).Trim())
            .Where(o => o.Length > 0)
            .ToList();

        if (rawOptions.Count < MinOptionsOnCreate)
        {
            throw new PollValidationException("Ankette en az 2 geçerli seçenek olmalı.");
        }
        if (rawOptions.Count > MaxOptions)
        {
            throw new PollValidationException($"Ankette en fazla {MaxOptions} seçenek olabilir.");
        }
        if (rawOptions.Any(o => o.Length > MaxOptionTextLength))
        {
            throw new PollValidationException($"Seçenek metni en fazla {MaxOptionTextLength} karakter olabilir.");
        }

        var question = (dto.Question ?? string.Empty).Trim();
        if (question.Length == 0)
        {
            throw new PollValidationException("Anket sorusu zorunludur.");
        }
        if (question.Length > MaxQuestionLength)
        {
            throw new PollValidationException($"Anket sorusu en fazla {MaxQuestionLength} karakter olabilir.");
        }

        existingPoll.Question = question;
        existingPoll.AllowMultiple = dto.AllowMultiple;
        existingPoll.AllowUserOptions = dto.AllowUserOptions;

        // Hangi seçeneklere oy verilmiş? Onları silemeyiz (oy bütünlüğü).
        var pollOptionIds = existingPoll.Options.Select(o => o.Id).ToList();
        var votedOptionIdsSet = pollOptionIds.Count == 0
            ? new HashSet<Guid>()
            : (await _context.PollVotes.AsNoTracking()
                .Where(v => pollOptionIds.Contains(v.PollOptionId))
                .Select(v => v.PollOptionId)
                .Distinct()
                .ToListAsync(ct)).ToHashSet();

        // Mevcut seçenekleri text bazında eşleştir; yeni gelen listeye göre yeniden sırala.
        // 1) Yeni listede olmayan ve oy almamış olanları sil.
        // 2) Yeni listede olmayan ama oy almış olanları KORU (sona ekle, sortOrder güncellenir).
        // 3) Yeni listede olan eskileri yeni sırasıyla güncelle.
        // 4) Yeni gelen ve eskide olmayanları yeni seçenek olarak ekle.
        var byTextLookup = new Dictionary<string, PollOption>(StringComparer.OrdinalIgnoreCase);
        foreach (var opt in existingPoll.Options)
        {
            // Çakışma olursa ilkini koru; değişen seçenekler eklenecek.
            byTextLookup.TryAdd(opt.Text, opt);
        }

        var keptOldOptions = new HashSet<Guid>();
        var nextSortOrder = 0;
        foreach (var newText in rawOptions)
        {
            if (byTextLookup.TryGetValue(newText, out var oldOpt))
            {
                oldOpt.SortOrder = nextSortOrder++;
                keptOldOptions.Add(oldOpt.Id);
            }
            else
            {
                _context.PollOptions.Add(new PollOption
                {
                    Id = Guid.NewGuid(),
                    PollId = existingPoll.Id,
                    Text = newText,
                    SortOrder = nextSortOrder++,
                    CreatedByUserId = null,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        // Yeni listede olmayan eskileri ele al.
        foreach (var opt in existingPoll.Options)
        {
            if (keptOldOptions.Contains(opt.Id)) continue;
            if (votedOptionIdsSet.Contains(opt.Id))
            {
                // Oy bütünlüğü: oy almış seçenek silinmez; sona eklenir.
                opt.SortOrder = nextSortOrder++;
            }
            else
            {
                _context.PollOptions.Remove(opt);
            }
        }

        return existingPoll;
    }

    public async Task DeletePollForEntryAsync(Guid entryId, CancellationToken ct = default)
    {
        var poll = await _context.Polls
            .Include(p => p.Options)
            .FirstOrDefaultAsync(p => p.EntryId == entryId, ct);
        if (poll == null) return;
        // PollVotes → Option cascade ile düşer; Poll silinince Option cascade ile düşer.
        _context.Polls.Remove(poll);
    }

    // ── Taslak (jsonb) ↔ DTO köprüsü ────────────────────────────────────────
    public string? SerializeDraftPoll(CreatePollDto? dto)
    {
        if (dto == null) return null;
        // Taslakta yarım doldurulmuş anketleri de tutabilelim diye doğrulama yapmıyoruz.
        return JsonSerializer.Serialize(dto, DraftJsonOptions);
    }

    public CreatePollDto? DeserializeDraftPoll(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<CreatePollDto>(json, DraftJsonOptions);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
