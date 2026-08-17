import type { FeedCategory, TrackedCategory } from "./types";

export type CategoryMeta = {
  key: FeedCategory;
  /** タブに出す短いラベル */
  label: string;
  /** 見出しに使う正式名 */
  heading: string;
  emoji: string;
  /** タブ切り替え直後に出す説明 */
  description: string;
  /** 登録済み一覧の見出し（OTHER は登録という概念がないので null） */
  listHeading: string | null;
  /** 新着フィードの見出し */
  feedHeading: string;
};

export const CATEGORIES: CategoryMeta[] = [
  {
    key: "INTEREST",
    label: "興味分野",
    heading: "興味関心のある分野",
    emoji: "🎯",
    description: "登録した興味分野で盛り上がっている話題を届けます。",
    listHeading: "登録した興味分野",
    feedHeading: "興味分野のトレンド新着",
  },
  {
    key: "FINISHED",
    label: "読んだ本",
    heading: "読み終わって登録した本",
    emoji: "📚",
    description: "読み終わった本の感想・考察・関連トークを追いかけます。",
    listHeading: "読み終わった本",
    feedHeading: "読んだ本のトレンド新着",
  },
  {
    key: "WANT",
    label: "気になる本",
    heading: "気になっている本",
    emoji: "🔖",
    description: "積読・購入検討中の本の紹介やレビューを集めます。",
    listHeading: "気になっている本",
    feedHeading: "気になる本のトレンド新着",
  },
  {
    key: "OTHER",
    label: "その他",
    heading: "今、熱い分野",
    emoji: "🔥",
    description: "登録していない分野で、いま盛り上がっている話題です。",
    listHeading: null,
    feedHeading: "熱い分野のトレンド新着",
  },
];

export const CATEGORY_META: Record<FeedCategory, CategoryMeta> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
) as Record<FeedCategory, CategoryMeta>;

/** 追跡対象を登録できるカテゴリか（OTHER だけ登録を持たない） */
export function isTrackedCategory(category: FeedCategory): category is TrackedCategory {
  return category !== "OTHER";
}

/** そのカテゴリに登録するときの TrackedItem の型と読書状態 */
export function creationParamsFor(category: TrackedCategory) {
  if (category === "INTEREST") return { type: "INTEREST" as const };
  return { type: "BOOK" as const, bookStatus: category === "FINISHED" ? ("FINISHED" as const) : ("WANT" as const) };
}
