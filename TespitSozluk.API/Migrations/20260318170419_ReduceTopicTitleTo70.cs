using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TespitSozluk.API.Migrations
{
    /// <inheritdoc />
    public partial class ReduceTopicTitleTo70 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE ""Topics""
                SET ""Title"" = LEFT(""Title"", 70)
                WHERE LENGTH(""Title"") > 70;
            ");
            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "Topics",
                type: "character varying(70)",
                maxLength: 70,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Title",
                table: "Topics",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(70)",
                oldMaxLength: 70);
        }
    }
}
