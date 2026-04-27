using Microsoft.EntityFrameworkCore;
using TespitSozluk.API.Entities;

namespace TespitSozluk.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Topic> Topics { get; set; }
    public DbSet<Entry> Entries { get; set; }
    public DbSet<EntryVote> EntryVotes { get; set; }
    public DbSet<DraftEntry> DraftEntries { get; set; }
    public DbSet<UserSavedEntry> UserSavedEntries { get; set; }
    public DbSet<UserFollow> UserFollows { get; set; }
    public DbSet<UserTopicFollow> UserTopicFollows { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<Report> Reports { get; set; }
    public DbSet<TrafficLog> TrafficLogs { get; set; }
    public DbSet<Poll> Polls { get; set; }
    public DbSet<PollOption> PollOptions { get; set; }
    public DbSet<PollVote> PollVotes { get; set; }
    public DbSet<PrivateMessage> PrivateMessages { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Topic>()
            .HasOne(t => t.Author)
            .WithMany(u => u.Topics)
            .HasForeignKey(t => t.AuthorId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Entry>()
            .HasOne(e => e.Topic)
            .WithMany(t => t.Entries)
            .HasForeignKey(e => e.TopicId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Entry>()
            .HasOne(e => e.Author)
            .WithMany(u => u.Entries)
            .HasForeignKey(e => e.AuthorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Entry>()
            .Property(e => e.Upvotes)
            .HasDefaultValue(0);

        modelBuilder.Entity<Entry>()
            .Property(e => e.Downvotes)
            .HasDefaultValue(0);

        modelBuilder.Entity<User>()
            .Property(u => u.Bio)
            .HasMaxLength(500);

        modelBuilder.Entity<EntryVote>()
            .HasOne(v => v.Entry)
            .WithMany()
            .HasForeignKey(v => v.EntryId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EntryVote>()
            .HasOne(v => v.User)
            .WithMany()
            .HasForeignKey(v => v.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<EntryVote>()
            .HasIndex(v => new { v.EntryId, v.UserId })
            .IsUnique();

        modelBuilder.Entity<DraftEntry>()
            .HasOne(d => d.Author)
            .WithMany()
            .HasForeignKey(d => d.AuthorId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<DraftEntry>()
            .HasOne(d => d.Topic)
            .WithMany()
            .HasForeignKey(d => d.TopicId)
            .OnDelete(DeleteBehavior.SetNull);

        // Anket taslağı: PostgreSQL jsonb kolonu. CreatePollDto JSON serileştirilip saklanır.
        // İlişkisel Poll tablolarına yalnızca yayın anında dönüştürülür.
        modelBuilder.Entity<DraftEntry>()
            .Property(d => d.PollData)
            .HasColumnType("jsonb");

        modelBuilder.Entity<UserSavedEntry>()
            .HasKey(s => new { s.UserId, s.EntryId });

        modelBuilder.Entity<UserSavedEntry>()
            .HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserSavedEntry>()
            .HasOne(s => s.Entry)
            .WithMany()
            .HasForeignKey(s => s.EntryId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserFollow>()
            .HasKey(uf => new { uf.FollowerId, uf.FollowingId });

        modelBuilder.Entity<UserFollow>()
            .HasOne(uf => uf.Follower)
            .WithMany()
            .HasForeignKey(uf => uf.FollowerId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserFollow>()
            .HasOne(uf => uf.Following)
            .WithMany()
            .HasForeignKey(uf => uf.FollowingId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Notification>()
            .HasOne(n => n.User)
            .WithMany()
            .HasForeignKey(n => n.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Notification>()
            .HasOne(n => n.Sender)
            .WithMany()
            .HasForeignKey(n => n.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Notification>()
            .HasOne(n => n.Entry)
            .WithMany()
            .HasForeignKey(n => n.EntryId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Notification>()
            .HasOne(n => n.Topic)
            .WithMany()
            .HasForeignKey(n => n.TopicId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<UserTopicFollow>()
            .HasKey(utf => new { utf.UserId, utf.TopicId });

        modelBuilder.Entity<UserTopicFollow>()
            .HasOne(utf => utf.User)
            .WithMany()
            .HasForeignKey(utf => utf.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserTopicFollow>()
            .HasOne(utf => utf.Topic)
            .WithMany()
            .HasForeignKey(utf => utf.TopicId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Report>()
            .HasOne(r => r.Reporter)
            .WithMany()
            .HasForeignKey(r => r.ReporterId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Report>()
            .HasOne(r => r.ReportedEntry)
            .WithMany()
            .HasForeignKey(r => r.ReportedEntryId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Report>()
            .HasOne(r => r.ReportedTopic)
            .WithMany()
            .HasForeignKey(r => r.ReportedTopicId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Report>()
            .HasOne(r => r.ReportedUser)
            .WithMany()
            .HasForeignKey(r => r.ReportedUserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username);

        modelBuilder.Entity<Topic>()
            .HasIndex(t => t.CreatedAt);

        modelBuilder.Entity<Topic>()
            .HasIndex(t => t.Title);

        modelBuilder.Entity<Topic>()
            .HasIndex(t => t.Slug)
            .IsUnique();

        modelBuilder.Entity<Entry>()
            .HasIndex(e => e.CreatedAt);

        // ── 5651 Sayılı Kanun — Trafik Logları ──────────────────────────────
        // Kullanıcı silindiğinde loglar KESİNLİKLE silinmez; UserId null'a çekilir.
        modelBuilder.Entity<TrafficLog>()
            .HasOne(tl => tl.User)
            .WithMany()
            .HasForeignKey(tl => tl.UserId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<TrafficLog>()
            .HasIndex(tl => tl.TimestampUtc);

        modelBuilder.Entity<TrafficLog>()
            .HasIndex(tl => tl.IpAddress);

        // ── Anket (Poll) Modülü ─────────────────────────────────────────────
        // Her Entry en fazla 1 ankete sahip olabilir (1:1). Entry silinirse Poll
        // ve tüm PollOption/PollVote satırları cascade ile silinir. Bu sayede
        // entry deletion servisi veya topic cascade'i dışında ek temizlik gerekmez.
        modelBuilder.Entity<Poll>()
            .HasOne(p => p.Entry)
            .WithOne(e => e.Poll)
            .HasForeignKey<Poll>(p => p.EntryId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Poll>()
            .HasIndex(p => p.EntryId)
            .IsUnique();

        modelBuilder.Entity<Poll>()
            .Property(p => p.Question)
            .HasMaxLength(500);

        modelBuilder.Entity<PollOption>()
            .HasOne(o => o.Poll)
            .WithMany(p => p.Options)
            .HasForeignKey(o => o.PollId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PollOption>()
            .Property(o => o.Text)
            .HasMaxLength(300)
            .IsRequired();

        modelBuilder.Entity<PollOption>()
            .HasIndex(o => new { o.PollId, o.SortOrder });

        // Kullanıcı silinirse, eklediği seçenek korunur (SetNull). Oylama gizliliği
        // üzerinde etkisi yoktur; seçenek yine kimliksiz olarak sayılır.
        modelBuilder.Entity<PollOption>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(o => o.CreatedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Oy: Seçenek silinirse cascade ile temizlenir; Poll→Option→Vote zinciriyle
        // Poll silindiğinde de tüm oylar düşer.
        modelBuilder.Entity<PollVote>()
            .HasOne(v => v.Option)
            .WithMany(o => o.Votes)
            .HasForeignKey(v => v.PollOptionId)
            .OnDelete(DeleteBehavior.Cascade);

        // Poll↔Vote: cascade zinciri yalnızca Option üzerinden gitmeli; iki yollu
        // cascade PostgreSQL'de çoklu yol hatası verir. Poll tarafını Restrict yap
        // (fiili silme PollOption cascade'i ile gerçekleşir).
        modelBuilder.Entity<PollVote>()
            .HasOne(v => v.Poll)
            .WithMany(p => p.Votes)
            .HasForeignKey(v => v.PollId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<PollVote>()
            .HasOne(v => v.User)
            .WithMany()
            .HasForeignKey(v => v.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Çifte oy engeli (aynı seçeneğe ikinci kez oy atılamaz).
        modelBuilder.Entity<PollVote>()
            .HasIndex(v => new { v.PollOptionId, v.UserId })
            .IsUnique();

        // Toplam oy / "kullanıcı bu ankette oyladı mı?" sorguları için hızlı lookup.
        modelBuilder.Entity<PollVote>()
            .HasIndex(v => new { v.PollId, v.UserId });

        // ── Özel mesajlar (asenkron) ───────────────────────────────────────
        modelBuilder.Entity<PrivateMessage>()
            .HasOne(m => m.Sender)
            .WithMany()
            .HasForeignKey(m => m.SenderId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PrivateMessage>()
            .HasOne(m => m.Recipient)
            .WithMany()
            .HasForeignKey(m => m.RecipientId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PrivateMessage>()
            .Property(m => m.Content)
            .HasMaxLength(10_000)
            .IsRequired();

        modelBuilder.Entity<PrivateMessage>()
            .HasIndex(m => new { m.RecipientId, m.CreatedAtUtc });

        modelBuilder.Entity<PrivateMessage>()
            .HasIndex(m => new { m.SenderId, m.CreatedAtUtc });

        modelBuilder.Entity<PrivateMessage>()
            .HasOne(m => m.ReferencedEntry)
            .WithMany()
            .HasForeignKey(m => m.ReferencedEntryId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<PrivateMessage>()
            .HasOne(m => m.ReferencedTopic)
            .WithMany()
            .HasForeignKey(m => m.ReferencedTopicId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<User>()
            .Property(u => u.MessagingInboxMode)
            .HasDefaultValue(MessagingInboxMode.Everyone);
    }
}
