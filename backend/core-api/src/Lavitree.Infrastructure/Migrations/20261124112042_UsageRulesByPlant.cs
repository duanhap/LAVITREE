using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lavitree.Infrastructure.Migrations
{
    /// <summary>
    /// TASK-29: liều theo cây / bệnh chuyển hẳn sang bảng ProductUsageRules.
    /// - Thêm PlantId (FK PlantCategories, bắt buộc) thay PlantName, thêm DosageInstruction.
    /// - Chuyển Products.UsageProfile.disease_rules / plant_rules (JSON) thành dòng trong bảng rồi xóa khỏi JSON.
    /// - Các liều riêng giống hệt nhau của cùng một cây được gộp thành 1 liều chung của cây
    ///   (kết quả của nút "Đồng bộ cho n bệnh" cũ).
    /// - Dòng nào không xác định được cây thì DỪNG migration (không đoán).
    /// Down chỉ khôi phục cấu trúc bảng; dữ liệu JSON cũ không dựng lại (sao lưu trước khi áp lên DB thật).
    /// </summary>
    public partial class UsageRulesByPlant : Migration
    {
        // Tên cây so khớp: bỏ khoảng trắng hai đầu, chữ thường, bỏ tiền tố "cây ".
        private const string NormPlant = "regexp_replace(lower(trim({0})), '^cây\\s+', '')";

        private static string Norm(string column) => string.Format(NormPlant, column);

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProductUsageRules_Diseases_DiseaseId",
                table: "ProductUsageRules");

            migrationBuilder.DropIndex(
                name: "IX_ProductUsageRules_ProductId_DiseaseId_PlantName",
                table: "ProductUsageRules");

            migrationBuilder.AddColumn<string>(
                name: "DosageInstruction",
                table: "ProductUsageRules",
                type: "text",
                nullable: true);

            // Tạm cho phép null để điền dữ liệu, đặt NOT NULL ở cuối
            migrationBuilder.AddColumn<int>(
                name: "PlantId",
                table: "ProductUsageRules",
                type: "integer",
                nullable: true);

            // 1. PlantId cho các dòng đã có: theo cây của bệnh, không có bệnh thì theo tên cây
            migrationBuilder.Sql(@"
UPDATE ""ProductUsageRules"" r
SET ""PlantId"" = d.""PlantId""
FROM ""Diseases"" d
WHERE r.""DiseaseId"" = d.""Id"";");

            migrationBuilder.Sql($@"
UPDATE ""ProductUsageRules"" r
SET ""PlantId"" = pc.""Id""
FROM ""PlantCategories"" pc
WHERE r.""PlantId"" IS NULL
  AND r.""PlantName"" IS NOT NULL
  AND {Norm(@"r.""PlantName""")} = {Norm(@"pc.""Name""")};");

            migrationBuilder.Sql(@"
DELETE FROM ""ProductUsageRules"" WHERE ""PlantId"" IS NULL AND ""IsDeleted"" = true;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ""ProductUsageRules"" WHERE ""PlantId"" IS NULL) THEN
    RAISE EXCEPTION 'TASK-29: con lieu chua xac dinh duoc cay trong (PlantName khong khop PlantCategories). Sua du lieu roi chay lai.';
  END IF;
END $$;");

            // 2. Bỏ khóa disease_rules / plant_rules lồng trong Profile của các dòng đã có
            migrationBuilder.Sql(@"
UPDATE ""ProductUsageRules""
SET ""Profile"" = ""Profile"" - 'disease_rules' - 'plant_rules'
WHERE jsonb_typeof(""Profile"") = 'object' AND (""Profile"" ? 'disease_rules' OR ""Profile"" ? 'plant_rules');");

            // 3. disease_rules trong JSON → đoạn chữ cho dòng đã có; mục chưa có dòng → tạo liều riêng của bệnh
            migrationBuilder.Sql(@"
UPDATE ""ProductUsageRules"" r
SET ""DosageInstruction"" = NULLIF(trim(e.value->>'dosage_instruction'), '')
FROM ""Products"" p
CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(p.""UsageProfile""->'disease_rules') = 'object'
                                   THEN p.""UsageProfile""->'disease_rules' ELSE '{}'::jsonb END) e
JOIN ""Diseases"" d ON lower(d.""ClassCode"") = lower(e.key)
WHERE r.""ProductId"" = p.""Id"" AND r.""DiseaseId"" = d.""Id""
  AND r.""IsDeleted"" = false AND r.""DosageInstruction"" IS NULL
  AND jsonb_typeof(e.value) = 'object';");

            migrationBuilder.Sql(@"
INSERT INTO ""ProductUsageRules""
  (""ProductId"", ""PlantId"", ""DiseaseId"", ""DosageInstruction"", ""Profile"", ""SourceUrl"", ""IsVerified"", ""CreatedAt"", ""UpdatedAt"", ""IsDeleted"")
SELECT DISTINCT ON (p.""Id"", d.""Id"")
  p.""Id"", d.""PlantId"", d.""Id"",
  NULLIF(trim(e.value->>'dosage_instruction'), ''),
  CASE WHEN jsonb_typeof(e.value->'usage_profile') = 'object'
       THEN (e.value->'usage_profile') - 'disease_rules' - 'plant_rules' ELSE '{}'::jsonb END,
  NULLIF(left(trim(coalesce(e.value->>'source_url', '')), 500), ''),
  false, now(), now(), false
FROM ""Products"" p
CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(p.""UsageProfile""->'disease_rules') = 'object'
                                   THEN p.""UsageProfile""->'disease_rules' ELSE '{}'::jsonb END) e
JOIN ""Diseases"" d ON lower(d.""ClassCode"") = lower(e.key) AND d.""IsDeleted"" = false
WHERE jsonb_typeof(e.value) = 'object'
  AND (NULLIF(trim(e.value->>'dosage_instruction'), '') IS NOT NULL OR jsonb_typeof(e.value->'usage_profile') = 'object')
  AND NOT EXISTS (SELECT 1 FROM ""ProductUsageRules"" r
                  WHERE r.""ProductId"" = p.""Id"" AND r.""DiseaseId"" = d.""Id"" AND r.""IsDeleted"" = false)
ORDER BY p.""Id"", d.""Id"";");

            // 4. plant_rules trong JSON → liều chung của cây (nếu cây chưa có)
            migrationBuilder.Sql($@"
INSERT INTO ""ProductUsageRules""
  (""ProductId"", ""PlantId"", ""DiseaseId"", ""DosageInstruction"", ""Profile"", ""SourceUrl"", ""IsVerified"", ""CreatedAt"", ""UpdatedAt"", ""IsDeleted"")
SELECT DISTINCT ON (p.""Id"", pc.""Id"")
  p.""Id"", pc.""Id"", NULL,
  NULLIF(trim(e.value->>'dosage_instruction'), ''),
  CASE WHEN jsonb_typeof(e.value->'usage_profile') = 'object'
       THEN (e.value->'usage_profile') - 'disease_rules' - 'plant_rules' ELSE '{{}}'::jsonb END,
  NULLIF(left(trim(coalesce(e.value->>'source_url', '')), 500), ''),
  false, now(), now(), false
FROM ""Products"" p
CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(p.""UsageProfile""->'plant_rules') = 'object'
                                   THEN p.""UsageProfile""->'plant_rules' ELSE '{{}}'::jsonb END) e
JOIN ""PlantCategories"" pc ON {Norm(@"pc.""Name""")} = {Norm("e.key")}
WHERE jsonb_typeof(e.value) = 'object'
  AND (NULLIF(trim(e.value->>'dosage_instruction'), '') IS NOT NULL OR jsonb_typeof(e.value->'usage_profile') = 'object')
  AND NOT EXISTS (SELECT 1 FROM ""ProductUsageRules"" r
                  WHERE r.""ProductId"" = p.""Id"" AND r.""PlantId"" = pc.""Id"" AND r.""DiseaseId"" IS NULL AND r.""IsDeleted"" = false)
ORDER BY p.""Id"", pc.""Id"";");

            // 5. Cây chưa có liều chung mà mọi liều riêng của nó giống hệt nhau → gộp thành 1 liều chung
            migrationBuilder.Sql(@"
CREATE TEMP TABLE _t29_collapse AS
SELECT r.""ProductId"", r.""PlantId"",
       (array_agg(r.""Id"" ORDER BY r.""IsVerified"" DESC, r.""Id""))[1] AS keep_id
FROM ""ProductUsageRules"" r
WHERE r.""IsDeleted"" = false AND r.""DiseaseId"" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ""ProductUsageRules"" c
                  WHERE c.""ProductId"" = r.""ProductId"" AND c.""PlantId"" = r.""PlantId""
                    AND c.""DiseaseId"" IS NULL AND c.""IsDeleted"" = false)
GROUP BY r.""ProductId"", r.""PlantId""
HAVING count(DISTINCT (coalesce(trim(r.""DosageInstruction""), ''), r.""Profile"")) = 1;

UPDATE ""ProductUsageRules"" r
SET ""IsDeleted"" = true, ""UpdatedAt"" = now()
FROM _t29_collapse g
WHERE r.""ProductId"" = g.""ProductId"" AND r.""PlantId"" = g.""PlantId""
  AND r.""DiseaseId"" IS NOT NULL AND r.""IsDeleted"" = false AND r.""Id"" <> g.keep_id;

UPDATE ""ProductUsageRules"" r
SET ""DiseaseId"" = NULL, ""UpdatedAt"" = now()
FROM _t29_collapse g
WHERE r.""Id"" = g.keep_id;

DROP TABLE _t29_collapse;");

            // 6. Xóa disease_rules / plant_rules khỏi phiếu bao bì của sản phẩm
            migrationBuilder.Sql(@"
UPDATE ""Products""
SET ""UsageProfile"" = ""UsageProfile"" - 'disease_rules' - 'plant_rules'
WHERE jsonb_typeof(""UsageProfile"") = 'object'
  AND (""UsageProfile"" ? 'disease_rules' OR ""UsageProfile"" ? 'plant_rules');");

            // 7. Chốt cấu trúc
            migrationBuilder.DropColumn(
                name: "PlantName",
                table: "ProductUsageRules");

            migrationBuilder.AlterColumn<int>(
                name: "PlantId",
                table: "ProductUsageRules",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductUsageRules_PlantId",
                table: "ProductUsageRules",
                column: "PlantId");

            migrationBuilder.CreateIndex(
                name: "UX_ProductUsageRules_DiseaseOverride",
                table: "ProductUsageRules",
                columns: new[] { "ProductId", "DiseaseId" },
                unique: true,
                filter: "\"IsDeleted\" = false AND \"DiseaseId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "UX_ProductUsageRules_PlantDefault",
                table: "ProductUsageRules",
                columns: new[] { "ProductId", "PlantId" },
                unique: true,
                filter: "\"IsDeleted\" = false AND \"DiseaseId\" IS NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductUsageRules_Diseases_DiseaseId",
                table: "ProductUsageRules",
                column: "DiseaseId",
                principalTable: "Diseases",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductUsageRules_PlantCategories_PlantId",
                table: "ProductUsageRules",
                column: "PlantId",
                principalTable: "PlantCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProductUsageRules_Diseases_DiseaseId",
                table: "ProductUsageRules");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductUsageRules_PlantCategories_PlantId",
                table: "ProductUsageRules");

            migrationBuilder.DropIndex(
                name: "IX_ProductUsageRules_PlantId",
                table: "ProductUsageRules");

            migrationBuilder.DropIndex(
                name: "UX_ProductUsageRules_DiseaseOverride",
                table: "ProductUsageRules");

            migrationBuilder.DropIndex(
                name: "UX_ProductUsageRules_PlantDefault",
                table: "ProductUsageRules");

            migrationBuilder.AddColumn<string>(
                name: "PlantName",
                table: "ProductUsageRules",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.Sql(@"
UPDATE ""ProductUsageRules"" r
SET ""PlantName"" = left(pc.""Name"", 100)
FROM ""PlantCategories"" pc
WHERE r.""PlantId"" = pc.""Id"";");

            migrationBuilder.DropColumn(
                name: "DosageInstruction",
                table: "ProductUsageRules");

            migrationBuilder.DropColumn(
                name: "PlantId",
                table: "ProductUsageRules");

            migrationBuilder.CreateIndex(
                name: "IX_ProductUsageRules_ProductId_DiseaseId_PlantName",
                table: "ProductUsageRules",
                columns: new[] { "ProductId", "DiseaseId", "PlantName" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.AddForeignKey(
                name: "FK_ProductUsageRules_Diseases_DiseaseId",
                table: "ProductUsageRules",
                column: "DiseaseId",
                principalTable: "Diseases",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
