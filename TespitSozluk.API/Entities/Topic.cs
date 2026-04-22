using System.ComponentModel.DataAnnotations;

namespace TespitSozluk.API.Entities;

public class Topic
{
    public Guid Id { get; set; }
    [MaxLength(60)]
    public string Title { get; set; } = string.Empty;
    /// <summary>
    /// SEO dostu URL parçası. Başlık + TopicId'nin ilk 6 hex hanesi ile üretilir (Slugify + id-suffix).
    /// Benzersizdir; CreateTopic sırasında doldurulur, eski kayıtlar migration ile geriye dönük doldurulur.
    /// </summary>
    [MaxLength(80)]
    public string Slug { get; set; } = string.Empty;
    /// <summary>Yazar silindiğinde null olur (Anonim başlık).</summary>
    public Guid? AuthorId { get; set; }
    public User? Author { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>Başlık anonim açıldığında API yanıtında yazar gizlenir; AuthorId veritabanında kalır.</summary>
    public bool IsAnonymous { get; set; }
    public ICollection<Entry> Entries { get; set; } = new List<Entry>();
}
