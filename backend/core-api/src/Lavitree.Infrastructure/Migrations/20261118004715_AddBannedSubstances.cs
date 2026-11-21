using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Lavitree.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBannedSubstances : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BannedSubstances",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CommonName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Aliases = table.Column<List<string>>(type: "text[]", nullable: false),
                    Category = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "OTHER"),
                    Note = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BannedSubstances", x => x.Id);
                    table.CheckConstraint("CK_BannedSubstances_Category", "\"Category\" IN ('INSECTICIDE', 'FUNGICIDE', 'HERBICIDE', 'RODENTICIDE', 'OTHER')");
                });

            migrationBuilder.CreateTable(
                name: "BannedSubstanceDecisions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    BannedSubstanceId = table.Column<int>(type: "integer", nullable: false),
                    Action = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    LegalDocument = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    EffectiveDate = table.Column<DateOnly>(type: "date", nullable: true),
                    SourceUrl = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Note = table.Column<string>(type: "text", nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BannedSubstanceDecisions", x => x.Id);
                    table.CheckConstraint("CK_BannedSubstanceDecisions_Action", "\"Action\" IN ('BAN', 'UNBAN')");
                    table.ForeignKey(
                        name: "FK_BannedSubstanceDecisions_BannedSubstances_BannedSubstanceId",
                        column: x => x.BannedSubstanceId,
                        principalTable: "BannedSubstances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BannedSubstanceDecisions_BannedSubstanceId",
                table: "BannedSubstanceDecisions",
                column: "BannedSubstanceId");

            migrationBuilder.CreateIndex(
                name: "IX_BannedSubstances_CommonName",
                table: "BannedSubstances",
                column: "CommonName",
                unique: true,
                filter: "\"IsDeleted\" = false");

            // Dữ liệu khởi tạo: Phụ lục II TT 75/2025/TT-BNNMT (31 chất) + 4 chất của danh sách cũ trong code
            // (paraquat, 2,4-D, chlorpyrifos, glyphosate: không có trong Phụ lục II, giữ cấm kèm ghi chú cần bổ sung văn bản).
            // Ngày hiệu lực để trống (= đã hiệu lực) vì chưa có số liệu chắc chắn; Admin bổ sung trên tab Chất cấm.
            migrationBuilder.Sql(@"
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Aldrin', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Lindane', ARRAY['BHC']::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Cadmium compound', ARRAY['cadmium']::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Carbofuran', ARRAY['furadan']::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Chlordane', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Chlordimeform', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('DDT', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Dieldrin', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Endosulfan', ARRAY['thiodan']::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Endrin', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Heptachlor', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Isobenzan', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Isodrin', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Lead (Pb)', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Methamidophos', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Methyl Parathion', ARRAY['parathion-methyl']::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Monocrotophos', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Parathion Ethyl', ARRAY['parathion', 'ethyl parathion']::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Sodium Pentachlorophenate monohydrate', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Pentachlorophenol', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Phosphamidon', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Polychlorocamphene', ARRAY['toxaphene']::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Trichlorfon', ARRAY['chlorophos', 'dipterex']::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Arsenic (As)', ARRAY['arsenic']::text[], 'FUNGICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Captan', ARRAY[]::text[], 'FUNGICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Captafol', ARRAY[]::text[], 'FUNGICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Hexachlorobenzene', ARRAY[]::text[], 'FUNGICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Mercury (Hg)', ARRAY['mercury']::text[], 'FUNGICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Selenium (Se)', ARRAY[]::text[], 'FUNGICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Thallium compound', ARRAY['talium compond', 'thallium']::text[], 'RODENTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('2,4,5-T', ARRAY['2.4.5-t']::text[], 'HERBICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Thông tư 75/2025/TT-BNNMT, Phụ lục II', NULL, NULL, 'Ký ngày 26/12/2025. Ngày hiệu lực: cần bổ sung.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Paraquat', ARRAY['pa-ra-quat', 'para-quat', 'gramoxone']::text[], 'HERBICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Quyết định 278/QĐ-BNN-BVTV (2017)', NULL, NULL, 'Chuyển từ danh sách cũ trong code. Không có trong Phụ lục II TT 75/2025; loại khỏi danh mục được phép theo quyết định này (cần đối chiếu).', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('2,4-D', ARRAY['2.4-d', '2,4d', '2.4d']::text[], 'HERBICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Quyết định 278/QĐ-BNN-BVTV (2017)', NULL, NULL, 'Chuyển từ danh sách cũ trong code. Không có trong Phụ lục II TT 75/2025; loại khỏi danh mục được phép theo quyết định này (cần đối chiếu).', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Chlorpyrifos', ARRAY[]::text[], 'INSECTICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Danh sách cũ trong code LAVITREE (chưa ghi văn bản)', NULL, NULL, 'Không có trong Phụ lục II TT 75/2025. Giữ trạng thái cấm cho an toàn; Admin cần bổ sung số văn bản hoặc thêm quyết định Bỏ cấm.', 'migration', now(), false FROM s;
WITH s AS (INSERT INTO ""BannedSubstances"" (""CommonName"", ""Aliases"", ""Category"", ""Note"", ""CreatedAt"", ""IsDeleted"") VALUES ('Glyphosate', ARRAY[]::text[], 'HERBICIDE', NULL, now(), false) RETURNING ""Id"")
INSERT INTO ""BannedSubstanceDecisions"" (""BannedSubstanceId"", ""Action"", ""LegalDocument"", ""EffectiveDate"", ""SourceUrl"", ""Note"", ""CreatedBy"", ""CreatedAt"", ""IsDeleted"")
SELECT ""Id"", 'BAN', 'Danh sách cũ trong code LAVITREE (chưa ghi văn bản)', NULL, NULL, 'Không có trong Phụ lục II TT 75/2025. Giữ trạng thái cấm cho an toàn; Admin cần bổ sung số văn bản hoặc thêm quyết định Bỏ cấm.', 'migration', now(), false FROM s;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BannedSubstanceDecisions");

            migrationBuilder.DropTable(
                name: "BannedSubstances");
        }
    }
}
