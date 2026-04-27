namespace TespitSozluk.API.DTOs;

public sealed class SendPrivateMessageRequest
{
    public Guid RecipientId { get; set; }
    public string Content { get; set; } = string.Empty;
    public Guid? ReferencedEntryId { get; set; }
    public Guid? ReferencedTopicId { get; set; }
}

/// <summary>Alıcının &quot;hangi içerik hakkında&quot; yazıldığını görmesi için özet.</summary>
public sealed class PrivateMessageReferenceDto
{
    public string Kind { get; set; } = "";
    public Guid Id { get; set; }
    public string Title { get; set; } = "";
    public string? TopicTitle { get; set; }
    public string? TopicSlug { get; set; }
    /// <summary>Entry ref iken üst başlık kimliği; topic ref iken başlık kimliği (Id ile aynı olabilir).</summary>
    public Guid? TopicId { get; set; }
    public string? Snippet { get; set; }
}

public sealed class PrivateMessageResponseDto
{
    public Guid Id { get; set; }
    public Guid SenderId { get; set; }
    public string SenderDisplayName { get; set; } = string.Empty;
    public string? SenderAvatar { get; set; }
    public Guid RecipientId { get; set; }
    public string RecipientDisplayName { get; set; } = string.Empty;
    public string? RecipientAvatar { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ReadAtUtc { get; set; }
    public PrivateMessageReferenceDto? Reference { get; set; }
}

/// <summary>Sohbet listesi: karşı taraf, son mesaj özeti, okunmamış adet.</summary>
public sealed class ConversationSummaryDto
{
    public Guid OtherUserId { get; set; }
    public string OtherDisplayName { get; set; } = string.Empty;
    public string? OtherAvatar { get; set; }
    public string LastMessagePreview { get; set; } = string.Empty;
    public DateTime LastMessageAtUtc { get; set; }
    public int UnreadCount { get; set; }
}
