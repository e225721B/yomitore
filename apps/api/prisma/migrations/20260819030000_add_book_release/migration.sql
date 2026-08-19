-- CreateEnum
CREATE TYPE "ReleaseKind" AS ENUM ('SEQUEL', 'SAME_AUTHOR');

-- CreateTable
CREATE TABLE "BookRelease" (
    "id" TEXT NOT NULL,
    "trackedItemId" TEXT NOT NULL,
    "kind" "ReleaseKind" NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publisher" TEXT,
    "isbn" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "releaseLabel" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),

    CONSTRAINT "BookRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookRelease_trackedItemId_isbn_key" ON "BookRelease"("trackedItemId", "isbn");

-- CreateIndex
CREATE INDEX "BookRelease_seenAt_idx" ON "BookRelease"("seenAt");

-- CreateIndex
CREATE INDEX "BookRelease_releaseDate_idx" ON "BookRelease"("releaseDate");

-- AddForeignKey
ALTER TABLE "BookRelease" ADD CONSTRAINT "BookRelease_trackedItemId_fkey" FOREIGN KEY ("trackedItemId") REFERENCES "TrackedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
