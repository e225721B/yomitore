/** <input type="date"> 用の "YYYY-MM-DD"（ローカル日付）。 */
export function toDateInputValue(date: Date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * "YYYY-MM-DD" を、その日のローカル 0時として ISO 文字列に変換する。
 * UTC で解釈させると日付が前日にずれて表示されることがあるため。
 */
export function dateInputToIso(value: string): string {
  return new Date(`${value}T00:00:00`).toISOString();
}

/** 読了日などの表示用（例: 2026年8月17日）。 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}
