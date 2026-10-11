using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lavitree.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddHasCultivationTechniqueToKnowledgeSource : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasCultivationTechnique",
                table: "KnowledgeSources",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HasCultivationTechnique",
                table: "KnowledgeSources");
        }
    }
}
