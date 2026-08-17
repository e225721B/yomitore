-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('WANT', 'FINISHED');

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "topic" TEXT;

-- AlterTable
ALTER TABLE "TrackedItem" ADD COLUMN     "bookStatus" "BookStatus";

-- 既存の本はすべて「気になる本」として登録されていたため WANT で埋める
UPDATE "TrackedItem" SET "bookStatus" = 'WANT' WHERE "type" = 'BOOK' AND "bookStatus" IS NULL;

-- CreateIndex
CREATE INDEX "Content_topic_idx" ON "Content"("topic");

-- CreateIndex
CREATE INDEX "TrackedItem_type_bookStatus_idx" ON "TrackedItem"("type", "bookStatus");
