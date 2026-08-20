import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "ヨミトレ",
  description: "読書好きの「気になる」を、良いタイミングで届ける情報アグリゲーター",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="app-shell">
          <Sidebar />
          <div className="app-content">{children}</div>
        </div>
      </body>
    </html>
  );
}
