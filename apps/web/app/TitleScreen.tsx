"use client";

import { useRouter } from "next/navigation";

export function TitleScreen() {
  const router = useRouter();

  return (
    <main className="title-screen">
      <div className="title-logo" aria-hidden>
        📚
      </div>
      <h1 className="title-name">ヨミトレ</h1>
      <p className="title-tagline">読書好きの「気になる」を、良いタイミングで届ける。</p>
      <p className="title-desc">
        気になる本や興味分野を登録すると、YouTubeに散らばる関連の話題を自動で集めてお届けします。
      </p>
      <button type="button" className="title-cta" onClick={() => router.push("/onboarding")}>
        はじめる
      </button>
    </main>
  );
}
