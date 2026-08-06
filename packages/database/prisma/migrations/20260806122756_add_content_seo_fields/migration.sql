-- AlterTable
ALTER TABLE "contents" ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "ogDescription" TEXT,
ADD COLUMN     "ogImageUrl" TEXT,
ADD COLUMN     "ogTitle" TEXT,
ADD COLUMN     "robotsFollow" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "robotsIndex" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "twitterCard" TEXT;
