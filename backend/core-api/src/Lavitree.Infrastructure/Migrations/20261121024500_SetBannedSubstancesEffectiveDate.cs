using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lavitree.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SetBannedSubstancesEffectiveDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE ""BannedSubstanceDecisions""
SET ""EffectiveDate"" = '2026-02-10',
    ""Note"" = 'Ký ngày 26/12/2025. Có hiệu lực từ 10/02/2026.'
WHERE ""LegalDocument"" LIKE '%75/2025/TT-BNNMT%';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE ""BannedSubstanceDecisions""
SET ""EffectiveDate"" = NULL
WHERE ""LegalDocument"" LIKE '%75/2025/TT-BNNMT%';
");
        }
    }
}
