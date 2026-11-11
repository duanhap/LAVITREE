using System;
using Lavitree.Domain.Common;

namespace Lavitree.Domain.Entities;

public class ProductSuggestion : BaseEntity
{
    public int Id { get; set; }
    public Guid KnowledgeSourceId { get; set; }
    public string ModelClass { get; set; } = string.Empty;
    public string MentionText { get; set; } = string.Empty;
    public string Kind { get; set; } = "CHEMICAL"; // CHEMICAL | BIOLOGICAL | SUPPLY | PRACTICE
    public string Status { get; set; } = "PENDING"; // PENDING | ADDED | LINKED | DISMISSED
    public int? ProductId { get; set; }
    public DateTime? ResolvedAt { get; set; }

    // Navigation
    public KnowledgeSource? KnowledgeSource { get; set; }
    public Product? Product { get; set; }
}

