import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ヨミトレ",
  description: "読書好きの「気になる」を、良いタイミングで届ける情報アグリゲーター",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
