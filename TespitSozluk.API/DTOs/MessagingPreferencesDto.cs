using TespitSozluk.API.Entities;

namespace TespitSozluk.API.DTOs;

public sealed class MessagingPreferencesDto
{
    public MessagingInboxMode InboxMode { get; set; }
    /// <summary>0–10; yalnızca <see cref="MessagingInboxMode.MinimumLevel"/> için anlamlı.</summary>
    public byte? MinLevelThreshold { get; set; }
}

public sealed class UpdateMessagingPreferencesRequest
{
    public MessagingInboxMode InboxMode { get; set; }
    /// <summary><see cref="MessagingInboxMode.MinimumLevel"/> için 0–10; diğer modlarda yok sayılır.</summary>
    public byte? MinLevelThreshold { get; set; }
}
