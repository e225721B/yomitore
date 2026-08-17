export type TrackedItemType = "BOOK" | "INTEREST";

export type BookStatus = "WANT" | "FINISHED";

/** カテゴリタブ。OTHER は追跡対象を持たない「今、熱い分野」。 */
export type FeedCategory = "INTEREST" | "FINISHED" | "WANT" | "OTHER";
export type TrackedCategory = Exclude<FeedCategory, "OTHER">;

export type TrackedItem = {
  id: string;
  type: TrackedItemType;
  bookStatus: BookStatus | null;
  category: TrackedCategory;
  title: string;
  note: string | null;
  author: string | null;
  thumbnailUrl: string | null;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BookSearchResult = {
  externalId: string;
  title: string;
  authors: string[];
  thumbnailUrl: string | null;
  publishedDate: string | null;
  description: string | null;
};

export type ContentMatch = {
  trackedItemId: string;
  trackedItemTitle: string;
  trackedItemType: TrackedItemType;
  category: TrackedCategory;
  score: number;
};

export type MatchedContent = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  thumbnailUrl: string | null;
  channelTitle: string | null;
  publishedAt: string | null;
  collectedAt: string;
  /** ホットトピック起点で収集された場合の分野名（「その他」タブで表示） */
  topic: string | null;
  matches: ContentMatch[];
};

export type TrendItem = {
  trackedItemId: string;
  type: TrackedItemType;
  bookStatus: BookStatus | null;
  category: TrackedCategory;
  title: string;
  matchCount: number;
};

/** 「その他」タブのランキング項目。追跡対象ではなく分野そのもの。 */
export type TrendTopic = {
  topic: string;
  contentCount: number;
};

export type Trends = {
  windowDays: number | null;
  updatedAt: string | null;
  items: TrendItem[];
  topics: TrendTopic[];
};
