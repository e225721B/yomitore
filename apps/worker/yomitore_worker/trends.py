import json
from datetime import datetime, timezone

import redis

from . import db
from .config import Config

TRENDS_KEY = "trends:latest"


def run(config: Config) -> dict:
    conn = db.connect(config.database_url)
    # items: 追跡対象（興味分野 / 読み終わった本 / 気になる本）のランキング
    # topics: 追跡対象の外側で盛り上がっている分野（「その他」タブ）のランキング
    counts = db.fetch_trend_counts(conn, config.trend_window_days)
    topics = db.fetch_hot_topic_counts(conn, config.trend_window_days)

    payload = {
        "windowDays": config.trend_window_days,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "items": counts,
        "topics": topics,
    }

    client = redis.Redis.from_url(config.redis_url, decode_responses=True)
    client.set(TRENDS_KEY, json.dumps(payload))

    return {"items": counts, "topics": topics}
