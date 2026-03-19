using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TespitSozluk.API.Migrations
{
    /// <inheritdoc />
    public partial class AddUserAvatarAndHasChangedUsername : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Avatar",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasChangedUsername",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Avatar",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "HasChangedUsername",
                table: "Users");
        }
    }
}
