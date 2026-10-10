namespace Lavitree.Domain.Entities;

public class DiseaseProduct
{
    public int DiseaseId { get; set; }
    public Disease Disease { get; set; } = null!;

    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
}
