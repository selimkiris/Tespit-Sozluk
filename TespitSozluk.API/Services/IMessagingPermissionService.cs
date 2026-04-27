namespace TespitSozluk.API.Services;

public interface IMessagingPermissionService
{
    /// <summary>
    /// Gönderenin alıcıya mesaj atmasına, alıcının tercihlerine göre izin var mı kontrol eder.
    /// </summary>
    Task<MessagingSendEvaluation> EvaluateSendAsync(
        Guid senderId,
        Guid recipientId,
        CancellationToken cancellationToken = default);
}

public sealed class MessagingSendEvaluation
{
    public bool IsAllowed { get; init; }
    /// <summary>Alıcı yok</summary>
    public bool RecipientNotFound { get; init; }
    public string? DenyMessage { get; init; }
}
