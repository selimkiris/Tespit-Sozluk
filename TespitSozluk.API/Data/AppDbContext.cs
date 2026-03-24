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

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username);

        modelBuilder.Entity<Topic>()
            .HasIndex(t => t.CreatedAt);

        modelBuilder.Entity<Entry>()
            .HasIndex(e => e.CreatedAt);
    }
}
