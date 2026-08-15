"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { deleteTrackedItem, fetchTrackedItem } from "@/lib/api";
import type { TrackedItem, TrackedItemType } from "@/lib/types";
import { ContentFeed } from "@/app/ContentFeed";

const TYPE_LABEL: Record<TrackedItemType, string> = {
  BOOK: "本",
  INTEREST: "興味分野",
};

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

  return (
    <main>
      <Link href="/" className="back-link">
        ← ダッシュボードに戻る
      </Link>

      {loading && <p className="empty">読み込み中...</p>}
      {error && <p className="error">{error}</p>}

      {item && (
        <>
          <div className="detail-header">
            {item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="detail-thumb" src={item.thumbnailUrl} alt="" />
            ) : (
              <div className="detail-thumb detail-thumb-placeholder" aria-hidden />
            )}
            <div className="detail-info">
              <span className="badge">{TYPE_LABEL[item.type]}</span>
              <h1>{item.title}</h1>
              {item.author && <p className="detail-author">{item.author}</p>}
              {item.note && <p className="item-note">{item.note}</p>}
            </div>
            <button className="delete-btn" onClick={handleDelete}>
              削除
            </button>
          </div>

          <ContentFeed trackedItemId={item.id} heading="関連する新着コンテンツ" />
        </>
      )}
    </main>
  );
}
