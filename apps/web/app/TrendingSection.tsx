"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchTrends } from "@/lib/api";
import type { FeedCategory, Trends } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";

type Props = {
  category: FeedCategory;
  /** 値が変わると読み直す。収集の完了を画面に反映させるために使う。 */
  refreshKey?: number;
};

export function TrendingSection({ category, refreshKey = 0 }: Props) {
  const [trends, setTrends] = useState<Trends | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () => {
      setError(null);
      fetchTrends(category)
        .then(setTrends)
        .catch((e) => setError(e instanceof Error ? e.message : "取得に失敗しました"));
    },
    [category]
  );

  useEffect(() => {
    setTrends(null);
    load();
  }, [load, refreshKey]);

  const meta = CATEGORY_META[category];
  const isOther = category === "OTHER";
  const items = trends?.items.filter((item) => item.matchCount > 0) ?? [];
  const topics = trends?.topics.filter((topic) => topic.contentCount > 0) ?? [];
  const isEmpty = isOther ? topics.length === 0 : items.length === 0;

  return (
    <section>
      <h2>{isOther ? "熱い分野ランキング" : `${meta.label}のトレンド`}</h2>
      {error ? (
        <p className="error">{error}</p>
      ) : !trends ? (
        <p className="empty">読み込み中...</p>
      ) : isEmpty ? (
        <p className="empty">
          まだトレンドデータがありません。右上の「今すぐ収集」を押すと集まります。
        </p>
      ) : (
        <>
          <ul className="trend-list">
            {isOther
              ? topics.map((topic, index) => (
                  <li key={topic.topic} className="trend-item">
                    <span className="trend-rank">{index + 1}</span>
                    <span className="item-title">{topic.topic}</span>
                    <span className="trend-count">{topic.contentCount}件</span>
                  </li>
                ))
              : items.map((item, index) => (
                  <li key={item.trackedItemId} className="trend-item">
                    <span className="trend-rank">{index + 1}</span>
                    <span className="badge category-badge">{CATEGORY_META[item.category].label}</span>
                    <Link href={`/tracked/${item.trackedItemId}`} className="item-title trend-link">
                      {item.title}
                    </Link>
                    <span className="trend-count">{item.matchCount}件</span>
                  </li>
                ))}
          </ul>
          {trends.windowDays !== null && (
            <p className="trend-note">
              {isOther
                ? `直近${trends.windowDays}日間に集まった、登録外の話題の件数でランキング`
                : `直近${trends.windowDays}日間の関連コンテンツ数（マッチ件数）でランキング`}
            </p>
          )}
        </>
      )}
    </section>
  );
}
