import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";

/**
 * 画面の「今すぐ収集」ボタン用。収集(M2) → マッチング(M3) → トレンド集計(M5) を
 * scripts/run-workers.sh 経由でその場で実行する。
 *
 * ローカル開発用の仕組み。本番(K8s)では同じコンテナに Python ワーカーが居ないので、
 * 実行ファイルが見つからず 503 を返して無効になる（本番は CronJob / キュー経由で回す）。
 */

type JobStatus = "idle" | "running" | "succeeded" | "failed";

type Job = {
  status: JobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  /** 直近の出力。画面に進捗として出す */
  log: string[];
  error: string | null;
};

const LOG_LIMIT = 60;

const job: Job = {
  status: "idle",
  startedAt: null,
  finishedAt: null,
  log: [],
  error: null,
};

/** ワークスペースのルート（pnpm-workspace.yaml のある場所）を探す。dist 実行でも効くように上へ辿る。 */
function findRepoRoot(): string | null {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** 実行に必要なものが揃っているか。揃っていなければ理由を返す。 */
function checkRunnable(): { root: string; script: string } | string {
  const root = findRepoRoot();
  if (!root) return "リポジトリのルートが見つかりません";
  const script = join(root, "scripts", "run-workers.sh");
  if (!existsSync(script)) return "scripts/run-workers.sh が見つかりません";
  if (!existsSync(join(root, "apps", "worker", ".venv", "bin", "python"))) {
    return "ワーカーの Python 環境（apps/worker/.venv）がありません";
  }
  return { root, script };
}

// ANSI エスケープ（スクリプトの色付き見出し）を落として1行ずつ積む。
// ログは画面（GET /collect）にそのまま出るので、APIキーが混ざらないよう伏せる。
// ワーカーが例外を投げると、リクエストURLごとトレースバックに出てしまうため。
function redact(line: string): string {
  return line.replace(/([?&](?:key|api_?key|token)=)[^&\s"']+/gi, "$1***");
}

function appendLog(chunk: string) {
  for (const line of chunk.split("\n")) {
    const clean = redact(line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd());
    if (clean) job.log.push(clean);
  }
  if (job.log.length > LOG_LIMIT) job.log.splice(0, job.log.length - LOG_LIMIT);
}

/** 失敗の理由を、画面にそのまま出せる日本語にする */
function describeFailure(log: string[], code: number | null): string {
  const text = log.join("\n");
  if (/429|Too Many Requests|quotaExceeded/i.test(text)) {
    return "利用上限に達しました";
  }
  if (/connection failed|Connection refused/i.test(text)) {
    return "データベースに接続できませんでした。'docker compose up -d' でコンテナが起動しているか確認してください。";
  }
  if (/403|API key not valid|keyInvalid/i.test(text)) {
    return "YouTube API キーが無効です。apps/worker/.env の YOUTUBE_API_KEY を確認してください。";
  }
  return `ワーカーが異常終了しました（exit ${code}）`;
}

export async function collectRoutes(app: FastifyInstance) {
  // 収集パイプラインの実行状況。画面はこれをポーリングして進捗を出す。
  app.get("/collect", async () => job);

  // 収集パイプラインの起動。すぐに 202 を返し、実行はバックグラウンドで進む。
  app.post("/collect", async (_request, reply) => {
    if (job.status === "running") {
      return reply.status(409).send({ error: "すでに収集を実行中です", job });
    }

    const runnable = checkRunnable();
    if (typeof runnable === "string") {
      return reply.status(503).send({ error: `この環境では収集を実行できません: ${runnable}` });
    }

    job.status = "running";
    job.startedAt = new Date().toISOString();
    job.finishedAt = null;
    job.log = [];
    job.error = null;

    // dev サーバーは今まさに動いているので起動しない。
    // インフラ確認は残す（Postgres が落ちていると psycopg の生トレースバックで失敗するため、
    // スクリプト側の「Docker が起動していない」という案内に寄せる）。
    const child = spawn("bash", [runnable.script, "--no-app"], {
      cwd: runnable.root,
      env: process.env,
    });

    child.stdout.on("data", (d: Buffer) => appendLog(d.toString()));
    child.stderr.on("data", (d: Buffer) => appendLog(d.toString()));

    child.on("error", (err) => {
      job.status = "failed";
      job.error = err.message;
      job.finishedAt = new Date().toISOString();
      app.log.error(err, "collect job failed to start");
    });

    child.on("close", (code) => {
      job.status = code === 0 ? "succeeded" : "failed";
      job.error = code === 0 ? null : describeFailure(job.log, code);
      job.finishedAt = new Date().toISOString();
      app.log.info({ code }, "collect job finished");
    });

    return reply.status(202).send(job);
  });
}
