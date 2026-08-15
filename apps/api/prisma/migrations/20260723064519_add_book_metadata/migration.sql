-- AlterTable
ALTER TABLE "TrackedItem" ADD COLUMN     "author" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT;

-- CreateIndex
CREATE INDEX "TrackedItem_externalId_idx" ON "TrackedItem"("externalId");
