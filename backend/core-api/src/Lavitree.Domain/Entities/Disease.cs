using System.Collections.Generic;
using Lavitree.Domain.Common;

namespace Lavitree.Domain.Entities;

public class Disease : BaseEntity
{
    public int Id { get; set; }
    public int PlantId { get; set; }
    public PlantCategory Plant { get; set; } = null!;

    public string ClassCode { get; set; } = string.Empty; // e.g. "Tomato___Early_blight"
    public string CommonNameVi { get; set; } = string.Empty; // "Bệnh đốm vòng cà chua"
    public string PathogenType { get; set; } = "Nấm"; // Nấm / Vi khuẩn / Virus / Khỏe mạnh
    public string Symptoms { get; set; } = string.Empty;
    public string Prevention { get; set; } = string.Empty;
    public int SeverityLevel { get; set; } = 2; // 1: Nhẹ, 2: Vừa, 3: Nghiêm trọng

    // Navigation
    public ICollection<TreatmentPlan> TreatmentPlans { get; set; } = new List<TreatmentPlan>();
    public ICollection<DiseaseProduct> DiseaseProducts { get; set; } = new List<DiseaseProduct>();
    public ICollection<DiagnosisRecord> DiagnosisRecords { get; set; } = new List<DiagnosisRecord>();
}
