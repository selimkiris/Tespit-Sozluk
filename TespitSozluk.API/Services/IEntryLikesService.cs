using TespitSozluk.API.DTOs;

namespace TespitSozluk.API.Services;

public sealed class EntryUpvotersQueryResult
{
    public bool EntryExists { get; init; }
    public bool RequestorIsAuthor { get; init; }
    public IReadOnlyList<UserSearchResultDto> Upvoters { get; init; } = [];
}

public interface IEntryLikesService
{
    Task<EntryUpvotersQueryResult> GetUpvotersForEntryAuthorAsync(Guid entryId, Guid requestorId);
}
