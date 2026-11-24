using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Lavitree.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductUsageRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProductUsageRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProductId = table.Column<int>(type: "integer", nullable: false),
                    DiseaseId = table.Column<int>(type: "integer", nullable: true),
                    PlantName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Profile = table.Column<string>(type: "jsonb", nullable: false),
                    ActionGroup = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    SourceUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsVerified = table.Column<bool>(type: "boolean", nullable: false),
                    VerifiedBy = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    VerifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductUsageRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductUsageRules_Diseases_DiseaseId",
                        column: x => x.DiseaseId,
                        principalTable: "Diseases",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ProductUsageRules_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProductUsageRules_DiseaseId",
                table: "ProductUsageRules",
                column: "DiseaseId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductUsageRules_ProductId_DiseaseId_PlantName",
                table: "ProductUsageRules",
                columns: new[] { "ProductId", "DiseaseId", "PlantName" },
                unique: true,
                filter: "\"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductUsageRules");
        }
    }
}
