/*
  Warnings:

  - You are about to drop the column `mediaStorageQuotaBytes` on the `app_settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "app_settings" DROP COLUMN "mediaStorageQuotaBytes",
ADD COLUMN     "mediaStorageQuotaMb" INTEGER;
