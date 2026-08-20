-- CreateTable
CREATE TABLE "ContentCollection" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "trackedItemId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentCollection_contentId_trackedItemId_key" ON "ContentCollection"("contentId", "trackedItemId");

-- CreateIndex
CREATE INDEX "ContentCollection_trackedItemId_idx" ON "ContentCollection"("trackedItemId");

-- AddForeignKey
ALTER TABLE "ContentCollection" ADD CONSTRAINT "ContentCollection_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCollection" ADD CONSTRAINT "ContentCollection_trackedItemId_fkey" FOREIGN KEY ("trackedItemId") REFERENCES "TrackedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 既存データの引き継ぎ。
-- 収集元の記録が無いと新着一覧が空になってしまうため、追跡対象起点で集めたコンテンツ
-- （topic を持たないもの）を、最もスコアの高いマッチ1件の追跡対象に割り当てる。
-- あくまで移行用の推測で、以降に収集する分は実際の検索元が正確に記録される。
INSERT INTO "ContentCollection" ("id", "contentId", "trackedItemId", "query", "collectedAt")
SELECT gen_random_uuid(), best."contentId", best."trackedItemId", '(移行時の推定)', c."collectedAt"
FROM (
    SELECT DISTINCT ON (m."contentId") m."contentId", m."trackedItemId"
    FROM "Match" m
    JOIN "Content" mc ON mc.id = m."contentId"
    WHERE mc.topic IS NULL
    ORDER BY m."contentId", m.score DESC
) AS best
JOIN "Content" c ON c.id = best."contentId"
ON CONFLICT ("contentId", "trackedItemId") DO NOTHING;
