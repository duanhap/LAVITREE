using System.Collections.Generic;
using Lavitree.Domain.Common;

namespace Lavitree.Domain.Entities;

public class PlantCategory : BaseEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty; // Cà chua, Khoai tây, Ngô...
    public string? ScientificName { get; set; }
    public string? IconUrl { get; set; }

    // Navigation
    public ICollection<Disease> Diseases { get; set; } = new List<Disease>();
}
