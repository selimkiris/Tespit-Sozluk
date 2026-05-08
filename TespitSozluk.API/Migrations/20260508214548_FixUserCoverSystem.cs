using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TespitSozluk.API.Migrations
{
    /// <inheritdoc />
    public partial class FixUserCoverSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CoverChoiceKey",
                table: "Users",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CoverUrl",
                table: "Users",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CoverChoiceKey",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "CoverUrl",
                table: "Users");
        }
    }
}
