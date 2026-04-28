namespace TespitSozluk.API.Entities;

/// <summary>
/// Yazarın bir entry'ye takabileceği rozet türleri. 7 sabit değer.
/// Sayısal değerler veritabanında kalıcıdır; mevcut rozetleri kırmamak için
/// bu enum'a ekleme yaparken yeni değerleri sona ekleyin, var olanları
/// yeniden numaralandırmayın.
/// </summary>
public enum BadgeType : byte
{
    /// <summary>En komik.</summary>
    EnKomik = 0,

    /// <summary>İyi anlatım.</summary>
    IyiAnlatim = 1,

    /// <summary>Bilgilendirici.</summary>
    Bilgilendirici = 2,

    /// <summary>İyi tespit.</summary>
    IyiTespit = 3,

    /// <summary>Cesur.</summary>
    Cesur = 4,

    /// <summary>Felsefi.</summary>
    Felsefi = 5,

    /// <summary>Samimi.</summary>
    Samimi = 6,
}
