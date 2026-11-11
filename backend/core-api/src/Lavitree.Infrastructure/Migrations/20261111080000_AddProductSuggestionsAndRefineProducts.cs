using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Lavitree.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddProductSuggestionsAndRefineProducts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "PhiDays",
                table: "Products",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AlterColumn<string>(
                name: "MedicineType",
                table: "Products",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "Hóa học",
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "ActiveIngredient",
                table: "Products",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "Availability",
                table: "Products",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "IN_STOCK");

            migrationBuilder.AddColumn<string>(
                name: "InfoSourceUrl",
                table: "Products",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);


            migrationBuilder.CreateTable(
                name: "ProductSuggestions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    KnowledgeSourceId = table.Column<Guid>(type: "uuid", nullable: false),
                    ModelClass = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    MentionText = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "CHEMICAL"),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "PENDING"),
                    ProductId = table.Column<int>(type: "integer", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductSuggestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductSuggestions_KnowledgeSources_KnowledgeSourceId",
                        column: x => x.KnowledgeSourceId,
                        principalTable: "KnowledgeSources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductSuggestions_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            // Dữ liệu cũ: còn hàng -> IN_STOCK, hết hàng -> OUT_OF_STOCK (TASK-15 mục 5.3). PhiDays cũ giữ nguyên.
            migrationBuilder.Sql("UPDATE \"Products\" SET \"Availability\" = CASE WHEN \"StockQuantity\" > 0 THEN 'IN_STOCK' ELSE 'OUT_OF_STOCK' END;");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Products_Availability",
                table: "Products",
                sql: "\"Availability\" IN ('IN_STOCK', 'OUT_OF_STOCK', 'NOT_SOLD')");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Products_PhiDays_RequiredForMedicine",
                table: "Products",
                sql: "\"PhiDays\" IS NOT NULL OR \"MedicineType\" = 'Vật tư canh tác'");


            migrationBuilder.CreateIndex(
                name: "IX_ProductSuggestions_KnowledgeSourceId",
                table: "ProductSuggestions",
                column: "KnowledgeSourceId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductSuggestions_ModelClass",
                table: "ProductSuggestions",
                column: "ModelClass");

            migrationBuilder.CreateIndex(
                name: "IX_ProductSuggestions_ProductId",
                table: "ProductSuggestions",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductSuggestions_Status",
                table: "ProductSuggestions",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.DropTable(
                name: "ProductSuggestions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Products_Availability",
                table: "Products");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Products_PhiDays_RequiredForMedicine",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Availability",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "InfoSourceUrl",
                table: "Products");

            // Vật tư không có PHI/hoạt chất: điền giá trị bảo thủ trước khi trả cột về NOT NULL
            migrationBuilder.Sql("UPDATE \"Products\" SET \"PhiDays\" = 14 WHERE \"PhiDays\" IS NULL;");
            migrationBuilder.Sql("UPDATE \"Products\" SET \"ActiveIngredient\" = '' WHERE \"ActiveIngredient\" IS NULL;");

            migrationBuilder.AlterColumn<int>(
                name: "PhiDays",
                table: "Products",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "MedicineType",
                table: "Products",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50,
                oldDefaultValue: "Hóa học");

            migrationBuilder.AlterColumn<string>(
                name: "ActiveIngredient",
                table: "Products",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200,
                oldNullable: true);
        }
    }
}
