using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TespitSozluk.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTopicTitleIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Topics_Title",
                table: "Topics",
                column: "Title");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Topics_Title",
                table: "Topics");
        }
    }
}
