namespace TespitSozluk.API.DTOs;

/// <summary>GET api/Users/exists — varlık + profil linki için kullanıcı id (tek sorgu).</summary>
public sealed record UserExistsResponseDto(bool Exists, Guid? UserId);
