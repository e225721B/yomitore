"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookSearch } from "@/components/books/BookSearch";
import { createTrackedItem, fetchTrackedItems } from "@/lib/api";
import type { BookSearchResult, TrackedItem } from "@/lib/types";
import { dateInputToIso, formatDate, toDateInputValue } from "@/lib/date";

/**
 * 読み終わった本の登録ページ。
 * 検索欄は常に出したままにして「検索 → 選択 → 登録」を何度も繰り返せるようにしている。
 */
export default function RegisterFinishedBookPage() {
  const [selected, setSelected] = useState<BookSearchResult | null>(null);
  const [finishedOn, setFinishedOn] = useState(() => toDateInputValue());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 既に登録済みの本（検索結果で「追加済み」にする） */
  const [existingExternalIds, setExistingExternalIds] = useState<string[]>([]);
  /** このページで登録した本。登録した手応えが残るよう下に積み上げる。 */
  const [registered, setRegistered] = useState<TrackedItem[]>([]);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");

  useEffect(() => {
    fetchTrackedItems()
      .then((items) => setExistingExternalIds(items.map((i) => i.externalId).filter((v): v is string => !!v)))
      .catch(() => {
        // 重複チェックのための補助情報なので、取れなくても登録自体は続けられる
      });
  }, []);

  function afterRegister(created: TrackedItem) {
    setRegistered((prev) => [created, ...prev]);
    if (created.externalId) setExistingExternalIds((prev) => [...prev, created.externalId!]);
    setSelected(null);
    setNote("");
  }

  async function handleRegisterSelected() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createTrackedItem({
        type: "BOOK",
        bookStatus: "FINISHED",
        title: selected.title,
        author: selected.authors.join(", ") || undefined,
        thumbnailUrl: selected.thumbnailUrl ?? undefined,
        externalId: selected.externalId,
        note: note.trim() || undefined,
        finishedAt: dateInputToIso(finishedOn),
      });
      afterRegister(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegisterManual() {
    const title = manualTitle.trim();
    if (!title) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createTrackedItem({
        type: "BOOK",
        bookStatus: "FINISHED",
        title,
        author: manualAuthor.trim() || undefined,
        note: note.trim() || undefined,
        finishedAt: dateInputToIso(finishedOn),
      });
      afterRegister(created);
      setManualTitle("");
      setManualAuthor("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <div className="category-panel" data-category="FINISHED">
        <div className="category-intro">
          <h1 className="category-heading">
            <span aria-hidden>📚</span> 読み終わった本を登録
          </h1>
          <p className="category-desc">
            タイトルで検索して選ぶだけで登録できます。続けて何冊でも登録できます。
          </p>
        </div>

        <section className="add-section">
          <div className="register-date">
            <label htmlFor="finished-on">読了日</label>
            <input
              id="finished-on"
              type="date"
              value={finishedOn}
              max={toDateInputValue()}
              onChange={(e) => setFinishedOn(e.target.value)}
            />
            <span className="register-date-hint">この日付で登録されます（続けて登録する間は維持されます）</span>
          </div>

          {selected && (
            <div className="book-confirm">
              <div className="book-result">
                {selected.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="book-thumb" src={selected.thumbnailUrl} alt="" />
                ) : (
                  <div className="book-thumb book-thumb-placeholder" aria-hidden />
                )}
                <div className="book-info">
                  <span className="book-title">{selected.title}</span>
                  {selected.authors.length > 0 && (
                    <span className="book-author">{selected.authors.join(", ")}</span>
                  )}
                </div>
              </div>
              <textarea
                placeholder="感想・メモ（任意）"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="confirm-actions">
                <button type="button" onClick={handleRegisterSelected} disabled={submitting}>
                  {submitting ? "登録中..." : "読了本として登録する"}
                </button>
                <button type="button" className="secondary-btn" onClick={() => setSelected(null)}>
                  選び直す
                </button>
              </div>
            </div>
          )}

          <BookSearch
            onSelect={setSelected}
            disabledExternalIds={existingExternalIds}
            placeholder="読み終わった本のタイトルで検索（例: 三体）"
          />

          <div className="manual-entry">
            <button type="button" className="secondary-btn" onClick={() => setManualOpen((v) => !v)}>
              {manualOpen ? "手入力を閉じる" : "検索で見つからない本を手入力する"}
            </button>
            {manualOpen && (
              <div className="manual-entry-form">
                <input
                  placeholder="タイトル（必須）"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                />
                <input
                  placeholder="著者（任意）"
                  value={manualAuthor}
                  onChange={(e) => setManualAuthor(e.target.value)}
                />
                <button type="button" onClick={handleRegisterManual} disabled={submitting || !manualTitle.trim()}>
                  登録する
                </button>
              </div>
            )}
          </div>

          {error && <p className="error">{error}</p>}
        </section>

        {registered.length > 0 && (
          <section className="tracked-section">
            <h2>このページで登録した本（{registered.length}冊）</h2>
            <ul>
              {registered.map((item) => (
                <li key={item.id}>
                  <span className="badge category-badge">登録しました</span>
                  <Link href={`/tracked/${item.id}`} className="item-title tracked-link">
                    {item.title}
                  </Link>
                  <span className="item-note">
                    {item.author ? `${item.author}・` : ""}
                    {item.finishedAt ? `${formatDate(item.finishedAt)}に読了` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/" className="pill-link">
              ホームで新着を見る
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
