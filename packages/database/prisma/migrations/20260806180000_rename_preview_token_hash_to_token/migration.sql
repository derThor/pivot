-- Vorschau-Links sollen jederzeit erneut kopiert und verlängert werden
-- können, was mit einem reinen Einweg-Hash nicht möglich ist. Bestehende
-- Zeilen können nicht migriert werden (der Rohwert war aus dem Hash nie
-- rekonstruierbar) und werden daher entfernt statt umbenannt.
DELETE FROM "content_preview_tokens";

-- DropIndex
DROP INDEX "content_preview_tokens_tokenHash_key";

-- AlterTable
ALTER TABLE "content_preview_tokens" DROP COLUMN "tokenHash",
ADD COLUMN "token" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "content_preview_tokens_token_key" ON "content_preview_tokens"("token");
