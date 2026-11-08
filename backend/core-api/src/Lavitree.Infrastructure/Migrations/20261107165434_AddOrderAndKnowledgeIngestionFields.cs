using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lavitree.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderAndKnowledgeIngestionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsVerbatim",
                table: "KnowledgeSources",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "UnitType",
                table: "KnowledgeSources",
                type: "text",
                nullable: false,
                defaultValue: "SUMMARY");

            migrationBuilder.AddColumn<string>(
                name: "ConfusionGroup",
                table: "DiagnosisRecords",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExpertNotes",
                table: "DiagnosisRecords",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ExpertReviewedAt",
                table: "DiagnosisRecords",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequiresExpert",
                table: "DiagnosisRecords",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Top3Json",
                table: "DiagnosisRecords",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsVerbatim",
                table: "KnowledgeSources");

            migrationBuilder.DropColumn(
                name: "UnitType",
                table: "KnowledgeSources");

            migrationBuilder.DropColumn(
                name: "ConfusionGroup",
                table: "DiagnosisRecords");

            migrationBuilder.DropColumn(
                name: "ExpertNotes",
                table: "DiagnosisRecords");

            migrationBuilder.DropColumn(
                name: "ExpertReviewedAt",
                table: "DiagnosisRecords");

            migrationBuilder.DropColumn(
                name: "RequiresExpert",
                table: "DiagnosisRecords");

            migrationBuilder.DropColumn(
                name: "Top3Json",
                table: "DiagnosisRecords");
        }
    }
}
