using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TespitSozluk.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivateMessageReferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ReferencedEntryId",
                table: "PrivateMessages",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReferencedTopicId",
                table: "PrivateMessages",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PrivateMessages_ReferencedEntryId",
                table: "PrivateMessages",
                column: "ReferencedEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_PrivateMessages_ReferencedTopicId",
                table: "PrivateMessages",
                column: "ReferencedTopicId");

            migrationBuilder.AddForeignKey(
                name: "FK_PrivateMessages_Entries_ReferencedEntryId",
                table: "PrivateMessages",
                column: "ReferencedEntryId",
                principalTable: "Entries",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_PrivateMessages_Topics_ReferencedTopicId",
                table: "PrivateMessages",
                column: "ReferencedTopicId",
                principalTable: "Topics",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PrivateMessages_Entries_ReferencedEntryId",
                table: "PrivateMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_PrivateMessages_Topics_ReferencedTopicId",
                table: "PrivateMessages");

            migrationBuilder.DropIndex(
                name: "IX_PrivateMessages_ReferencedEntryId",
                table: "PrivateMessages");

            migrationBuilder.DropIndex(
                name: "IX_PrivateMessages_ReferencedTopicId",
                table: "PrivateMessages");

            migrationBuilder.DropColumn(
                name: "ReferencedEntryId",
                table: "PrivateMessages");

            migrationBuilder.DropColumn(
                name: "ReferencedTopicId",
                table: "PrivateMessages");
        }
    }
}
