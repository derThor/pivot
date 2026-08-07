-- AlterTable: Startseiten-Einstellung
ALTER TABLE "app_settings" ADD COLUMN "homepageContentId" TEXT;

-- AlterTable: Seitenbaum-Felder
ALTER TABLE "contents" ADD COLUMN "parentId" TEXT,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "path" TEXT NOT NULL DEFAULT '';

-- Backfill: bestehende Inhalte haben noch keinen Parent, ihr Pfad ist
-- also schlicht ihr eigener Slug.
UPDATE "contents" SET "path" = "slug";

-- DropIndex: globale slug+locale-Eindeutigkeit weicht der pfadbasierten
-- Eindeutigkeit (Geschwister unter verschiedenen Parents dürfen denselben
-- Slug haben, die Prüfung dafür läuft auf Anwendungsebene).
DROP INDEX "contents_slug_locale_key";

-- CreateIndex
CREATE UNIQUE INDEX "contents_path_locale_key" ON "contents"("path", "locale");
CREATE INDEX "contents_parentId_idx" ON "contents"("parentId");

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "navigations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navigations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "navigations_slug_key" ON "navigations"("slug");

-- CreateTable
CREATE TABLE "navigation_items" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "externalUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "navigationId" TEXT NOT NULL,
    "contentId" TEXT,
    "parentId" TEXT,

    CONSTRAINT "navigation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "navigation_items_navigationId_idx" ON "navigation_items"("navigationId");
CREATE INDEX "navigation_items_parentId_idx" ON "navigation_items"("parentId");

-- AddForeignKey
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_navigationId_fkey" FOREIGN KEY ("navigationId") REFERENCES "navigations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "navigation_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
