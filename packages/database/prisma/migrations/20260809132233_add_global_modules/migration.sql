-- CreateTable
CREATE TABLE "global_modules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "moduleTypeId" TEXT NOT NULL,

    CONSTRAINT "global_modules_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "global_modules" ADD CONSTRAINT "global_modules_moduleTypeId_fkey" FOREIGN KEY ("moduleTypeId") REFERENCES "module_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
