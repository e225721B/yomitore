"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isOnboarded } from "@/lib/onboarding";

export function TitleScreen() {
  const router = useRouter();
  // localStorage は初回描画時には読めないため、確定するまでは null。
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    setOnboarded(isOnboarded());
  }, []);

  if (onboarded === null) return null;

  // 設定済みの人をオンボーディングに送り返さない。興味分野は重複チェックが
  // ないので、やり直すと同じ項目が二重に登録されてしまう。
  const cta = onboarded
    ? { label: "Myダッシュボードへ", href: "/" }
    : { label: "はじめる", href: "/onboarding" };

  return (
    <main className="title-screen">
      <div className="title-logo" aria-hidden>
    
      </div>
      <h1 className="title-name">ヨミトレ</h1>
      <p className="title-tagline">読書好きの「気になる」を、良いタイミングで届ける。</p>
      <p className="title-desc">
        あなたのこれまで読んだ本、興味関心の分野からSNSに散らばる関連の話題をまとめてお届けします
      </p>
      <button type="button" className="title-cta" onClick={() => router.push(cta.href)}>
        {cta.label}
        <span className="cta-arrow" aria-hidden>
          →
        </span>
      </button>
      {onboarded}

      {/* 背景装飾。z-index で背面に置いてあるので、登場アニメーションの
          nth-child が本文からずれないよう末尾に置く。 */}
      <div className="title-orb title-orb-a" aria-hidden />
      <div className="title-orb title-orb-b" aria-hidden />
    </main>
  );
}
