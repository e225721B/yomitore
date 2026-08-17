import { z } from "zod";
import type { Prisma } from "@prisma/client";

/**
 * 画面のカテゴリタブと対応する分類。
 * - INTEREST: 興味関心のある分野
 * - FINISHED: 読み終わって登録した本
 * - WANT:     気になっている本
 * - OTHER:    上記以外の「今、熱い分野」（追跡対象に紐づかないホットトピック）
 */
export const FEED_CATEGORIES = ["INTEREST", "FINISHED", "WANT", "OTHER"] as const;
export type FeedCategory = (typeof FEED_CATEGORIES)[number];

/** 追跡対象を持つカテゴリ（OTHER は追跡対象を持たない） */
export type TrackedCategory = Exclude<FeedCategory, "OTHER">;

export const feedCategorySchema = z.enum(FEED_CATEGORIES);
export const trackedCategorySchema = z.enum(["INTEREST", "FINISHED", "WANT"]);

/**
 * カテゴリ → TrackedItem の絞り込み条件。
 * bookStatus 未設定の古いデータは「気になっている本」として扱う。
 */
export function trackedItemWhere(category: TrackedCategory): Prisma.TrackedItemWhereInput {
  switch (category) {
    case "INTEREST":
      return { type: "INTEREST" };
    case "FINISHED":
      return { type: "BOOK", bookStatus: "FINISHED" };
    case "WANT":
      return { type: "BOOK", OR: [{ bookStatus: "WANT" }, { bookStatus: null }] };
  }
}

/** TrackedItem → カテゴリ。トレンド集計やレスポンスの分類に使う。 */
export function categoryOf(item: { type: string; bookStatus: string | null }): TrackedCategory {
  if (item.type === "INTEREST") return "INTEREST";
  return item.bookStatus === "FINISHED" ? "FINISHED" : "WANT";
}
