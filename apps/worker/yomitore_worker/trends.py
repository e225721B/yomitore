import json
from datetime import datetime, timezone

import redis

from . import db
from .config import Config

TRENDS_KEY = "trends:latest"


def run(config: Config) -> list[dict]:
    conn = db.connect(config.database_url)
    counts = db.fetch_trend_counts(conn, config.trend_window_days)

    payload = {
        "windowDays": config.trend_window_days,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "items": counts,
    }

    client = redis.Redis.from_url(config.redis_url, decode_responses=True)
    client.set(TRENDS_KEY, json.dumps(payload))

    return counts
