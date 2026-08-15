"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMatches } from "@/lib/api";
import type { MatchedContent } from "@/lib/types";

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

const TYPE_LABEL = { BOOK: "本", INTEREST: "興味分野" } as const;

function matchReasonLabel(match: MatchedContent["matches"][number]): string {
  return `${TYPE_LABEL[match.trackedItemType]}「${match.trackedItemTitle}」と${Math.round(match.score * 100)}%一致`;
}

type Props = {
  trackedItemId?: string;
  heading?: string;
};

export function ContentFeed({ trackedItemId, heading = "新着" }: Props) {
  const [contents, setContents] = useState<MatchedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      setError(null);
      fetchMatches(trackedItemId)
        .then(setContents)
        .catch((e) => setError(e instanceof Error ? e.message : "取得に失敗しました"))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [trackedItemId]
  );

  useEffect(() => {
    setLoading(true);
    load(false);
  }, [load]);

  return (
    <section>
      <div className="section-header">
        <h2>{heading}</h2>
        <button type="button" className="refresh-btn" onClick={() => load(true)} disabled={loading || refreshing}>
          {refreshing ? "更新中..." : "更新"}
        </button>
      </div>
      {loading ? (
        <p className="empty">読み込み中...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : contents.length === 0 ? (
        <p className="empty">
          まだ新着コンテンツがありません。追跡対象を登録し、収集・マッチングワーカーを実行してください。
        </p>
      ) : (
        <ul className="feed">
          {contents.map((content) => (
            <li key={content.id} className="feed-item">
              {content.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="feed-thumb" src={content.thumbnailUrl} alt="" />
              ) : (
                <div className="feed-thumb feed-thumb-placeholder" aria-hidden />
              )}
              <div className="feed-body">
                <a className="feed-title" href={content.url} target="_blank" rel="noreferrer">
                  {content.title}
                </a>
                <div className="feed-meta">
                  {content.channelTitle}
                  {content.publishedAt && ` · ${formatDate(content.publishedAt)}`}
                </div>
                <div className="feed-matches">
                  {content.matches.map((match) => (
                    <span key={match.trackedItemId} className="badge match-badge">
                      {matchReasonLabel(match)}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
