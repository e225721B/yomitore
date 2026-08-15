-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "embedding" vector(384);

-- AlterTable
ALTER TABLE "TrackedItem" ADD COLUMN     "embedding" vector(384);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "trackedItemId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Match_contentId_idx" ON "Match"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_trackedItemId_contentId_key" ON "Match"("trackedItemId", "contentId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_trackedItemId_fkey" FOREIGN KEY ("trackedItemId") REFERENCES "TrackedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
