"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { fetchMatches } from "@/lib/api";
import type { FeedCategory, MatchedContent } from "@/lib/types";
import { CATEGORY_META } from "@/lib/categories";

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

function matchReasonLabel(match: MatchedContent["matches"][number]): string {
  return `${CATEGORY_META[match.category].label}「${match.trackedItemTitle}」と${Math.round(match.score * 100)}%一致`;
}

type Props = {
  trackedItemId?: string;
  category?: FeedCategory;
  heading?: string;
  /** 値が変わると読み直す。収集の完了を画面に反映させるために使う。 */
  refreshKey?: number;
  /** 見出しの横に並べる操作（ダッシュボードでは「今すぐ収集」）。 */
  action?: ReactNode;
};

export function ContentFeed({ trackedItemId, category, heading = "新着", refreshKey = 0, action }: Props) {
  const [contents, setContents] = useState<MatchedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () => {
      setError(null);
      fetchMatches({ trackedItemId, category })
        .then(setContents)
        .catch((e) => setError(e instanceof Error ? e.message : "取得に失敗しました"))
        .finally(() => setLoading(false));
    },
    [trackedItemId, category]
  );

  useEffect(() => {
    setLoading(true);
    load();
  }, [load, refreshKey]);

  return (
    <section>
      {action ? (
        <div className="section-header">
          <h2>{heading}</h2>
          {action}
        </div>
      ) : (
        <h2>{heading}</h2>
      )}
      {loading ? (
        <p className="empty">読み込み中...</p>
      ) : error ? (
        <p className="error">{error}</p>
      ) : contents.length === 0 ? (
        <p className="empty">
          {category === "OTHER"
            ? "まだ熱い分野のコンテンツがありません。収集・マッチングワーカーを実行してください。"
            : "まだ新着コンテンツがありません。追跡対象を登録し、収集・マッチングワーカーを実行してください。"}
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
                  {/* 「その他」は追跡対象に紐づかないので、代わりに分野名を出す */}
                  {content.matches.length === 0 && content.topic ? (
                    <span className="badge match-badge">🔥 {content.topic}</span>
                  ) : (
                    content.matches.map((match) => (
                      <span key={match.trackedItemId} className="badge match-badge">
                        {matchReasonLabel(match)}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
