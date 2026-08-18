-- AlterTable
ALTER TABLE "TrackedItem" ADD COLUMN     "finishedAt" TIMESTAMP(3);

-- 読了日を持たない既存の読了本は、登録時刻を読了日とみなして埋める
UPDATE "TrackedItem" SET "finishedAt" = "createdAt" WHERE "bookStatus" = 'FINISHED' AND "finishedAt" IS NULL;
