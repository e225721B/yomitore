"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchTrends } from "@/lib/api";
import type { FeedCategory, Trends } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";

type Props = {
  category: FeedCategory;
};

export function TrendingSection({ category }: Props) {
  const [trends, setTrends] = useState<Trends | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      setError(null);
      fetchTrends(category)
        .then(setTrends)
        .catch((e) => setError(e instanceof Error ? e.message : "取得に失敗しました"))
        .finally(() => setRefreshing(false));
    },
    [category]
  );

  useEffect(() => {
    setTrends(null);
    load(false);
  }, [load]);

  const meta = CATEGORY_META[category];
  const isOther = category === "OTHER";
  const items = trends?.items.filter((item) => item.matchCount > 0) ?? [];
  const topics = trends?.topics.filter((topic) => topic.contentCount > 0) ?? [];
  const isEmpty = isOther ? topics.length === 0 : items.length === 0;

  return (
    <section>
      <div className="section-header">
        <h2>{isOther ? "熱い分野ランキング" : `${meta.label}のトレンド`}</h2>
        <button type="button" className="refresh-btn" onClick={() => load(true)} disabled={!trends || refreshing}>
          {refreshing ? "更新中..." : "更新"}
        </button>
      </div>
      {error ? (
        <p className="error">{error}</p>
      ) : !trends ? (
        <p className="empty">読み込み中...</p>
      ) : isEmpty ? (
        <p className="empty">
          まだトレンドデータがありません。収集・マッチング・集計ワーカーを実行してください。
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
