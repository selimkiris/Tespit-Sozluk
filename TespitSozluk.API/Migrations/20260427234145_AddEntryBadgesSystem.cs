using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TespitSozluk.API.Migrations
{
    /// <inheritdoc />
    public partial class AddEntryBadgesSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EntryBadges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    GiverUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    BadgeType = table.Column<byte>(type: "smallint", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EntryBadges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EntryBadges_Entries_EntryId",
                        column: x => x.EntryId,
                        principalTable: "Entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EntryBadges_Users_GiverUserId",
                        column: x => x.GiverUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EntryBadges_EntryId",
                table: "EntryBadges",
                column: "EntryId");

            migrationBuilder.CreateIndex(
                name: "IX_EntryBadges_EntryId_GiverUserId_BadgeType",
                table: "EntryBadges",
                columns: new[] { "EntryId", "GiverUserId", "BadgeType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EntryBadges_GiverUserId_BadgeType_AssignedAt",
                table: "EntryBadges",
                columns: new[] { "GiverUserId", "BadgeType", "AssignedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EntryBadges");
        }
    }
}
