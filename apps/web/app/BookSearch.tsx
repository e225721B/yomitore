"use client";

import { useEffect, useState } from "react";
import { searchBooks } from "@/lib/api";
import type { BookSearchResult } from "@/lib/types";

type Props = {
  onSelect: (book: BookSearchResult) => void;
  disabledExternalIds?: string[];
  placeholder?: string;
};

export function BookSearch({ onSelect, disabledExternalIds = [], placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError(null);
      setSearched(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      searchBooks(q)
        .then((r) => {
          if (cancelled) return;
          setResults(r);
          setSearched(true);
        })
        .catch((e) => {
          if (cancelled) return;
          setError(e instanceof Error ? e.message : "検索に失敗しました");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="book-search">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? "本のタイトルで検索（例: 三体）"}
      />
      {loading && <p className="empty">検索中...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && searched && results.length === 0 && (
        <p className="empty">見つかりませんでした。別のキーワードで試してください。</p>
      )}
      {results.length > 0 && (
        <ul className="book-results">
          {results.map((book) => {
            const already = disabledExternalIds.includes(book.externalId);
            return (
              <li key={book.externalId} className="book-result">
                {book.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="book-thumb" src={book.thumbnailUrl} alt="" />
                ) : (
                  <div className="book-thumb book-thumb-placeholder" aria-hidden />
                )}
                <div className="book-info">
                  <span className="book-title">{book.title}</span>
                  {book.authors.length > 0 && <span className="book-author">{book.authors.join(", ")}</span>}
                  {book.publishedDate && <span className="book-date">{book.publishedDate}</span>}
                </div>
                <button type="button" disabled={already} onClick={() => onSelect(book)}>
                  {already ? "追加済み" : "選択"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
