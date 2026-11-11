using Microsoft.EntityFrameworkCore;
using Lavitree.Domain.Entities;
using Lavitree.Domain.Common;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Lavitree.Infrastructure.Persistence;

public class LavitreeDbContext : DbContext
{
    public LavitreeDbContext(DbContextOptions<LavitreeDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<PlantCategory> PlantCategories => Set<PlantCategory>();
    public DbSet<Disease> Diseases => Set<Disease>();
    public DbSet<TreatmentPlan> TreatmentPlans => Set<TreatmentPlan>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<DiseaseProduct> DiseaseProducts => Set<DiseaseProduct>();
    public DbSet<DiagnosisRecord> DiagnosisRecords => Set<DiagnosisRecord>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<KnowledgeSource> KnowledgeSources => Set<KnowledgeSource>();
    public DbSet<KnowledgeImage> KnowledgeImages => Set<KnowledgeImage>();
    public DbSet<ProductSuggestion> ProductSuggestions => Set<ProductSuggestion>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Product configuration (TASK-15 Pha 3)
        modelBuilder.Entity<Product>(entity =>
        {
            entity.Property(e => e.Availability).HasMaxLength(20).HasDefaultValue("IN_STOCK");
            entity.Property(e => e.MedicineType).HasMaxLength(50).HasDefaultValue("Hóa học");
            entity.Property(e => e.InfoSourceUrl).HasMaxLength(500);
            entity.Property(e => e.ActiveIngredient).HasMaxLength(200);
            entity.ToTable(t =>
            {
                // Chỉ vật tư canh tác (lưới, bẫy...) được thiếu PHI; thuốc hóa học/sinh học bắt buộc có PHI
                t.HasCheckConstraint("CK_Products_PhiDays_RequiredForMedicine",
                    "\"PhiDays\" IS NOT NULL OR \"MedicineType\" = 'Vật tư canh tác'");
                t.HasCheckConstraint("CK_Products_Availability",
                    "\"Availability\" IN ('IN_STOCK', 'OUT_OF_STOCK', 'NOT_SOLD')");
            });
        });

        // ProductSuggestion configuration (TASK-15 Pha 3)
        modelBuilder.Entity<ProductSuggestion>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ModelClass).HasMaxLength(100).IsRequired();
            entity.Property(e => e.MentionText).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Kind).HasMaxLength(20).HasDefaultValue("CHEMICAL");
            entity.Property(e => e.Status).HasMaxLength(20).HasDefaultValue("PENDING");
            entity.HasIndex(e => e.ModelClass);
            entity.HasIndex(e => e.Status);

            entity.HasOne(ps => ps.KnowledgeSource)
                .WithMany(ks => ks.ProductSuggestions)
                .HasForeignKey(ps => ps.KnowledgeSourceId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(ps => ps.Product)
                .WithMany(p => p.ProductSuggestions)
                .HasForeignKey(ps => ps.ProductId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // KnowledgeImage configuration (TASK-15 Pha 2)
        modelBuilder.Entity<KnowledgeImage>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ModelClass).HasMaxLength(100).IsRequired();
            entity.Property(e => e.SourceUrl).HasMaxLength(500).IsRequired();
            entity.Property(e => e.ImageUrl).HasMaxLength(500);
            entity.Property(e => e.StorageKey).HasMaxLength(300);
            entity.Property(e => e.Caption).HasMaxLength(300).IsRequired();
            entity.Property(e => e.PlantPart).HasMaxLength(20).IsRequired();
            entity.Property(e => e.Credit).HasMaxLength(200).IsRequired();
            entity.Property(e => e.LicenseNote).HasMaxLength(200);
            entity.HasIndex(e => e.ModelClass);
        });

        // DiseaseProduct compound primary key
        modelBuilder.Entity<DiseaseProduct>()
            .HasKey(dp => new { dp.DiseaseId, dp.ProductId });

        modelBuilder.Entity<DiseaseProduct>()
            .HasOne(dp => dp.Disease)
            .WithMany(d => d.DiseaseProducts)
            .HasForeignKey(dp => dp.DiseaseId);

        modelBuilder.Entity<DiseaseProduct>()
            .HasOne(dp => dp.Product)
            .WithMany(p => p.DiseaseProducts)
            .HasForeignKey(dp => dp.ProductId);

        // Disease unique class code
        modelBuilder.Entity<Disease>()
            .HasIndex(d => d.ClassCode)
            .IsUnique();

        // User unique email
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = DateTime.UtcNow;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = DateTime.UtcNow;
            }
        }
        return base.SaveChangesAsync(cancellationToken);
    }
}
