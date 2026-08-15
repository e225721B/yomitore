-- CreateEnum
CREATE TYPE "ContentSource" AS ENUM ('YOUTUBE');

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "source" "ContentSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "channelTitle" TEXT,
    "publishedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Content_source_sourceId_key" ON "Content"("source", "sourceId");
