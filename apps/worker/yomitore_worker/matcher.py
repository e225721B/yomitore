import json

from . import db, queue
from .config import Config
from .embeddings import embed, to_vector_literal


def _ensure_tracked_item_embeddings(conn) -> int:
    items = db.fetch_tracked_items_missing_embedding(conn)
    for item in items:
        text = item.title if not item.note else f"{item.title} {item.note}"
        vector = embed(text)
        db.update_tracked_item_embedding(conn, item.id, to_vector_literal(vector))
    return len(items)


def _process_content(conn, content_id: str, threshold: float) -> list[tuple[str, str, float]] | None:
    content = db.fetch_content(conn, content_id)
    if content is None:
        return None

    text = content["title"] if not content["description"] else f'{content["title"]} {content["description"]}'
    vector_literal = to_vector_literal(embed(text))
    db.update_content_embedding(conn, content_id, vector_literal)

    matches = db.find_matching_tracked_items(conn, vector_literal, threshold)
    for tracked_item_id, _title, score in matches:
        db.upsert_match(conn, tracked_item_id, content_id, score)
    return matches


def run(config: Config, backfill: bool = False) -> dict:
    conn = db.connect(config.database_url)

    updated = _ensure_tracked_item_embeddings(conn)
    if updated:
        print(f"[matcher] 追跡対象の埋め込みを{updated}件生成")

    stats = {"processed": 0, "matched_pairs": 0, "skipped_missing": 0}

    if backfill:
        for content_id in db.fetch_all_content_ids(conn):
            _handle(conn, content_id, config.match_score_threshold, stats)
        return stats

    sqs_client = queue.get_client(config)
    queue_url = queue.get_queue_url(sqs_client, config.sqs_queue_name)

    while True:
        messages = queue.receive_messages(sqs_client, queue_url)
        if not messages:
            break
        for message in messages:
            content_id = json.loads(message["Body"])["contentId"]
            _handle(conn, content_id, config.match_score_threshold, stats)
            queue.delete_message(sqs_client, queue_url, message["ReceiptHandle"])

    return stats


def _handle(conn, content_id: str, threshold: float, stats: dict) -> None:
    matches = _process_content(conn, content_id, threshold)
    if matches is None:
        print(f"[matcher] contentId={content_id} が見つからないためスキップ")
        stats["skipped_missing"] += 1
        return

    stats["processed"] += 1
    stats["matched_pairs"] += len(matches)
    if matches:
        joined = ", ".join(f"{title}({score:.2f})" for _id, title, score in matches)
        print(f"[matcher] content={content_id[:8]} → {joined}")
    else:
        print(f"[matcher] content={content_id[:8]} → マッチなし")
