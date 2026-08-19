import type {
  BookSearchResult,
  BookStatus,
  FeedCategory,
  MatchedContent,
  TrackedCategory,
  TrackedItem,
  TrackedItemType,
  Trends,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function withParams(path: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return `${API_URL}${path}${qs ? `?${qs}` : ""}`;
}

export async function fetchTrackedItems(category?: TrackedCategory): Promise<TrackedItem[]> {
  const res = await fetch(withParams("/tracked-items", { category }), { cache: "no-store" });
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
  bookStatus?: BookStatus;
  /** 読了日。"YYYY-MM-DD" 形式。読了本の登録時のみ渡す。 */
  finishedAt?: string;
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

/** 読書状態・読了日・メモの変更（「気になる本」⇄「読み終わった本」の移動を含む） */
export async function updateTrackedItem(
  id: string,
  input: { bookStatus?: BookStatus; note?: string | null; finishedAt?: string | null }
): Promise<TrackedItem> {
  const res = await fetch(`${API_URL}/tracked-items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new ApiError("更新に失敗しました", res.status);
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

export async function fetchMatches(options: {
  trackedItemId?: string;
  category?: FeedCategory;
} = {}): Promise<MatchedContent[]> {
  const res = await fetch(
    withParams("/matches", { trackedItemId: options.trackedItemId, category: options.category }),
    { cache: "no-store" }
  );
  if (!res.ok) throw new ApiError("新着コンテンツの取得に失敗しました", res.status);
  return res.json();
}

export async function fetchTrends(category?: FeedCategory): Promise<Trends> {
  const res = await fetch(withParams("/trends", { category }), { cache: "no-store" });
  if (!res.ok) throw new ApiError("トレンドの取得に失敗しました", res.status);
  return res.json();
}
