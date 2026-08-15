-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "maintenanceModeEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mediaStorageQuotaBytes" BIGINT;

-- AlterTable
ALTER TABLE "webhooks" ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "lastDeliveryError" TEXT,
ADD COLUMN     "lastDeliveryStatus" TEXT;
