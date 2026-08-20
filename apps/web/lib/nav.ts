/**
 * 左サイドバーのナビゲーション定義。
 *
 * ページを増やすときは、ここに項目を1つ足すだけでサイドバーに出る。
 * 画面側（Sidebar.tsx）は NAV_SECTIONS を素直に描画するだけなので、
 * セクションごと増やすこともできる（例: 「分析」「設定」）。
 */

export type NavItem = {
  key: string;
  href: string;
  /** サイドバーに出すラベル */
  label: string;
  emoji: string;
  /** ラベル下の補足。省略可 */
  description?: string;
  /**
   * 現在地の判定方法。
   * - "exact":  パスが完全一致したときだけ現在地（トップページなど）
   * - "prefix": 配下のページも現在地として扱う（既定）
   */
  match?: "exact" | "prefix";
};

export type NavSection = {
  key: string;
  /** セクション見出し。null なら見出しなしで項目だけ並べる */
  label: string | null;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    key: "notice",
    label: "知らせ",
    items: [
      {
        key: "releases",
        href: "/releases",
        label: "新刊・続編",
        emoji: "🔔",
      },
    ],
  },
  {
    key: "register",
    label: "登録する",
    items: [
      {
        key: "finished-book",
        href: "/books/finished/new",
        label: "読んだ本を登録",
        emoji: "📚",
      },
    ],
  },
];

/** サイドバーを出さないページ。タイトル画面とオンボーディングは全画面で完結させる。 */
const NAV_HIDDEN_PREFIXES = ["/welcome", "/onboarding"];

export function shouldShowNav(pathname: string): boolean {
  return !NAV_HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isCurrentNavItem(item: NavItem, pathname: string): boolean {
  if ((item.match ?? "prefix") === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
