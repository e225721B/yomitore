"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteTrackedItem, fetchTrackedItems } from "@/lib/api";
import type { TrackedItem, TrackedItemType } from "@/lib/types";
import { AddTrackedItemSection } from "./AddTrackedItemSection";
import { ContentFeed } from "./ContentFeed";
import { TrendingSection } from "./TrendingSection";

const TYPE_LABEL: Record<TrackedItemType, string> = {
  BOOK: "本",
  INTEREST: "興味分野",
};

export function Dashboard() {
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrackedItems()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteTrackedItem(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  const existingExternalIds = items.map((i) => i.externalId).filter((v): v is string => !!v);

  return (
    <main>
      <h1>ヨミトレ</h1>
      <p className="subtitle">気になる本・興味分野を登録して、話題を探す</p>

      <AddTrackedItemSection
        existingExternalIds={existingExternalIds}
        onAdded={(item) => setItems((prev) => [item, ...prev])}
      />

      <h2>気になる本</h2>
      {loading ? (
        <p className="empty">読み込み中...</p>
      ) : items.length === 0 ? (
        <p className="empty">まだ追跡対象がありません。上のフォームから登録してください。</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <span className="badge">{TYPE_LABEL[item.type]}</span>
              <Link href={`/tracked/${item.id}`} className="item-title tracked-link">
                {item.title}
              </Link>
              {item.note && <span className="item-note">{item.note}</span>}
              <button className="delete-btn" onClick={() => handleDelete(item.id)}>
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="error">{error}</p>}

      <TrendingSection />
      <ContentFeed />
    </main>
  );
}
