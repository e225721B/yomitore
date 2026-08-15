export type TrackedItemType = "BOOK" | "INTEREST";

export type TrackedItem = {
  id: string;
  type: TrackedItemType;
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
  matches: ContentMatch[];
};

export type TrendItem = {
  trackedItemId: string;
  type: TrackedItemType;
  title: string;
  matchCount: number;
};

export type Trends = {
  windowDays: number | null;
  updatedAt: string | null;
  items: TrendItem[];
};
