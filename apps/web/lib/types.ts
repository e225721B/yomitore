export type TrackedItemType = "BOOK" | "INTEREST";

export type BookStatus = "WANT" | "FINISHED";

/** カテゴリタブ。OTHER は追跡対象を持たない「今、熱い分野」。 */
export type FeedCategory = "INTEREST" | "FINISHED" | "WANT" | "OTHER";
export type TrackedCategory = Exclude<FeedCategory, "OTHER">;

export type TrackedItem = {
  id: string;
  type: TrackedItemType;
  bookStatus: BookStatus | null;
  /** 読了日（ISO文字列）。読了本だけが持つ。 */
  finishedAt: string | null;
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

/** 「今すぐ収集」の実行状況（収集 → マッチング → トレンド集計） */
export type CollectionJob = {
  status: "idle" | "running" | "succeeded" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  /** ワーカーの出力（直近のみ）。進捗表示に使う */
  log: string[];
  error: string | null;
  /** 成功はしたが伝えるべきことがある場合の注意書き */
  warning: string | null;
};

/** 続編か、同じ著者の新刊か */
export type ReleaseKind = "SEQUEL" | "SAME_AUTHOR";

/** 登録した本に対して見つかった新刊 */
export type BookRelease = {
  id: string;
  kind: ReleaseKind;
  title: string;
  author: string | null;
  publisher: string | null;
  isbn: string;
  releaseDate: string | null;
  /** 書籍APIが返す発売日の原文（"2024-02" など粒度がまちまち） */
  releaseLabel: string;
  url: string;
  thumbnailUrl: string | null;
  detectedAt: string;
  seenAt: string | null;
  /** どの登録本に対する新刊か */
  trackedItemId: string;
  trackedItemTitle: string;
};
