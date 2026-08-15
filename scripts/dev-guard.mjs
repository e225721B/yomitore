// dev サーバーの二重起動を防ぐガード。
//
// Next.js の dev サーバーは起動時に .next を作り直すため、同じ .next を共有する
// 2つ目の dev サーバーが立ち上がると、ポートを握っている側のマニフェストが壊れ、
// 「missing required error components」で 500 になる。
// 起動前にポートの占有を確認し、埋まっていれば起動せずに落とす。
//
//   node scripts/dev-guard.mjs <port>          ポートが空いているか確認（埋まっていれば exit 1）
//   node scripts/dev-guard.mjs --kill <port>…  そのポートを握っているプロセスを停止

import { execFileSync } from "node:child_process";

function listeners(port) {
  try {
    const out = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
    });
    return out.split("\n").filter(Boolean);
  } catch {
    return []; // 該当なしのとき lsof は exit 1
  }
}

function describe(pid) {
  try {
    return execFileSync("ps", ["-o", "command=", "-p", pid], { encoding: "utf8" }).trim();
  } catch {
    return "(unknown)";
  }
}

const args = process.argv.slice(2);

if (args[0] === "--kill") {
  for (const port of args.slice(1)) {
    for (const pid of listeners(port)) {
      console.log(`ポート ${port} の dev サーバーを停止します: PID ${pid}`);
      try {
        process.kill(Number(pid), "SIGTERM");
      } catch (e) {
        console.error(`  停止に失敗: ${e.message}`);
      }
    }
  }
  process.exit(0);
}

const port = args[0];
const pids = listeners(port);

if (pids.length > 0) {
  console.error(`\n✗ ポート ${port} はすでに使用中です。dev サーバーを二重に起動しようとしています。\n`);
  for (const pid of pids) {
    console.error(`  PID ${pid}: ${describe(pid)}`);
  }
  console.error(`
このまま2つ目を起動すると .next が壊れて 500 になります。
既存のものを使うか、停止してから起動し直してください:

  pnpm dev:stop
`);
  process.exit(1);
}
