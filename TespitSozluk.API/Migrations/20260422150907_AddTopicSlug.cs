using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TespitSozluk.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTopicSlug : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) Kolonu ekle (unique index olmadan; önce doldurmamız gerek)
            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "Topics",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            // 2) Mevcut satırları Title + Id'nin ilk 6 hex hanesi ile geriye dönük doldur.
            //    Türkçe karakter dönüşümü translate() ile 1:1 yapılır; sonra lower + regex ile
            //    tire-ayraçlı slug üretilir. Id-suffix sayesinde benzersizlik garantilidir.
            migrationBuilder.Sql(@"
                UPDATE ""Topics"" AS t
                SET ""Slug"" = CASE
                        WHEN trim(both '-' from substring(
                                regexp_replace(
                                    lower(translate(t.""Title"",
                                        'çÇğĞıIİöÖşŞüÜ',
                                        'ccggiiioossuu'
                                    )),
                                    '[^a-z0-9]+', '-', 'g'
                                )
                                from 1 for 60
                            )) = ''
                        THEN 'baslik'
                        ELSE trim(both '-' from substring(
                                regexp_replace(
                                    lower(translate(t.""Title"",
                                        'çÇğĞıIİöÖşŞüÜ',
                                        'ccggiiioossuu'
                                    )),
                                    '[^a-z0-9]+', '-', 'g'
                                )
                                from 1 for 60
                            ))
                     END
                     || '-' || substr(replace(t.""Id""::text, '-', ''), 1, 6)
                WHERE ""Slug"" IS NULL OR ""Slug"" = '';
            ");

            // 3) Unique index — artık tüm satırlar benzersiz slug içerdiği için güvenle eklenebilir
            migrationBuilder.CreateIndex(
                name: "IX_Topics_Slug",
                table: "Topics",
                column: "Slug",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Topics_Slug",
                table: "Topics");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "Topics");
        }
    }
}
