using System.ComponentModel.DataAnnotations;

namespace TespitSozluk.API.Entities;

public class Topic
{
    public Guid Id { get; set; }
    [MaxLength(54)]
    public string Title { get; set; } = string.Empty;
    /// <summary>Yazar silindiğinde null olur (Anonim başlık).</summary>
    public Guid? AuthorId { get; set; }
    public User? Author { get; set; }
    public DateTime CreatedAt { get; set; }
    public ICollection<Entry> Entries { get; set; } = new List<Entry>();
}
