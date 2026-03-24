using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TespitSozluk.API.Migrations
{
    /// <inheritdoc />
    public partial class AddEntryIdToNotification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "EntryId",
                table: "Notifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_EntryId",
                table: "Notifications",
                column: "EntryId");

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Entries_EntryId",
                table: "Notifications",
                column: "EntryId",
                principalTable: "Entries",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Entries_EntryId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_EntryId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "EntryId",
                table: "Notifications");
        }
    }
}
