"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { deleteTrackedItem, fetchTrackedItem, updateTrackedItem } from "@/lib/api";
import type { TrackedItem } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";
import { formatDate } from "@/lib/date";
import { ContentFeed } from "@/components/feed/ContentFeed";

export default function TrackedItemDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [item, setItem] = useState<TrackedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchTrackedItem(id)
      .then(setItem)
      .catch((e) => setError(e instanceof Error ? e.message : "取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!item) return;
    await deleteTrackedItem(item.id).catch(() => null);
    router.push("/");
  }

  async function handleToggleStatus() {
    if (!item) return;
    const next = item.bookStatus === "FINISHED" ? "WANT" : "FINISHED";
    try {
      setItem(await updateTrackedItem(item.id, { bookStatus: next }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    }
  }

  return (
    <main>
      <Link href="/" className="back-link">
        ← ダッシュボードに戻る
      </Link>

      {loading && <p className="empty">読み込み中...</p>}
      {error && <p className="error">{error}</p>}

      {item && (
        <div className="category-panel" data-category={item.category}>
          <div className="detail-header">
            {item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="detail-thumb" src={item.thumbnailUrl} alt="" />
            ) : (
              <div className="detail-thumb detail-thumb-placeholder" aria-hidden />
            )}
            <div className="detail-info">
              <span className="badge category-badge">
                {CATEGORY_META[item.category].emoji} {CATEGORY_META[item.category].heading}
              </span>
              <h1>{item.title}</h1>
              {item.author && <p className="detail-author">{item.author}</p>}
              {item.finishedAt && <p className="detail-author">{formatDate(item.finishedAt)}に読了</p>}
              {item.note && <p className="item-note">{item.note}</p>}
            </div>
            <div className="item-actions">
              {item.type === "BOOK" && (
                <button type="button" className="status-btn" onClick={handleToggleStatus}>
                  {item.bookStatus === "FINISHED" ? "気になるに戻す" : "読み終わった"}
                </button>
              )}
              <button className="delete-btn" onClick={handleDelete}>
                削除
              </button>
            </div>
          </div>

          <ContentFeed trackedItemId={item.id} heading="関連する新着コンテンツ" />
        </div>
      )}
    </main>
  );
}
