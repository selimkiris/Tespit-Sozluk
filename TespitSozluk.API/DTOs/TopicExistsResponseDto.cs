namespace TespitSozluk.API.DTOs;

/// <summary>GET api/Topics/exists — varlık + yönlendirme için topic id (tek sorgu).</summary>
public sealed record TopicExistsResponseDto(bool Exists, Guid? TopicId);
