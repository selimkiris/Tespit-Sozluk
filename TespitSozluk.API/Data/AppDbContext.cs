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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Topic>()
            .HasOne(t => t.Author)
            .WithMany(u => u.Topics)
            .HasForeignKey(t => t.AuthorId)
            .OnDelete(DeleteBehavior.Restrict);

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
    }
}
