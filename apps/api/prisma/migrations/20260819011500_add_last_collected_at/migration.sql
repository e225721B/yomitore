-- AlterTable
ALTER TABLE "TrackedItem" ADD COLUMN     "lastCollectedAt" TIMESTAMP(3);

-- 既存の追跡対象は「まだ収集していない」扱い（NULL）のままにする。
-- 次回の収集で1度だけ全件が対象になり、以降はクールダウンが効く。