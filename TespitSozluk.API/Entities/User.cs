namespace TespitSozluk.API.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public ICollection<Topic> Topics { get; set; } = new List<Topic>();
    public ICollection<Entry> Entries { get; set; } = new List<Entry>();
}
