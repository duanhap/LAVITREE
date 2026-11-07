using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lavitree.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMedicineFieldsToProduct : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PhiDays",
                table: "Products",
                type: "integer",
                nullable: false,
                defaultValue: 7);

            migrationBuilder.AddColumn<bool>(
                name: "IsAllowed",
                table: "Products",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "RainResistant",
                table: "Products",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "MedicineType",
                table: "Products",
                type: "text",
                nullable: false,
                defaultValue: "Hóa học");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PhiDays",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "IsAllowed",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "RainResistant",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "MedicineType",
                table: "Products");
        }
    }
}
