-- CreateTable
CREATE TABLE "content_preview_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "content_preview_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_preview_tokens_tokenHash_key" ON "content_preview_tokens"("tokenHash");

-- AddForeignKey
ALTER TABLE "content_preview_tokens" ADD CONSTRAINT "content_preview_tokens_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_preview_tokens" ADD CONSTRAINT "content_preview_tokens_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
