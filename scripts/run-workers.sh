#!/usr/bin/env bash
#
# ヨミトレ: インフラ起動 → API/Web の dev サーバー起動 → 収集(M2) → マッチング(M3) → トレンド集計(M5)。
# 実行前にマイグレーション・venv・.env まで面倒を見るので、
# 「トレンドデータがありません」と出たらこれを叩けばよい。
#
#   ./scripts/run-workers.sh                # 通常実行（YouTube API を呼ぶ）
#   ./scripts/run-workers.sh --mock         # API キーを使わず合成データで配線だけ確認
#   ./scripts/run-workers.sh --backfill     # DB内の全Contentを対象にマッチングをやり直す
#   ./scripts/run-workers.sh --only trends  # 1工程だけ実行（collect / match / trends）
#   ./scripts/run-workers.sh --skip-infra   # Docker/マイグレーションの確認を飛ばす
#   ./scripts/run-workers.sh --no-app       # API/Web の dev サーバーは起動しない
#
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
WORKER_DIR="$REPO_ROOT/apps/worker"
PY="$WORKER_DIR/.venv/bin/python"
LOG_DIR="$REPO_ROOT/.logs"

MOCK=""
BACKFILL=""
ONLY=""
SKIP_INFRA=0
START_APP=1

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m!  %s\033[0m\n' "$1"; }
die() {
  printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2
  exit 1
}

# 先頭のコメントブロックをそのまま使い方として表示する
usage() {
  awk 'NR > 2 { if (!/^#/) exit; sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mock) MOCK="--mock" ;;
    --backfill) BACKFILL="--backfill" ;;
    --only)
      ONLY="${2:-}"
      shift
      ;;
    --skip-infra) SKIP_INFRA=1 ;;
    --no-app | --skip-app) START_APP=0 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      usage
      die "不明なオプション: $1"
      ;;
  esac
  shift
done

case "$ONLY" in
  "" | collect | match | trends) ;;
  *) die "--only に指定できるのは collect / match / trends のいずれか（指定値: $ONLY）" ;;
esac

should_run() { [[ -z "$ONLY" || "$ONLY" == "$1" ]]; }

port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }

# dev サーバーを背景で起動する。ログは .logs/ に流し、ポートが開くまで待つ。
# すでに起動していれば何もしない（dev-guard.mjs の二重起動ガードに任せず、先に判定する）。
start_dev_server() {
  local name=$1 script=$2 port=$3

  if port_busy "$port"; then
    printf '   %-3s は起動済み → http://localhost:%s\n' "$name" "$port"
    return 0
  fi

  mkdir -p "$LOG_DIR"
  # 標準入出力を完全に切り離してから背景に回す。こうしないと、このスクリプトの
  # 出力をパイプ（例: | tail）に繋いだとき、dev サーバーがパイプを掴んだままになり
  # スクリプトが終わってもパイプが閉じない。nohup なので終了後も動き続ける。
  nohup pnpm "$script" >"$LOG_DIR/$name.log" 2>&1 </dev/null &

  for _ in $(seq 1 60); do
    if port_busy "$port"; then
      printf '   %-3s を起動した → http://localhost:%s\n' "$name" "$port"
      return 0
    fi
    sleep 1
  done

  die "$name が起動しない。'tail -n 40 .logs/$name.log' でログを確認する"
}

cd "$REPO_ROOT"

# ---------- 前提の確認 ----------

if [[ $SKIP_INFRA -eq 0 ]]; then
  step "インフラ（Postgres / Redis / SQS）を確認"
  docker info >/dev/null 2>&1 || die "Docker が起動していない。'open -a Docker' で起動してから再実行する"
  docker compose up -d

  ready=0
  for _ in $(seq 1 30); do
    if docker compose exec -T postgres pg_isready -U yomitore >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done
  [[ $ready -eq 1 ]] || die "Postgres が応答しない。'docker compose logs postgres' を確認する"

  # DBを作り直した直後などにテーブルが無いまま実行されるのを防ぐ。適用済みなら何もしない。
  step "DB マイグレーションを適用"
  PRISMA="$REPO_ROOT/apps/api/node_modules/.bin/prisma"
  [[ -x "$PRISMA" ]] || die "prisma が見つからない。先に 'pnpm install' を実行する"
  (cd "$REPO_ROOT/apps/api" && "$PRISMA" migrate deploy)
fi

if [[ $START_APP -eq 1 ]]; then
  # ワーカーより先に立ち上げておくと、収集・マッチングの実行中に dev サーバーの
  # ビルドが進むので、終わったころには画面がすぐ開ける。
  step "アプリを起動（API / Web）"
  start_dev_server api dev:api 4000
  start_dev_server web dev:web 3000
fi

step "ワーカーの実行環境を確認"

if [[ ! -f "$WORKER_DIR/.env" ]]; then
  cp "$WORKER_DIR/.env.example" "$WORKER_DIR/.env"
  warn "apps/worker/.env を作成した。YOUTUBE_API_KEY を設定すると実データを収集できる"
fi

if [[ ! -x "$PY" ]]; then
  warn "Python venv が無いので作成する（初回のみ数分かかる）"
  python3 -m venv "$WORKER_DIR/.venv"
  "$WORKER_DIR/.venv/bin/pip" install -q -e "$WORKER_DIR"
fi

set -a
# shellcheck disable=SC1091
source "$WORKER_DIR/.env"
set +a

if [[ -z "${YOUTUBE_API_KEY:-}" && -z "$MOCK" ]]; then
  warn "YOUTUBE_API_KEY が未設定なので --mock（合成データ）で収集する"
  MOCK="--mock"
fi

# 追跡対象が無いと収集もマッチングも空回りするので、先に気づけるようにする。
tracked=$(docker compose exec -T postgres psql -U yomitore -d yomitore -tAc \
  'SELECT count(*) FROM "TrackedItem"' 2>/dev/null | tr -d '[:space:]' || true)
if [[ "$tracked" == "0" ]]; then
  warn "追跡対象が0件。画面で本や興味分野を登録してから実行するとトレンドが出る"
else
  printf '   追跡対象: %s件\n' "${tracked:-?}"
fi

# ---------- 実行 ----------

if should_run collect; then
  step "M2: コンテンツ収集${MOCK:+（mock）}"
  (cd "$WORKER_DIR" && "$PY" main.py $MOCK)
fi

if should_run match; then
  step "M3: マッチング${BACKFILL:+（backfill）}"
  (cd "$WORKER_DIR" && "$PY" matcher_main.py $BACKFILL)
fi

if should_run trends; then
  step "M5: トレンド集計"
  (cd "$WORKER_DIR" && "$PY" trends_main.py)
fi

printf '\n\033[1;32m✓ 完了\033[0m\n'
if [[ $START_APP -eq 1 ]]; then
  printf '   画面: http://localhost:3000  /  API: http://localhost:4000\n'
  printf '   ログ: tail -f .logs/api.log .logs/web.log\n'
  printf '   停止: pnpm dev:stop\n'
else
  printf '   ブラウザを再読み込みするとトレンドに反映される\n'
fi
