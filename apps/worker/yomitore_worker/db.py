import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

import psycopg


@dataclass(frozen=True)
class TrackedItem:
    id: str
    type: str
    title: str
    note: str | None = None
    book_status: str | None = None
    # 収集ワーカーが最後にこの対象で検索した時刻。クールダウン判定に使う。
    last_collected_at: datetime | None = None


def category_of(item_type: str, book_status: str | None) -> str:
    """画面のカテゴリタブに対応する分類。API 側の categoryOf と対になる。"""
    if item_type == "INTEREST":
        return "INTEREST"
    return "FINISHED" if book_status == "FINISHED" else "WANT"


@dataclass(frozen=True)
class RawContent:
    source_id: str
    title: str
    description: str | None
    url: str
    thumbnail_url: str | None
    channel_title: str | None
    published_at: datetime | None


def connect(database_url: str) -> psycopg.Connection:
    return psycopg.connect(database_url, autocommit=True)


def fetch_tracked_items(conn: psycopg.Connection) -> list[TrackedItem]:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, type, title, note, "bookStatus", "lastCollectedAt" '
            'FROM "TrackedItem" ORDER BY "createdAt" DESC'
        )
        return [
            TrackedItem(
                id=row[0],
                type=row[1],
                title=row[2],
                note=row[3],
                book_status=row[4],
                last_collected_at=row[5],
            )
            for row in cur.fetchall()
        ]


def mark_collected(conn: psycopg.Connection, tracked_item_id: str) -> None:
    """収集済みの印を付ける。次回以降、クールダウン中は再検索しない。"""
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "TrackedItem" SET "lastCollectedAt" = %s WHERE id = %s',
            (datetime.now(timezone.utc).replace(tzinfo=None), tracked_item_id),
        )


def upsert_content(conn: psycopg.Connection, content: RawContent, topic: str | None = None) -> tuple[str, bool]:
    """収集した動画を Content に保存する。既存(source, sourceId)なら何もせず既存IDを返す。

    topic はホットトピック起点で収集した場合の検索キーワード（「その他」タブ用）。
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "Content"
                (id, source, "sourceId", title, description, url, "thumbnailUrl", "channelTitle",
                 "publishedAt", topic)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (source, "sourceId") DO NOTHING
            RETURNING id
            """,
            (
                str(uuid.uuid4()),
                "YOUTUBE",
                content.source_id,
                content.title,
                content.description,
                content.url,
                content.thumbnail_url,
                content.channel_title,
                content.published_at,
                topic,
            ),
        )
        row = cur.fetchone()
        if row is not None:
            return row[0], True

        # 追跡対象起点で先に収集済みだった動画が、今回ホットトピックとしても
        # 見つかった場合は topic を補う（逆に上書きはしない）。
        cur.execute(
            """
            UPDATE "Content" SET topic = COALESCE(topic, %s)
            WHERE source = %s AND "sourceId" = %s
            RETURNING id
            """,
            (topic, "YOUTUBE", content.source_id),
        )
        existing = cur.fetchone()
        assert existing is not None
        return existing[0], False


def fetch_content(conn: psycopg.Connection, content_id: str) -> dict | None:
    with conn.cursor() as cur:
        cur.execute('SELECT id, title, description FROM "Content" WHERE id = %s', (content_id,))
        row = cur.fetchone()
        if row is None:
            return None
        return {"id": row[0], "title": row[1], "description": row[2]}


def update_content_embedding(conn: psycopg.Connection, content_id: str, vector_literal: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "Content" SET embedding = %s::vector WHERE id = %s',
            (vector_literal, content_id),
        )


def fetch_tracked_items_missing_embedding(conn: psycopg.Connection) -> list[TrackedItem]:
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id, type, title, note, "bookStatus" FROM "TrackedItem" WHERE embedding IS NULL'
        )
        return [
            TrackedItem(id=row[0], type=row[1], title=row[2], note=row[3], book_status=row[4])
            for row in cur.fetchall()
        ]


def update_tracked_item_embedding(conn: psycopg.Connection, tracked_item_id: str, vector_literal: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "TrackedItem" SET embedding = %s::vector WHERE id = %s',
            (vector_literal, tracked_item_id),
        )


def find_matching_tracked_items(
    conn: psycopg.Connection, content_vector_literal: str, threshold: float
) -> list[tuple[str, str, float]]:
    """コサイン類似度 (1 - コサイン距離) が threshold 以上の追跡対象を類似度降順で返す。"""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, title, 1 - (embedding <=> %s::vector) AS score
            FROM "TrackedItem"
            WHERE embedding IS NOT NULL
              AND 1 - (embedding <=> %s::vector) >= %s
            ORDER BY score DESC
            """,
            (content_vector_literal, content_vector_literal, threshold),
        )
        return [(row[0], row[1], row[2]) for row in cur.fetchall()]


def upsert_match(conn: psycopg.Connection, tracked_item_id: str, content_id: str, score: float) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "Match" (id, "trackedItemId", "contentId", score)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT ("trackedItemId", "contentId") DO UPDATE SET score = EXCLUDED.score
            """,
            (str(uuid.uuid4()), tracked_item_id, content_id, score),
        )


def fetch_all_content_ids(conn: psycopg.Connection) -> list[str]:
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM "Content" ORDER BY "collectedAt"')
        return [row[0] for row in cur.fetchall()]


def fetch_trend_counts(conn: psycopg.Connection, window_days: int) -> list[dict]:
    """直近 window_days 日以内に収集されたコンテンツとマッチした件数を追跡対象ごとに集計する。"""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT ti.id, ti.type, ti."bookStatus", ti.title,
                   COUNT(m.id) FILTER (
                       WHERE c."collectedAt" >= now() - make_interval(days => %s)
                   ) AS match_count
            FROM "TrackedItem" ti
            LEFT JOIN "Match" m ON m."trackedItemId" = ti.id
            LEFT JOIN "Content" c ON c.id = m."contentId"
            GROUP BY ti.id, ti.type, ti."bookStatus", ti.title
            ORDER BY match_count DESC, ti."createdAt" ASC
            """,
            (window_days,),
        )
        return [
            {
                "trackedItemId": row[0],
                "type": row[1],
                "bookStatus": row[2],
                "category": category_of(row[1], row[2]),
                "title": row[3],
                "matchCount": row[4],
            }
            for row in cur.fetchall()
        ]


def fetch_hot_topic_counts(conn: psycopg.Connection, window_days: int) -> list[dict]:
    """「その他（今、熱い分野）」のランキング。

    ホットトピック起点で収集され、かつどの追跡対象にもマッチしなかった
    コンテンツの件数をトピックごとに数える。ユーザーの登録内容の外側で
    盛り上がっている分野が上に来る。
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.topic, COUNT(*) AS content_count
            FROM "Content" c
            WHERE c.topic IS NOT NULL
              AND c."collectedAt" >= now() - make_interval(days => %s)
              AND NOT EXISTS (SELECT 1 FROM "Match" m WHERE m."contentId" = c.id)
            GROUP BY c.topic
            ORDER BY content_count DESC, c.topic ASC
            """,
            (window_days,),
        )
        return [{"topic": row[0], "contentCount": row[1]} for row in cur.fetchall()]
