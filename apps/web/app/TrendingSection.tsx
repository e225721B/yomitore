"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchTrends } from "@/lib/api";
import type { TrackedItemType, Trends } from "@/lib/types";

const TYPE_LABEL: Record<TrackedItemType, string> = {
  BOOK: "本",
  INTEREST: "興味分野",
};

export function TrendingSection() {
  const [trends, setTrends] = useState<Trends | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    fetchTrends()
      .then(setTrends)
      .catch((e) => setError(e instanceof Error ? e.message : "取得に失敗しました"))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const items = trends?.items.filter((item) => item.matchCount > 0) ?? [];

  return (
    <section>
      <div className="section-header">
        <h2>トレンド</h2>
        <button type="button" className="refresh-btn" onClick={() => load(true)} disabled={!trends || refreshing}>
          {refreshing ? "更新中..." : "更新"}
        </button>
      </div>
      {error ? (
        <p className="error">{error}</p>
      ) : !trends ? (
        <p className="empty">読み込み中...</p>
      ) : items.length === 0 ? (
        <p className="empty">まだトレンドデータがありません。収集・マッチング・集計ワーカーを実行してください。</p>
      ) : (
        <>
          <ul className="trend-list">
            {items.map((item, index) => (
              <li key={item.trackedItemId} className="trend-item">
                <span className="trend-rank">{index + 1}</span>
                <span className="badge">{TYPE_LABEL[item.type]}</span>
                <Link href={`/tracked/${item.trackedItemId}`} className="item-title trend-link">
                  {item.title}
                </Link>
                <span className="trend-count">{item.matchCount}件</span>
              </li>
            ))}
          </ul>
          {trends.windowDays !== null && (
            <p className="trend-note">
              直近{trends.windowDays}日間の関連コンテンツ数（マッチ件数）でランキング
            </p>
          )}
        </>
      )}
    </section>
  );
}
