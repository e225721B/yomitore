"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCollectionJob, startCollection } from "@/lib/api";
import type { CollectionJob } from "@/lib/types";

type Props = {
  /** 収集が正常に終わったとき（新着・トレンドを読み直させる） */
  onFinished: () => void;
};

/**
 * 「今すぐ収集」ボタン。本を登録しても、ワーカーを回すまでは動画が集まらないので、
 * 画面から収集(M2) → マッチング(M3) → トレンド集計(M5) を起動できるようにする。
 * 実行はサーバー側で進むので、状況をポーリングして進捗を出す。
 */
export function CollectNowButton({ onFinished }: Props) {
  const [job, setJob] = useState<CollectionJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wasRunning = useRef(false);

  const running = job?.status === "running";

  const poll = useCallback(async () => {
    try {
      const next = await fetchCollectionJob();
      setJob(next);
      // running → 終了 の変化を捉えて、一度だけ読み直しを促す
      if (wasRunning.current && next.status !== "running") {
        wasRunning.current = false;
        if (next.status === "succeeded") onFinished();
      }
      if (next.status === "running") wasRunning.current = true;
    } catch {
      // 状況取得の失敗はボタンを止めるほどではないので黙って次回に任せる
    }
  }, [onFinished]);

  // 別のタブや前回のセッションで走っている実行を拾うため、初回に一度だけ確認する
  useEffect(() => {
    poll();
  }, [poll]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, [running, poll]);

  async function handleClick() {
    setError(null);
    try {
      const started = await startCollection();
      setJob(started);
      wasRunning.current = started.status === "running";
    } catch (e) {
      setError(e instanceof Error ? e.message : "収集を開始できませんでした");
    }
  }

  const lastLine = job?.log?.[job.log.length - 1];

  return (
    <div className="collect-now">
      <button type="button" className="collect-btn" onClick={handleClick} disabled={running}>
        {running ? "収集中..." : "今すぐ収集"}
      </button>
      {running && lastLine && <span className="collect-status">{lastLine}</span>}
      {!running && job?.status === "succeeded" && (
        <span className={job.warning ? "collect-status collect-status-warn" : "collect-status"}>
          {job.warning ?? "収集が完了しました"}
        </span>
      )}
      {!running && job?.status === "failed" && (
        <span className="collect-status collect-status-error">{job.error ?? "収集に失敗しました"}</span>
      )}
      {error && <span className="collect-status collect-status-error">{error}</span>}
    </div>
  );
}
