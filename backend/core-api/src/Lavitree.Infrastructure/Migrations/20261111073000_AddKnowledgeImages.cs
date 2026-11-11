using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Lavitree.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddKnowledgeImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "KnowledgeImages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ModelClass = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SourceUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    StorageKey = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Caption = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    PlantPart = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Credit = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    LicenseNote = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    IsManualApproved = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KnowledgeImages", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_KnowledgeImages_ModelClass",
                table: "KnowledgeImages",
                column: "ModelClass");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "KnowledgeImages");
        }
    }
}

