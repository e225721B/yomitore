"use client";

import { useState } from "react";
import { createTrackedItem } from "@/lib/api";
import type { BookSearchResult, TrackedCategory, TrackedItem } from "@/lib/types";
import { BookSearch } from "./BookSearch";
import { INTEREST_PRESETS } from "@/lib/interestPresets";
import { CATEGORY_META, creationParamsFor } from "@/lib/categories";

type Props = {
  category: TrackedCategory;
  existingExternalIds: string[];
  onAdded: (item: TrackedItem) => void;
};

export function AddTrackedItemSection({ category, existingExternalIds, onAdded }: Props) {
  const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interestTitle, setInterestTitle] = useState("");

  const meta = CATEGORY_META[category];

  async function handleRegisterBook() {
    if (!selectedBook) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createTrackedItem({
        ...creationParamsFor(category),
        title: selectedBook.title,
        author: selectedBook.authors.join(", ") || undefined,
        thumbnailUrl: selectedBook.thumbnailUrl ?? undefined,
        externalId: selectedBook.externalId,
        note: note.trim() || undefined,
      });
      onAdded(created);
      setSelectedBook(null);
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddInterest(title: string) {
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createTrackedItem({ ...creationParamsFor(category), title: title.trim() });
      onAdded(created);
      setInterestTitle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="add-section">
      {category === "INTEREST" ? (
        <div className="add-interest-panel">
          <div className="chip-list">
            {INTEREST_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="chip"
                disabled={submitting}
                onClick={() => handleAddInterest(preset)}
              >
                + {preset}
              </button>
            ))}
          </div>
          <div className="field-row">
            <input
              placeholder="興味分野を自由入力（例: 児童文学）"
              value={interestTitle}
              onChange={(e) => setInterestTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddInterest(interestTitle);
                }
              }}
            />
            <button
              type="button"
              onClick={() => handleAddInterest(interestTitle)}
              disabled={submitting || !interestTitle.trim()}
            >
              追加
            </button>
          </div>
        </div>
      ) : (
        <div className="add-book-panel">
          {!selectedBook ? (
            <BookSearch onSelect={setSelectedBook} disabledExternalIds={existingExternalIds} />
          ) : (
            <div className="book-confirm">
              <div className="book-result">
                {selectedBook.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="book-thumb" src={selectedBook.thumbnailUrl} alt="" />
                ) : (
                  <div className="book-thumb book-thumb-placeholder" aria-hidden />
                )}
                <div className="book-info">
                  <span className="book-title">{selectedBook.title}</span>
                  {selectedBook.authors.length > 0 && (
                    <span className="book-author">{selectedBook.authors.join(", ")}</span>
                  )}
                </div>
              </div>
              <textarea
                placeholder={category === "FINISHED" ? "感想・メモ（任意）" : "メモ（任意）"}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="confirm-actions">
                <button type="button" onClick={handleRegisterBook} disabled={submitting}>
                  {submitting ? "登録中..." : `${meta.listHeading}に登録する`}
                </button>
                <button type="button" className="secondary-btn" onClick={() => setSelectedBook(null)}>
                  検索に戻る
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
