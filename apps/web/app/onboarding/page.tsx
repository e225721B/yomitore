"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTrackedItem } from "@/lib/api";
import type { BookSearchResult } from "@/lib/types";
import { INTEREST_PRESETS } from "@/lib/interestPresets";
import { BookSearch } from "@/app/BookSearch";

const ONBOARDED_KEY = "yomitore:onboarded";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [selectedBooks, setSelectedBooks] = useState<BookSearchResult[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleInterest(title: string) {
    setSelectedInterests((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  }

  function addCustomInterest() {
    const title = customInterest.trim();
    if (!title || selectedInterests.includes(title)) return;
    setSelectedInterests((prev) => [...prev, title]);
    setCustomInterest("");
  }

  function addBook(book: BookSearchResult) {
    setSelectedBooks((prev) => (prev.some((b) => b.externalId === book.externalId) ? prev : [...prev, book]));
  }

  function removeBook(externalId: string) {
    setSelectedBooks((prev) => prev.filter((b) => b.externalId !== externalId));
  }

  function finishOnboarding() {
    localStorage.setItem(ONBOARDED_KEY, "1");
    router.push("/");
  }

  async function finish() {
    setSubmitting(true);
    setError(null);
    try {
      await Promise.all([
        ...selectedInterests.map((title) => createTrackedItem({ type: "INTEREST", title }).catch(() => null)),
        ...selectedBooks.map((book) =>
          createTrackedItem({
            type: "BOOK",
            title: book.title,
            author: book.authors.join(", ") || undefined,
            thumbnailUrl: book.thumbnailUrl ?? undefined,
            externalId: book.externalId,
          }).catch(() => null)
        ),
      ]);
      finishOnboarding();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <main className="onboarding">
      <div className="onboarding-progress">ステップ {step} / 2</div>

      {step === 1 && (
        <>
          <h1>興味のある分野を選んでください</h1>
          <p className="subtitle">
            気になる話題を選ぶと、関連する新着コンテンツが届きます（複数選択可・あとから変更できます）
          </p>
          <div className="chip-list">
            {INTEREST_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={selectedInterests.includes(preset) ? "chip chip-selected" : "chip"}
                onClick={() => toggleInterest(preset)}
              >
                {preset}
              </button>
            ))}
            {selectedInterests
              .filter((t) => !INTEREST_PRESETS.includes(t))
              .map((t) => (
                <button key={t} type="button" className="chip chip-selected" onClick={() => toggleInterest(t)}>
                  {t}
                </button>
              ))}
          </div>
          <div className="field-row">
            <input
              placeholder="その他の興味分野を入力"
              value={customInterest}
              onChange={(e) => setCustomInterest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomInterest();
                }
              }}
            />
            <button type="button" onClick={addCustomInterest} disabled={!customInterest.trim()}>
              追加
            </button>
          </div>
          <div className="onboarding-nav">
            <button type="button" className="secondary-btn" onClick={finishOnboarding}>
              スキップ
            </button>
            <button type="button" onClick={() => setStep(2)}>
              次へ
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1>気になる本はありますか？</h1>
          <p className="subtitle">タイトルで検索して選択してください（任意・あとから追加できます）</p>
          <BookSearch onSelect={addBook} disabledExternalIds={selectedBooks.map((b) => b.externalId)} />
          {selectedBooks.length > 0 && (
            <ul className="selected-books">
              {selectedBooks.map((book) => (
                <li key={book.externalId} className="selected-book">
                  {book.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="book-thumb" src={book.thumbnailUrl} alt="" />
                  ) : (
                    <div className="book-thumb book-thumb-placeholder" aria-hidden />
                  )}
                  <span className="book-title">{book.title}</span>
                  <button type="button" className="delete-btn" onClick={() => removeBook(book.externalId)}>
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="error">{error}</p>}
          <div className="onboarding-nav">
            <button type="button" className="secondary-btn" onClick={() => setStep(1)}>
              戻る
            </button>
            <button type="button" onClick={finish} disabled={submitting}>
              {submitting ? "登録中..." : "はじめる"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
