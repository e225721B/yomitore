"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { deleteTrackedItem, fetchTrackedItems, updateTrackedItem } from "@/lib/api";
import type { FeedCategory, TrackedItem } from "@/lib/types";
import { CATEGORIES, CATEGORY_META, isTrackedCategory } from "@/lib/categories";
import { formatDate } from "@/lib/date";
import { AddTrackedItemSection } from "./AddTrackedItemSection";
import { ContentFeed } from "./ContentFeed";
import { CollectNowButton } from "./CollectNowButton";
import { TrendingSection } from "./TrendingSection";

export function Dashboard() {
  const [category, setCategory] = useState<FeedCategory>("INTEREST");
  const [items, setItems] = useState<TrackedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 収集が終わったら新着・トレンドを読み直させるためのカウンタ
  const [refreshKey, setRefreshKey] = useState(0);

  // 追跡対象は一度だけ取得し、タブ切り替えはクライアント側で絞り込む。
  useEffect(() => {
    fetchTrackedItems()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  const meta = CATEGORY_META[category];
  const visibleItems = useMemo(
    () => items.filter((item) => item.category === category),
    [items, category]
  );

  const countByCategory = useMemo(() => {
    const counts: Partial<Record<FeedCategory, number>> = {};
    for (const item of items) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  async function handleDelete(id: string) {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteTrackedItem(id);
    } catch (e) {
      setItems(previous);
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  // 「読み終わった」⇄「気になる」の移動。タブ間を行き来するので一覧から消える。
  async function handleToggleStatus(item: TrackedItem) {
    const next = item.bookStatus === "FINISHED" ? "WANT" : "FINISHED";
    const previous = items;
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, bookStatus: next, category: next === "FINISHED" ? "FINISHED" : "WANT" } : i
      )
    );
    try {
      const updated = await updateTrackedItem(item.id, { bookStatus: next });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (e) {
      setItems(previous);
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    }
  }

  const existingExternalIds = items.map((i) => i.externalId).filter((v): v is string => !!v);

  return (
    <main>
      <header className="dash-header">
        <div>
          <h1>
            <Link href="/welcome" className="brand-link">
              <Image
                className="brand-icon"
                src="/yomitore_icon.png"
                alt=""
                width={34}
                height={34}
                priority
              />
              ヨミトレ
            </Link>
          </h1>
          <p className="subtitle">興味・読んだ本・気になる本ごとに、今の話題を届けます</p>
        </div>
        <Link href="/welcome" className="pill-link">
          タイトルへ
        </Link>
      </header>

      <nav className="category-tabs" aria-label="カテゴリ">
        {CATEGORIES.map((c) => {
          const count = countByCategory[c.key];
          return (
            <button
              key={c.key}
              type="button"
              data-category={c.key}
              aria-current={category === c.key ? "page" : undefined}
              className={category === c.key ? "category-tab category-tab-active" : "category-tab"}
              onClick={() => setCategory(c.key)}
            >
              <span aria-hidden className="category-tab-emoji">
                {c.emoji}
              </span>
              <span className="category-tab-label">{c.label}</span>
              {isTrackedCategory(c.key) && count ? <span className="category-tab-count">{count}</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="category-panel" data-category={category} key={category}>
        <div className="category-intro">
          <h2 className="category-heading">
            <span aria-hidden>{meta.emoji}</span> {meta.heading}
          </h2>
          <p className="category-desc">{meta.description}</p>
        </div>

        {isTrackedCategory(category) && (
          <>
            <AddTrackedItemSection
              category={category}
              existingExternalIds={existingExternalIds}
              onAdded={(item) => setItems((prev) => [item, ...prev])}
            />

            <section className="tracked-section">
              <h2>{meta.listHeading}</h2>
              {loading ? (
                <p className="empty">読み込み中...</p>
              ) : visibleItems.length === 0 ? (
                <p className="empty">
                  まだ登録がありません。上のフォームから{meta.heading}を追加してください。
                </p>
              ) : (
                <ul>
                  {visibleItems.map((item) => (
                    <li key={item.id}>
                      <span className="badge category-badge">{CATEGORY_META[item.category].label}</span>
                      <Link href={`/tracked/${item.id}`} className="item-title tracked-link">
                        {item.title}
                      </Link>
                      {item.note && <span className="item-note">{item.note}</span>}
                      {item.finishedAt && <span className="item-meta">{formatDate(item.finishedAt)}に読了</span>}
                      <div className="item-actions">
                        {item.type === "BOOK" && (
                          <button type="button" className="status-btn" onClick={() => handleToggleStatus(item)}>
                            {item.bookStatus === "FINISHED" ? "気になるに戻す" : "読み終わった"}
                          </button>
                        )}
                        <button className="delete-btn" onClick={() => handleDelete(item.id)}>
                          削除
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <TrendingSection category={category} refreshKey={refreshKey} />
        <ContentFeed
          category={category}
          heading={meta.feedHeading}
          refreshKey={refreshKey}
          action={<CollectNowButton onFinished={() => setRefreshKey((n) => n + 1)} />}
        />
      </div>
    </main>
  );
}
