-- AlterTable
ALTER TABLE "app_settings" DROP COLUMN "logoExpandedUrl",
DROP COLUMN "logoCollapsedUrl",
DROP COLUMN "authImageUrl",
ADD COLUMN     "companyLogoUrl" TEXT;
