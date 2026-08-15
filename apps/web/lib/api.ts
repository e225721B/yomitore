import type { BookSearchResult, MatchedContent, TrackedItem, TrackedItemType, Trends } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchTrackedItems(): Promise<TrackedItem[]> {
  const res = await fetch(`${API_URL}/tracked-items`, { cache: "no-store" });
  if (!res.ok) throw new ApiError("追跡対象の取得に失敗しました", res.status);
  return res.json();
}

export async function fetchTrackedItem(id: string): Promise<TrackedItem> {
  const res = await fetch(`${API_URL}/tracked-items/${id}`, { cache: "no-store" });
  if (!res.ok) throw new ApiError("追跡対象が見つかりません", res.status);
  return res.json();
}

export async function createTrackedItem(input: {
  type: TrackedItemType;
  title: string;
  note?: string;
  author?: string;
  thumbnailUrl?: string;
  externalId?: string;
}): Promise<TrackedItem> {
  const res = await fetch(`${API_URL}/tracked-items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 409) {
    throw new ApiError("この本はすでに登録されています", 409);
  }
  if (!res.ok) throw new ApiError("追跡対象の登録に失敗しました", res.status);
  return res.json();
}

export async function deleteTrackedItem(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/tracked-items/${id}`, { method: "DELETE" });
  if (!res.ok) throw new ApiError("追跡対象の削除に失敗しました", res.status);
}

export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  const res = await fetch(`${API_URL}/books/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = typeof body?.error === "string" ? body.error : "書籍検索に失敗しました";
    throw new ApiError(message, res.status);
  }
  return res.json();
}

export async function fetchMatches(trackedItemId?: string): Promise<MatchedContent[]> {
  const url = trackedItemId
    ? `${API_URL}/matches?trackedItemId=${encodeURIComponent(trackedItemId)}`
    : `${API_URL}/matches`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new ApiError("新着コンテンツの取得に失敗しました", res.status);
  return res.json();
}

export async function fetchTrends(): Promise<Trends> {
  const res = await fetch(`${API_URL}/trends`, { cache: "no-store" });
  if (!res.ok) throw new ApiError("トレンドの取得に失敗しました", res.status);
  return res.json();
}
