-- CreateEnum
CREATE TYPE "TrackedItemType" AS ENUM ('BOOK', 'INTEREST');

-- CreateTable
CREATE TABLE "TrackedItem" (
    "id" TEXT NOT NULL,
    "type" "TrackedItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackedItem_type_idx" ON "TrackedItem"("type");
