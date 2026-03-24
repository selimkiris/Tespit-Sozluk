using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TespitSozluk.API.Migrations
{
    /// <inheritdoc />
    public partial class AddUsernameAndCreatedAtIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username");

            migrationBuilder.CreateIndex(
                name: "IX_Topics_CreatedAt",
                table: "Topics",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Entries_CreatedAt",
                table: "Entries",
                column: "CreatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_Username",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Topics_CreatedAt",
                table: "Topics");

            migrationBuilder.DropIndex(
                name: "IX_Entries_CreatedAt",
                table: "Entries");
        }
    }
}
