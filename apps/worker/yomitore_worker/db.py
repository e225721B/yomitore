import uuid
from dataclasses import dataclass
from datetime import datetime

import psycopg


@dataclass(frozen=True)
class TrackedItem:
    id: str
    type: str
    title: str
    note: str | None = None


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
        cur.execute('SELECT id, type, title, note FROM "TrackedItem" ORDER BY "createdAt" DESC')
        return [TrackedItem(id=row[0], type=row[1], title=row[2], note=row[3]) for row in cur.fetchall()]


def upsert_content(conn: psycopg.Connection, content: RawContent) -> tuple[str, bool]:
    """収集した動画を Content に保存する。既存(source, sourceId)なら何もせず既存IDを返す。"""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO "Content"
                (id, source, "sourceId", title, description, url, "thumbnailUrl", "channelTitle", "publishedAt")
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
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
            ),
        )
        row = cur.fetchone()
        if row is not None:
            return row[0], True

        cur.execute(
            'SELECT id FROM "Content" WHERE source = %s AND "sourceId" = %s',
            ("YOUTUBE", content.source_id),
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
        cur.execute('SELECT id, type, title, note FROM "TrackedItem" WHERE embedding IS NULL')
        return [TrackedItem(id=row[0], type=row[1], title=row[2], note=row[3]) for row in cur.fetchall()]


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
            SELECT ti.id, ti.type, ti.title,
                   COUNT(m.id) FILTER (
                       WHERE c."collectedAt" >= now() - make_interval(days => %s)
                   ) AS match_count
            FROM "TrackedItem" ti
            LEFT JOIN "Match" m ON m."trackedItemId" = ti.id
            LEFT JOIN "Content" c ON c.id = m."contentId"
            GROUP BY ti.id, ti.type, ti.title
            ORDER BY match_count DESC, ti."createdAt" ASC
            """,
            (window_days,),
        )
        return [
            {"trackedItemId": row[0], "type": row[1], "title": row[2], "matchCount": row[3]}
            for row in cur.fetchall()
        ]
