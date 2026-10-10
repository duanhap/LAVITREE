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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

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
