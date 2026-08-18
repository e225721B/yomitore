# ヨミトレ（Yomitore）

読書好きの「気になる」を、良いタイミングで届ける情報アグリゲーター。

詳細な背景・機能要件・技術選定は [SPEC.md](./SPEC.md) を参照。

## 構成

```
yomitore/
├── apps/
│   ├── web/     # Next.js（フロントエンド）
│   ├── api/     # Node.js + TypeScript + Fastify + Prisma（API サーバー）
│   └── worker/  # Python（収集・マッチング・トレンド集計ワーカー）
├── infra/
│   ├── local/elasticmq/  # ローカル用 SQS 互換キューの設定
│   └── *.tf               # AWSインフラのTerraform定義（後述）
├── docker-compose.yml  # ローカル用 Postgres(pgvector) + Redis + SQS(ElasticMQ)
└── SPEC.md
```

現状の実装スコープは MVP Must（M1〜M5）すべて: **M1: 追跡対象の登録**、**M2: 外部コンテンツの自動収集**、**M3: AIマッチング**、**M4: 新着一覧表示**、**M5: トレンド表示**。

## セットアップ

前提: Node.js 22+ / pnpm / Docker / Python 3.11+

```bash
# 1. インフラ（Postgres, Redis）を起動
docker compose up -d

# 2. JS 依存関係をインストール
pnpm install

# 3. 環境変数ファイルを用意（初回のみ）
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 4. DB マイグレーション（初回のみ）
pnpm --filter @yomitore/api prisma:migrate

# 5. API サーバー起動（http://localhost:4000）
pnpm dev:api

# 6. 別ターミナルで Web 起動（http://localhost:3000）
pnpm dev:web
```

### ローカルインフラ（Docker）の起動・停止・再起動

サービス名は `postgres` / `redis` / `sqs` の3つ。

```bash
docker compose ps                      # 状態確認
docker compose up -d                   # 起動
docker compose restart                 # 再起動（データは保持される）
docker compose restart postgres        # 個別に再起動（postgres / redis / sqs）
docker compose logs -f postgres        # ログを追う（不調の原因を見るとき）
docker compose stop                    # 停止（コンテナは残す）
docker compose down                    # 停止＋コンテナ削除（DBデータは volume に残る）
docker compose down -v && docker compose up -d   # DBを作り直す（データは全消去。マイグレーションからやり直し）
docker compose up -d --force-recreate  # docker-compose.yml を変更したあとの作り直し
```

`Cannot connect to the Docker daemon` と出るときは Docker Desktop 自体が起動していない。macOS なら次で起動してから、上のコマンドを実行する。

```bash
open -a Docker
```

### 収集ワーカー（Python, M2: YouTube収集 → Content保存 → SQS投入）

`docker compose up -d` で Postgres/Redis に加え、ローカル用 SQS 互換キュー（ElasticMQ, `collection-queue`）も起動する。

```bash
cd apps/worker
python3 -m venv .venv
.venv/bin/pip install -e .
cp .env.example .env
# .env の YOUTUBE_API_KEY に自分の YouTube Data API v3 キーを設定
#   取得先: https://console.cloud.google.com/apis/library/youtube.googleapis.com
set -a; source .env; set +a
.venv/bin/python main.py            # 実際に YouTube API を呼んで収集
.venv/bin/python main.py --mock     # API キーなしで DB/SQS 配線だけ検証（合成データ使用）
```

収集ワーカーは、追跡対象（本・興味分野）ごとに `title` をクエリとして YouTube を検索し、動画メタデータを `Content` テーブルに保存する（`source` + `sourceId` で重複排除）。新規保存した Content は SQS の `collection-queue` に `{ contentId, source, sourceId }` として投入される。

加えて、追跡対象によらないホットトピック（`HOT_TOPICS` 環境変数、カンマ区切り。未設定なら `yomitore_worker/hot_topics.py` の既定値）でも収集し、そのキーワードを `Content.topic` に記録する。ユーザーがすでに登録している分野と重なるトピックは収集前に除外される。これが「その他（今、熱い分野）」タブの供給源になる。

### マッチワーカー（Python, M3: 埋め込み生成 → pgvectorで意味マッチング）

```bash
cd apps/worker
set -a; source .env; set +a
.venv/bin/python matcher_main.py             # SQSからContentを取り出してマッチング
.venv/bin/python matcher_main.py --backfill  # SQSを使わず、DB内の全Contentを対象にマッチングをやり直す
```

マッチワーカーは、埋め込みモデル `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`（384次元・多言語対応・ローカル推論、APIキー不要）で追跡対象とContentをベクトル化し、pgvectorのコサイン距離演算子(`<=>`)で類似度を計算する。追跡対象の埋め込みは未生成のものだけ都度計算してキャッシュする。類似度が `MATCH_SCORE_THRESHOLD`（デフォルト `0.3`）以上の組み合わせを `Match` テーブルに保存する。

> **既知の制約**: 使用モデルは短文同士のコサイン類似度が0〜1全域に広がらず、実測では明確に無関係なもので0.1前後、強く関連するもので0.7前後に収まる傾向がある。同じ動画でも「本のタイトル」より「興味分野（ジャンル名）」の方がスコアが高く出やすく、単一の絶対閾値では取りこぼし（false negative）が発生し得る。本番投入前にラベル付きデータでの閾値調整、またはトップK方式への変更を検討すること。

### 新着一覧（M4）

Web のダッシュボード（`http://localhost:3000`）は 4 つのカテゴリタブに分かれており、それぞれが API の `GET /matches?category=...` を呼んで、そのカテゴリの「トレンドの新着」を表示する。

| タブ | `category` | 中身 |
|---|---|---|
| 興味分野 | `INTEREST` | `TrackedItem.type = INTEREST` にマッチしたコンテンツ |
| 読んだ本 | `FINISHED` | `type = BOOK` かつ `bookStatus = FINISHED` にマッチしたコンテンツ |
| 気になる本 | `WANT` | `type = BOOK` かつ `bookStatus = WANT` にマッチしたコンテンツ |
| その他 | `OTHER` | `topic` を持ち、どの追跡対象にもマッチしなかったコンテンツ（＝登録外の熱い分野） |

本の読書状態（`bookStatus`）は一覧・詳細画面の「読み終わった」ボタン（`PATCH /tracked-items/:id`）で切り替えられ、切り替えるとその本と関連コンテンツがタブ間を移動する。

並び順は単なる `collectedAt` 降順ではなく、直近 `TREND_WINDOW_DAYS` 以内のコンテンツを対象に「関連する追跡対象の一致度の合計 × 新しさの係数（集計期間の端で 0.5 まで減衰）」で降順に並べる。期間内に 1 件もない場合は期間の制限を外して補う。

### トレンド集計ワーカー（Python, M5: DB集計 → Redisキャッシュ）

```bash
cd apps/worker
set -a; source .env; set +a
.venv/bin/python trends_main.py
```

追跡対象ごとに、直近 `TREND_WINDOW_DAYS`（デフォルト7日）以内に収集された `Match` 件数を集計し、Redisキー `trends:latest` にJSONで保存する。仕様通り、**API（`GET /trends`）はこのキャッシュを読むだけでDBには一切アクセスしない**ため高速に応答する。Webの「トレンド」セクションが件数の多い順にランキング表示する。

集計結果は 2 本立てで、`items` が追跡対象のランキング（`category` 付き。API はこれをタブごとに絞り込む）、`topics` が「その他」タブ用の、どの追跡対象にもマッチしなかったホットトピックのランキング。

> ローカルでは手動実行だが、本番では収集ワーカー・マッチワーカーと同様に定期実行（CronJob）される想定。

## API

| メソッド | パス | 概要 |
|---|---|---|
| GET | /tracked-items | 追跡対象の一覧取得（`category`: `INTEREST` \| `FINISHED` \| `WANT` で絞り込み可） |
| POST | /tracked-items | 追跡対象の登録（`type`: `BOOK` \| `INTEREST`, `title`, `note?`, `bookStatus?`: `WANT` \| `FINISHED`。本で省略時は `WANT`） |
| PATCH | /tracked-items/:id | 読書状態・メモの更新（`bookStatus`, `note`） |
| DELETE | /tracked-items/:id | 追跡対象の削除 |
| GET | /matches | カテゴリごとのトレンド新着（`category` または `trackedItemId` で絞り込み、最大50件） |
| GET | /trends | トレンドランキング（`category` で絞り込み。Redisキャッシュのみ参照、DBアクセスなし） |

## インフラ（AWS / Terraform）

`infra/` 配下にTerraformでAWSインフラを定義済み。リージョンは `ap-northeast-1`（東京）。ローカルstate（`infra/`直下に`.tfstate`、gitignore対象）。

### 構築済みリソース

| ファイル | 内容 |
|---|---|
| `versions.tf` / `provider.tf` / `variables.tf` / `locals.tf` | Terraform/AWSプロバイダ設定、共通変数、命名規則（`yomitore-dev-*`） |
| `network.tf` | VPC、パブリック/プライベートサブネット×2AZ、IGW、NAT Gateway（コスト優先で1台のみ）、ルートテーブル |
| `ecr.tf` | api/worker用ECRリポジトリ（イメージスキャン有効、未タグイメージ7日で自動削除） |
| `security_groups.tf` | セキュリティグループ運用方針のメモ（RDS/RedisはEKSクラスタSGからのingressのみ許可） |
| `rds.tf` | RDS PostgreSQL `16.14`（`db.t4g.micro`、pgvector対応、Secrets Manager管理パスワード、プライベートサブネット） |
| `redis.tf` | ElastiCache Redis `7.1`（`cache.t4g.micro`、シングルノード） |
| `sqs.tf` | 収集キュー（`collection-queue`）+ DLQ（5回失敗で退避） |
| `eks.tf` | EKSクラスタ（Kubernetes `1.34`）+ マネージドノードグループ（`t3.small`×1、min1/max2） |
| `irsa.tf` | OIDCプロバイダ + IRSA用IAMロール2種（worker: SQS操作のみ／api: DBシークレット読み取りのみ、最小権限） |
| `frontend.tf` | S3（非公開）+ CloudFront（Origin Access Control経由のみ配信許可） |

### 適用・破棄

```bash
cd infra
terraform init
terraform plan
terraform apply    # AWSに実際にリソースを作成（課金開始）
terraform destroy  # 作成したAWSリソースを全て削除（課金停止）
```

### コストの目安（実測ベース、稼働中の概算）

| リソース | 単価（東京リージョン） | 備考 |
|---|---|---|
| EKSコントロールプレーン | $0.10/h（固定） | クラスタが存在する限り課金 |
| EKSノード（t3.small×1） | $0.0272/h | AWS Pricing APIで確認済みの実単価 |
| RDS db.t4g.micro | $0.025/h | + ストレージ20GB(gp3) |
| ElastiCache cache.t4g.micro | $0.0400/h | |
| NAT Gateway | 約$0.062/h + データ処理料 | 起動している限り課金。**放置時に一番気づきにくいコスト** |
| SQS / ECR / S3 / CloudFront | ほぼ使用量課金 | アクセスがなければ数セント程度 |

合計で常時稼働だと1日あたり$5〜6程度（月換算で$150〜180程度）。**使わない時間は`terraform destroy`で止めるのが前提**の構成（学習・ポートフォリオ用途のため、本番のような常時稼働は想定していない）。

### IAMユーザーの前提

`aws configure` で設定するIAMユーザーには `AdministratorAccess` を付与している（個人の学習用アカウント前提の簡略設定。チーム/本番アカウントではより絞ったポリシーにすべき）。

## 今後のロードマップ（未実装）

MVP Must（M1〜M5）とAWSインフラの土台（VPC/RDS/Redis/SQS/EKS/IRSA/S3+CloudFront）は実装済み。残っているのは以下:

- **Kubernetesへのアプリデプロイ**: apps/api・apps/workerのコンテナイメージをビルドしてECRにpush、K8sマニフェスト（Deployment/Service/CronJob/ServiceAccount＋IRSA annotation）を作成しEKSに適用する
- **フロントの静的配信化**: apps/webを`output: "export"`で静的ビルドし、S3への同期＋CloudFrontキャッシュ無効化を行うデプロイスクリプトを作る
- **Youtube API以外のAPIを使用してのスクレイピング**: YouTube以外のSNS（tiktok,Xなど）からも関心に入れた本のトレンドをスクレイピングすることができるようにする
- **Terraformのリモートstate化**: 現状はローカルstate。S3バックエンド+DynamoDBロックへの移行（チーム開発を想定するなら次にやるべき一歩）
- S1: AIによる動画要約・ネタバレ度タグ付け
- S2: プッシュ通知
