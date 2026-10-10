using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lavitree.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMetadataFieldsToKnowledgeSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MatchLevel",
                table: "KnowledgeSources",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PublishedDate",
                table: "KnowledgeSources",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MatchLevel",
                table: "KnowledgeSources");

            migrationBuilder.DropColumn(
                name: "PublishedDate",
                table: "KnowledgeSources");
        }
    }
}
