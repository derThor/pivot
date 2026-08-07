-- Rollback des Seitenbaum-Features (Content-Hierarchie) auf Nutzerwunsch:
-- Organisation läuft ausschließlich über die Navigations-/Menü-Verwaltung,
-- keine eigene Parent-/Child-/Pfad-Struktur mehr direkt am Content.

-- DropForeignKey
ALTER TABLE "contents" DROP CONSTRAINT "contents_parentId_fkey";

-- DropIndex
DROP INDEX "contents_path_locale_key";
DROP INDEX "contents_parentId_idx";

-- AlterTable
ALTER TABLE "contents" DROP COLUMN "parentId",
DROP COLUMN "sortOrder",
DROP COLUMN "path";

-- CreateIndex
CREATE UNIQUE INDEX "contents_slug_locale_key" ON "contents"("slug", "locale");

-- AlterTable
ALTER TABLE "app_settings" DROP COLUMN "homepageContentId";
