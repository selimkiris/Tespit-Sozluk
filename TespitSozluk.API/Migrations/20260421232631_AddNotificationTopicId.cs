using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TespitSozluk.API.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationTopicId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TopicId",
                table: "Notifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_TopicId",
                table: "Notifications",
                column: "TopicId");

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_Topics_TopicId",
                table: "Notifications",
                column: "TopicId",
                principalTable: "Topics",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_Topics_TopicId",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_TopicId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "TopicId",
                table: "Notifications");
        }
    }
}
