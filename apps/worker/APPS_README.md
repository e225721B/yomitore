構成

このアプリには3つのコンポーネントがあります。
- web（Next.js）、api（Fastify）— JS/TSワークスペース
- worker（Python）— apps/worker に独立したPythonパッケージとして存在。新着収集・マッチング・トレンド集計を行うバッチスクリプト群

/trendsはRedisのtrends:latestキーを読むだけ、/matchesはPostgresのContent/Matchテーブルを読むだけなので、このworkerを一度も実行していないと両方とも空の結果になります（エラーではなく空データ）。

起動手順

1. インフラ（Docker） — 今回停止していたので再起動しました
cd /Users/tomokai/yomitore && docker compose up -d   # postgres, redis, sqs

2. API/Web（すでに起動済みのはずです）
pnpm dev:api   # http://localhost:4000
pnpm dev:web   # http://localhost:3000

3. Worker（新着収集・マッチング・トレンド集計） — ここが今回追加で必要な部分です

初回セットアップ:
cd apps/worker
python3 -m venv .venv
.venv/bin/pip install -e .
cp .env.example .env   # YOUTUBE_API_KEYを設定（なければ --mock で代用可）

データを更新するたびに実行:
set -a; source .env; set +a
.venv/bin/python main.py            # 新着コンテンツ収集（--mock で本物のYouTube APIキー不要）
.venv/bin/python matcher_main.py    # 興味・追跡対象とのマッチング（--backfill でDB全体を対象に）
.venv/bin/python trends_main.py     # トレンド集計をRedisに書き込み

この3つのスクリプトはローカルでは手動実行が必要です（本番ではCronJobとして定期実行される想定）。実行後、http://localhost:3000 を再読み込みすると新着（ContentFeed）とトレンド（TrendingSection）にデータが表示されます。