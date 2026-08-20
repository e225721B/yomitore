# ヨミトレ（Yomitore）

読書好きの「気になる」を、良いタイミングで届ける情報アグリゲーター。

登録した本や興味分野に関連する動画をYouTubeから自動で集め、AIが意味的に結びつけて「今の話題」として届ける。さらに、読んだ本の**続編や同じ著者の新刊**が出たら知らせる。

- [概要](#概要)
- [アプリ構成](#アプリ構成)
- [起動方法](#起動方法)
- [機能詳細](#機能詳細)
- [インフラ（AWS / Terraform）](#インフラaws--terraform)
- [今後のロードマップ](#今後のロードマップ)

詳細な背景・機能要件・技術選定は [SPEC.md](./SPEC.md) を参照。

---

## 概要

### できること

| したいこと | 画面 |
|---|---|
| 読み終わった本を登録する | サイドバー「読んだ本を登録」→ タイトル検索して連続登録 |
| 気になる本・興味分野を登録する | ダッシュボードの各タブ |
| 関連動画の新着を見る | ダッシュボード（カテゴリタブごと） |
| 盛り上がっている対象を知る | ダッシュボードの「トレンド」 |
| 続編・新刊の通知を受け取る | サイドバー「新刊・続編」（未読バッジ付き） |
| 最新データを取り込む | ダッシュボードの「今すぐ収集」ボタン |

### 実装スコープ

| 内容 |
|---|
| 追跡対象（本・興味分野）の登録 |
| 外部コンテンツの自動収集（YouTube） |
| AIマッチング（埋め込み + pgvector） |
| 新着一覧表示 |
| トレンド表示 |

加えて、読了本の登録画面（読了日つき）、続編・新刊の通知、拡張前提の左サイドバーを実装している。

---

## アプリ構成

### ディレクトリ

```
yomitore/
├── apps/
│   ├── web/     # Next.js（フロントエンド）
│   ├── api/     # Fastify + Prisma（APIサーバー）
│   ├── worker/  # Python（収集・マッチング・トレンド・新刊チェック）
│   └── assets/  # アプリアイコンなどの原本
├── infra/
│   ├── local/elasticmq/  # ローカル用 SQS 互換キューの設定
│   └── *.tf              # AWSインフラのTerraform定義
├── scripts/
│   ├── run-workers.sh    # ローカル環境の一括起動（pnpm workers）
│   └── dev-guard.mjs     # devサーバーの二重起動ガード
├── docker-compose.yml    # Postgres(pgvector) + Redis + SQS(ElasticMQ)
└── SPEC.md
```

### 技術構成

| 層 | 技術 | 役割 |
|---|---|---|
| Web | Next.js 15 / React 18 | 画面。CSSは自前（Warm Paper テーマ） |
| API | Fastify / Prisma / Zod | DBとRedisの読み書き。重い処理は持たない |
| ワーカー | Python 3.11 / fastembed / psycopg | 収集・埋め込み生成・マッチング・集計・新刊チェック |
| DB | PostgreSQL 16 + pgvector | 本体データと384次元の埋め込みベクトル |
| キャッシュ | Redis | トレンド集計結果（`trends:latest`） |
| キュー | SQS（ローカルは ElasticMQ） | 収集 → マッチングの受け渡し |

### データの流れ

```
[ユーザー] 本・興味分野を登録
      ↓ TrackedItem
[収集ワーカー] YouTube を検索 ──→ Content ──→ SQS
      ↓
[マッチワーカー] 埋め込み生成 → pgvector で類似度計算 ──→ Match
      ↓
[トレンドワーカー] Match を集計 ──→ Redis（trends:latest）
      ↓
[API] /matches（DB） /trends（Redisのみ）
      ↓
[画面] カテゴリタブごとの新着とランキング

[新刊ワーカー] Google Books を著者で検索 ──→ BookRelease ──→ サイドバーの未読バッジ
```

### 主なデータモデル

| モデル | 役割 |
|---|---|
| `TrackedItem` | 追跡対象。本（`BOOK`）と興味分野（`INTEREST`）を1つのモデルで扱う。本は `bookStatus`（`WANT` / `FINISHED`）と `finishedAt`（読了日）を持つ |
| `Content` | 収集した動画。`(source, sourceId)` で重複排除。ホットトピック起点なら `topic` を持つ |
| `Match` | 追跡対象 × コンテンツ の類似度。`score` 付き |
| `BookRelease` | 検出した続編・新刊。`(trackedItemId, isbn)` で重複通知を防ぐ。`seenAt` が既読管理 |

### カテゴリの考え方

画面の4タブは `TrackedItem` の種別と読書状態から導かれる。

| タブ | `category` | 中身 |
|---|---|---|
| 興味分野 | `INTEREST` | `type = INTEREST` |
| 読んだ本 | `FINISHED` | `type = BOOK` かつ `bookStatus = FINISHED` |
| 気になる本 | `WANT` | `type = BOOK` かつ `bookStatus = WANT` |
| その他 | `OTHER` | 追跡対象に紐づかないホットトピック由来のコンテンツ |

判定はAPI側の `apps/api/src/categories.ts` に集約し、レスポンスに `category` を含めることで、フロントで再計算しなくて済むようにしている。

---

## 起動方法

前提: Node.js 22+ / pnpm / Docker / Python 3.11+

### 初回セットアップ

```bash
pnpm install

# 環境変数ファイルを用意
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/worker/.env.example apps/worker/.env
```

APIキーを `.env` に設定する（無くても動くが、収集と新刊チェックはスキップされる）。

| キー | 置き場所 | 取得先 |
|---|---|---|
| `YOUTUBE_API_KEY` | `apps/worker/.env` | [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) |
| `GOOGLE_BOOKS_API_KEY` | `apps/api/.env` と `apps/worker/.env` | [Google Books API](https://console.cloud.google.com/apis/library/books.googleapis.com) |

### 2回目以降（これ1つでよい）

```bash
pnpm workers
```

`scripts/run-workers.sh` が、インフラ起動から画面が見られる状態まで一本で持っていく。

1. **インフラ**: Dockerの起動を確認し、Postgresが応答するまで待つ
2. **マイグレーション**: `prisma migrate deploy`（適用済みなら何もしない）
3. **devサーバー**: API（:4000）とWeb（:3000）を背景で起動。起動済みならそのまま使う
4. **ワーカー**: 収集 → マッチング → トレンド集計 → 新刊チェック

`apps/worker` の `.venv` / `.env` が無ければ自動で作り、`YOUTUBE_API_KEY` が未設定なら `--mock` に切り替える。追跡対象が0件なら警告する。

```bash
./scripts/run-workers.sh --mock         # YouTube を呼ばず合成データで配線だけ確認
./scripts/run-workers.sh --backfill     # DB内の全Contentを対象にマッチングをやり直す
./scripts/run-workers.sh --only trends  # 1工程だけ（collect / match / trends / releases）
./scripts/run-workers.sh --skip-infra   # Docker/マイグレーションの確認を飛ばす
./scripts/run-workers.sh --no-app       # devサーバーは起動せず、ワーカーだけ回す
./scripts/run-workers.sh --help
```

devサーバーはスクリプト終了後も動き続ける。

```bash
tail -f .logs/api.log .logs/web.log   # ログ
pnpm dev:stop                         # 停止
```

### 個別に起動する

```bash
pnpm dev:api    # APIサーバー（http://localhost:4000）
pnpm dev:web    # Web（http://localhost:3000）

cd apps/worker && set -a && source .env && set +a
.venv/bin/python main.py           # 収集（--mock / --force）
.venv/bin/python matcher_main.py   # マッチング（--backfill）
.venv/bin/python trends_main.py    # トレンド集計
.venv/bin/python releases_main.py  # 続編・新刊チェック
```

### Docker（Postgres / Redis / SQS）

```bash
docker compose ps                      # 状態確認
docker compose up -d                   # 起動
docker compose restart                 # 再起動（データは保持）
docker compose restart postgres        # 個別に再起動
docker compose logs -f postgres        # ログを追う
docker compose down                    # 停止（DBデータは volume に残る）
docker compose down -v && docker compose up -d   # DBを作り直す（データ全消去）
docker compose up -d --force-recreate  # compose ファイル変更後の作り直し
```

### 困ったとき

| 症状 | 原因と対処 |
|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop が起動していない → `open -a Docker` |
| `The table ... does not exist`（500） | マイグレーション未適用 → `pnpm workers`（自動で適用される） |
| 「まだトレンドデータがありません」 | ワーカー未実行 → `pnpm workers` か画面の「今すぐ収集」 |
| 収集が `割り当てを使い切りました` | YouTubeのクォータ切れ。日本時間16時ごろリセット。それまでは `--mock` で確認 |
| Webが500（`MODULE_NOT_FOUND`） | devサーバー起動中に `next build` すると `.next` が壊れる → `pnpm dev:stop && rm -rf apps/web/.next && pnpm workers` |

---

## 機能詳細

### 画面

左サイドバーが全ページ共通のナビゲーション。項目の追加は [`apps/web/lib/nav.ts`](apps/web/lib/nav.ts) の `NAV_SECTIONS` に1つ足すだけで済み、`Sidebar.tsx` は触らなくてよい。900px以下では上部の横並びバーに切り替わる。タイトル画面とオンボーディングでは非表示。

| パス | 画面 |
|---|---|
| `/` | ダッシュボード（4カテゴリタブ・トレンド・新着） |
| `/books/finished/new` | 読んだ本の登録 |
| `/releases` | 新刊・続編のお知らせ |
| `/tracked/[id]` | 追跡対象の詳細と関連コンテンツ |
| `/welcome` `/onboarding` | タイトル画面と初回設定 |

### 読了本の登録（`/books/finished/new`）

タイトルで検索して選ぶだけで登録できる。検索欄は出したままにしてあるので、**続けて何冊でも登録できる**（登録済みの本は検索結果で「追加済み」になる）。

- 読了日は上部に1つだけ置き、連続登録の間は維持される
- 感想メモを本ごとに添えられる
- 検索で見つからない本は手入力で登録できる
- 登録した本はページ下部に積み上がる

読了日は `TrackedItem.finishedAt` に保存され、一覧・詳細に「2026年8月19日に読了」と表示される。ダッシュボードの「読み終わった」ボタンで `FINISHED` にしたときも自動で読了日が入り、「気になる」に戻すと消える。

### 収集ワーカー（M2: YouTube → Content → SQS）

追跡対象の `title` をクエリとしてYouTubeを検索し、動画メタデータを `Content` に保存する。新規保存分はSQSの `collection-queue` に投入され、マッチワーカーが拾う。

追跡対象とは別に、ホットトピック（`HOT_TOPICS` 環境変数、既定値は `yomitore_worker/hot_topics.py`）でも収集し、キーワードを `Content.topic` に記録する。これが「その他（今、熱い分野）」タブの供給源になる。登録済みの分野と重なるトピックは収集前に除外される。

**APIクォータの節約**（無料枠は1日10,000ユニット、検索1回100ユニット固定）:

| 工夫 | 効果 |
|---|---|
| `MAX_RESULTS_PER_QUERY=50` | 取得件数に関わらずコストは同じなので、1回で50件取る（既定の5件は10倍割高だった） |
| `COLLECT_COOLDOWN_HOURS=6` | 直近に収集した対象は再検索しない。「今すぐ収集」の連打が無害になる |
| クォータ切れの打ち切り | 429を受けたら以降の検索を中止し、無駄なリクエストを投げない |
| 失敗時は未収集のまま | 印を付けるのは成功時だけ。失敗した対象が6時間ロックされるのを防ぐ |
| `--mock` は印を付けない | 合成データでの確認が本物の収集を止めない |

クールダウンを無視して引き直したいときは `--force`。

### マッチワーカー（埋め込み生成 → pgvector）

`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`（384次元・多言語・ローカル推論、APIキー不要）で追跡対象とコンテンツをベクトル化し、pgvectorのコサイン距離（`<=>`）で類似度を計算する。追跡対象の埋め込みは未生成のものだけ計算してDBに残す。`MATCH_SCORE_THRESHOLD`（既定 `0.3`）以上の組み合わせを `Match` に保存する。

> **既知の制約**: このモデルは短文同士の類似度が0〜1全域に広がらず、実測で無関係なもの0.1前後・強い関連0.7前後に収まる。同じ動画でも「本のタイトル」より「興味分野」の方が高く出やすく、単一の絶対閾値では取りこぼしが出る。本番前にラベル付きデータでの閾値調整、またはトップK方式を検討すること。

### 新着一覧（M4）

各タブが `GET /matches?category=...` を呼ぶ。並び順は単純な新着順ではなく、直近 `TREND_WINDOW_DAYS` 以内のコンテンツを対象に「関連する追跡対象の一致度の合計 × 新しさの係数（期間の端で0.5まで減衰）」で降順。期間内に1件もなければ期間制限を外して補う。

### トレンド集計（M5: DB集計 → Redis）

直近 `TREND_WINDOW_DAYS`（既定7日）以内の `Match` 件数を追跡対象ごとに集計し、Redisキー `trends:latest` にJSONで保存する。**`GET /trends` はこのキャッシュを読むだけでDBに触らない**ため高速に応答する。

集計結果は2本立てで、`items` が追跡対象のランキング（`category` 付き。APIがタブごとに絞り込む）、`topics` が「その他」タブ用のホットトピックのランキング。

### 続編・新刊の通知（Google Books）

登録した本の著者でGoogle Booksを検索し、**続編**（シリーズの続き）と**同じ著者の新刊**を `BookRelease` に記録する。サイドバーの「新刊・続編」に未読バッジが出る。

- 続編判定は、タイトルから巻数・サブタイトルを落とした「シリーズ名」で行う（`三体` → `三体Ⅱ 黒暗森林 上` は続編、`円 劉慈欣短篇集` は同じ著者の新刊）。同じ本そのものは通知しない
- 重複通知は `(trackedItemId, isbn)` の一意制約で防ぐ（ISBNが取れない本は `gb:<volumeId>` を代わりの鍵にする）
- 著者が未登録の本は、タイトルから著者を引いて補完し `TrackedItem.author` に保存する（次回以降はこの検索が不要になる）
- `RELEASE_RECENT_DAYS`（既定180日）より古い発売のものは通知しない

> Google Books は発売前の書籍が載りにくいため、発売予定の通知としては後追いになりやすい。

### 「今すぐ収集」ボタン

本を登録しただけでは動画は増えない。収集 → マッチング → 集計を回して初めて画面に反映される。ダッシュボードの「今すぐ収集」を押すと、APIが `scripts/run-workers.sh --no-app` を起動して同じパイプラインをその場で実行する。

- 実行中はボタンに進捗（`▶ コンテンツ収集中` など）が出る
- 終わると新着とトレンドを自動で読み直す
- 二重起動しない（実行中は409）
- クォータ切れなど、失敗の理由は日本語で表示する
- 所要は実測15秒程度（初回は埋め込みモデルの読み込みで数分）

ローカル開発用の仕組みである点に注意。APIが同じマシンのPythonワーカーを直接起動するため、`apps/worker/.venv` が無い環境（本番のコンテナなど）では `POST /collect` が503を返して無効になる。本番では収集ワーカーをCronJobとして定期実行する想定。

### API

| メソッド | パス | 概要 |
|---|---|---|
| GET | `/tracked-items` | 追跡対象の一覧（`category` で絞り込み可） |
| POST | `/tracked-items` | 登録（`type`, `title`, `note?`, `author?`, `bookStatus?`, `finishedAt?`）。本で省略時は `WANT`、`FINISHED` で読了日省略時は登録時刻 |
| PATCH | `/tracked-items/:id` | 読書状態・読了日・メモの更新。`FINISHED` にすると読了日が入り、`WANT` に戻すと消える |
| DELETE | `/tracked-items/:id` | 削除 |
| GET | `/matches` | カテゴリごとの新着（`category` / `trackedItemId` で絞り込み、最大50件） |
| GET | `/trends` | トレンドランキング（Redisキャッシュのみ参照） |
| GET | `/books/search` | 書籍検索（Google Books） |
| POST | `/collect` | 収集パイプラインの起動。202を返し実行は非同期。実行中は409、実行不可な環境では503 |
| GET | `/collect` | 収集の実行状況（`idle` / `running` / `succeeded` / `failed`、出力ログ付き） |
| GET | `/releases` | 続編・新刊の一覧（`unseen=true` で未読のみ、最大100件） |
| PATCH | `/releases/:id` | 既読／未読の切り替え |
| POST | `/releases/seen-all` | 未読をまとめて既読にする |

---

## インフラ（AWS / Terraform）

`infra/` 配下にTerraformで定義済み。リージョンは `ap-northeast-1`（東京）、stateはローカル（gitignore対象）。

| ファイル | 内容 |
|---|---|
| `versions.tf` / `provider.tf` / `variables.tf` / `locals.tf` | プロバイダ設定、共通変数、命名規則（`yomitore-dev-*`） |
| `network.tf` | VPC、パブリック/プライベートサブネット×2AZ、IGW、NAT Gateway（コスト優先で1台）、ルートテーブル |
| `ecr.tf` | api/worker用ECRリポジトリ（スキャン有効、未タグ7日で削除） |
| `security_groups.tf` | SG運用方針のメモ（RDS/RedisはEKSクラスタSGからのingressのみ） |
| `rds.tf` | RDS PostgreSQL 16.14（`db.t4g.micro`、pgvector、Secrets Manager管理パスワード） |
| `redis.tf` | ElastiCache Redis 7.1（`cache.t4g.micro`、シングルノード） |
| `sqs.tf` | 収集キュー + DLQ（5回失敗で退避） |
| `eks.tf` | EKSクラスタ（K8s 1.34）+ ノードグループ（`t3.small`×1、min1/max2） |
| `irsa.tf` | OIDCプロバイダ + IRSA用IAMロール2種（worker: SQSのみ／api: DBシークレット読み取りのみ） |
| `frontend.tf` | S3（非公開）+ CloudFront（OAC経由のみ配信） |

```bash
cd infra
terraform init
terraform plan
terraform apply    # リソース作成（課金開始）
terraform destroy  # 全削除（課金停止）
```

### コストの目安

| リソース | 単価（東京） | 備考 |
|---|---|---|
| EKSコントロールプレーン | $0.10/h | クラスタが存在する限り課金 |
| EKSノード（t3.small×1） | $0.0272/h | |
| RDS db.t4g.micro | $0.025/h | + ストレージ20GB(gp3) |
| ElastiCache cache.t4g.micro | $0.0400/h | |
| NAT Gateway | 約$0.062/h + データ処理料 | **放置時に一番気づきにくいコスト** |
| SQS / ECR / S3 / CloudFront | ほぼ使用量課金 | アクセスがなければ数セント |

常時稼働で1日$5〜6（月$150〜180）。**使わない時間は `terraform destroy` で止める前提**の構成（学習・ポートフォリオ用途のため常時稼働は想定していない）。

`aws configure` で使うIAMユーザーには `AdministratorAccess` を付与している（個人の学習用アカウント前提の簡略設定。チーム/本番ではより絞ったポリシーにすべき）。

---

## 今後のロードマップ

MVP Must（M1〜M5）とAWSインフラの土台は実装済み。残りは以下。

- **Kubernetesへのデプロイ**: api・workerのイメージをECRにpushし、K8sマニフェスト（Deployment/Service/CronJob/ServiceAccount + IRSA annotation）を作成してEKSに適用する
- **フロントの静的配信化**: `output: "export"` で静的ビルドし、S3同期 + CloudFrontキャッシュ無効化を行うデプロイスクリプトを作る
- **YouTube以外からの収集**: TikTok・X など他プラットフォームにも広げる。あわせて、クォータを消費しないチャンネルRSS方式（`playlistItems.list` は検索の1/100のコスト）への移行も検討する
- **ホットトピック収集の頻度分離**: 現状は毎回6トピック分（600ユニット）を検索している。1日1回で十分
- **Terraformのリモートstate化**: S3バックエンド + DynamoDBロックへの移行
- S1: AIによる動画要約・ネタバレ度タグ付け
- S2: プッシュ通知（現状は画面内通知のみ）
