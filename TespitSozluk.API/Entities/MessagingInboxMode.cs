namespace TespitSozluk.API.Entities;

/// <summary>Alıcının kabul ettiği özel mesaj kaynağı (yalnızca biri geçerli).</summary>
public enum MessagingInboxMode : byte
{
    /// <summary>Herkesten kabul et.</summary>
    Everyone = 0,

    /// <summary>Çömez (novice) olanlardan kabul etme.</summary>
    EveryoneExceptNovices = 1,

    /// <summary>Yalnızca alıcının takip ettiği kullanıcılardan.</summary>
    OnlyFromUsersIFollow = 2,

    /// <summary>Belirli Level ve üstü (0–10); eşik <see cref="User.MessagingMinLevelThreshold"/>.</summary>
    MinimumLevel = 3,
}
