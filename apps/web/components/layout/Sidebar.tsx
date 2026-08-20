"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, isCurrentNavItem, shouldShowNav } from "@/lib/nav";
import { fetchReleases } from "@/lib/api";

/**
 * 全ページ共通の左サイドバー。項目の追加は lib/nav.ts の NAV_SECTIONS だけで完結する。
 * 狭い画面では上部の横並びバーに切り替わる（CSS 側で制御）。
 */
export function Sidebar() {
  const pathname = usePathname() ?? "/";
  const [unseenReleases, setUnseenReleases] = useState(0);

  // 未読の新刊件数。ページ遷移のたびに数え直す（既読にした直後も追随させるため）。
  useEffect(() => {
    fetchReleases(true)
      .then((releases) => setUnseenReleases(releases.length))
      .catch(() => setUnseenReleases(0));
  }, [pathname]);

  if (!shouldShowNav(pathname)) return null;

  return (
    <nav className="sidebar" aria-label="メインナビゲーション">
      <Link href="/" className="sidebar-brand">
        <Image
          className="brand-icon"
          src="/yomitore_icon.png"
          alt=""
          width={34}
          height={34}
          priority
        />
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
                    {item.key === "releases" && unseenReleases > 0 && (
                      <span className="sidebar-badge" aria-label={`未読 ${unseenReleases}件`}>
                        {unseenReleases}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {/* 上の余白を吸わせて最下部に寄せる（CSS の margin-top: auto） */}
      <Link href="/welcome" className="pill-link sidebar-title-link">
        タイトルへ
      </Link>
    </nav>
  );
}
