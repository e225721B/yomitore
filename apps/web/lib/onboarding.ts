/**
 * オンボーディング完了フラグ。
 *
 * 「オンボーディングが済んでいるか」と「いまどの画面を表示するか」は別の関心事。
 * このフラグは前者だけを表し、画面遷移はルーティング（/ と /welcome）で表現する。
 * そのためタイトル画面に戻ってもフラグは消えず、設定はやり直しにならない。
 */
const ONBOARDED_KEY = "yomitore:onboarded";

export function isOnboarded(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ONBOARDED_KEY) === "1";
}

export function markOnboarded(): void {
  localStorage.setItem(ONBOARDED_KEY, "1");
}
