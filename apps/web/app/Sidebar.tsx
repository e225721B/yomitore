"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, isCurrentNavItem, shouldShowNav } from "@/lib/nav";

/**
 * 全ページ共通の左サイドバー。項目の追加は lib/nav.ts の NAV_SECTIONS だけで完結する。
 * 狭い画面では上部の横並びバーに切り替わる（CSS 側で制御）。
 */
export function Sidebar() {
  const pathname = usePathname() ?? "/";
  if (!shouldShowNav(pathname)) return null;

  return (
    <nav className="sidebar" aria-label="メインナビゲーション">
      <Link href="/" className="sidebar-brand">
        <span aria-hidden>📚</span>
        <span className="sidebar-brand-name">ヨミトレ</span>
      </Link>

      {NAV_SECTIONS.map((section) => (
        <div key={section.key} className="sidebar-section">
          {section.label && <p className="sidebar-section-label">{section.label}</p>}
          <ul className="sidebar-list">
            {section.items.map((item) => {
              const current = isCurrentNavItem(item, pathname);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className={current ? "sidebar-link sidebar-link-active" : "sidebar-link"}
                    aria-current={current ? "page" : undefined}
                  >
                    <span aria-hidden className="sidebar-link-emoji">
                      {item.emoji}
                    </span>
                    <span className="sidebar-link-text">
                      <span className="sidebar-link-label">{item.label}</span>
                      {item.description && <span className="sidebar-link-desc">{item.description}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
