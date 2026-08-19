"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchReleases, markAllReleasesSeen, markReleaseSeen } from "@/lib/api";
import type { BookRelease } from "@/lib/types";
import { formatDate } from "@/lib/date";

/** 発売日が未来なら「発売予定」、過去なら「発売済み」 */
function releaseState(release: BookRelease): { label: string; upcoming: boolean } {
  if (!release.releaseDate) return { label: release.releaseLabel, upcoming: false };
  const upcoming = new Date(release.releaseDate).getTime() > Date.now();
  return { label: `${formatDate(release.releaseDate)}${upcoming ? " 発売予定" : " 発売"}`, upcoming };
}

export default function ReleasesPage() {
  const [releases, setReleases] = useState<BookRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchReleases()
      .then(setReleases)
      .catch((e) => setError(e instanceof Error ? e.message : "取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const unseenCount = useMemo(() => releases.filter((r) => !r.seenAt).length, [releases]);
  const sequels = releases.filter((r) => r.kind === "SEQUEL");
  const sameAuthor = releases.filter((r) => r.kind === "SAME_AUTHOR");

  async function handleToggleSeen(release: BookRelease) {
    const seen = !release.seenAt;
    const previous = releases;
    setReleases((prev) =>
      prev.map((r) => (r.id === release.id ? { ...r, seenAt: seen ? new Date().toISOString() : null } : r))
    );
    try {
      await markReleaseSeen(release.id, seen);
    } catch (e) {
      setReleases(previous);
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    }
  }

  async function handleSeenAll() {
    const previous = releases;
    const now = new Date().toISOString();
    setReleases((prev) => prev.map((r) => (r.seenAt ? r : { ...r, seenAt: now })));
    try {
      await markAllReleasesSeen();
    } catch (e) {
      setReleases(previous);
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    }
  }

  function renderList(items: BookRelease[]) {
    return (
      <ul className="release-list">
        {items.map((release) => {
          const state = releaseState(release);
          return (
            <li key={release.id} className={release.seenAt ? "release-item release-seen" : "release-item"}>
              {release.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="book-thumb" src={release.thumbnailUrl} alt="" />
              ) : (
                <div className="book-thumb book-thumb-placeholder" aria-hidden />
              )}
              <div className="book-info">
                <a href={release.url} target="_blank" rel="noreferrer" className="item-title">
                  {release.title}
                </a>
                <span className="book-author">
                  {[release.author, release.publisher].filter(Boolean).join(" / ")}
                </span>
                <span className={state.upcoming ? "release-date release-upcoming" : "release-date"}>
                  {state.label}
                </span>
                <span className="item-meta">
                  <Link href={`/tracked/${release.trackedItemId}`} className="tracked-link">
                    「{release.trackedItemTitle}」
                  </Link>
                  から検出
                </span>
              </div>
              <div className="item-actions">
                <button type="button" className="status-btn" onClick={() => handleToggleSeen(release)}>
                  {release.seenAt ? "未読に戻す" : "既読にする"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <main>
      <div className="category-panel" data-category="WANT">
        <div className="category-intro">
          <h1 className="category-heading">
            <span aria-hidden>🔔</span> 新刊・続編のお知らせ
          </h1>
          <p className="category-desc">
            登録した本の著者から、これから出る本・最近出た本を探しています。
          </p>
        </div>

        {error && <p className="error">{error}</p>}

        {loading ? (
          <p className="empty">読み込み中...</p>
        ) : releases.length === 0 ? (
          <p className="empty">
            まだお知らせはありません。読んだ本を登録して「今すぐ収集」を押すと、続編や新刊を探します。
          </p>
        ) : (
          <>
            {unseenCount > 0 && (
              <div className="release-actions">
                <span className="item-meta">未読 {unseenCount}件</span>
                <button type="button" className="secondary-btn" onClick={handleSeenAll}>
                  すべて既読にする
                </button>
              </div>
            )}

            {sequels.length > 0 && (
              <section>
                <h2>続編・シリーズの続き（{sequels.length}件）</h2>
                {renderList(sequels)}
              </section>
            )}

            {sameAuthor.length > 0 && (
              <section>
                <h2>同じ著者の新刊（{sameAuthor.length}件）</h2>
                {renderList(sameAuthor)}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
