import hashlib
from datetime import datetime, timezone

import requests

from .db import RawContent

SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"


def search_videos(api_key: str, query: str, max_results: int) -> list[RawContent]:
    response = requests.get(
        SEARCH_URL,
        params={
            "part": "snippet",
            "q": query,
            "type": "video",
            "order": "relevance",
            "maxResults": max_results,
            "key": api_key,
        },
        timeout=10,
    )
    response.raise_for_status()
    items = response.json().get("items", [])

    results = []
    for item in items:
        video_id = item.get("id", {}).get("videoId")
        snippet = item.get("snippet", {})
        if not video_id:
            continue
        results.append(
            RawContent(
                source_id=video_id,
                title=snippet.get("title", ""),
                description=snippet.get("description") or None,
                url=f"https://www.youtube.com/watch?v={video_id}",
                thumbnail_url=(snippet.get("thumbnails", {}).get("medium", {}) or {}).get("url"),
                channel_title=snippet.get("channelTitle"),
                published_at=_parse_datetime(snippet.get("publishedAt")),
            )
        )
    return results


def generate_mock_videos(query: str, count: int) -> list[RawContent]:
    """YouTube API キー未設定時に、パイプライン(DB保存 + SQS投入)を検証するための合成データ。"""
    query_hash = hashlib.md5(query.encode("utf-8")).hexdigest()[:8]
    now = datetime.now(timezone.utc)
    return [
        RawContent(
            source_id=f"mock-{query_hash}-{i}",
            title=f"『{query}』についての紹介動画 #{i + 1}",
            description=f"{query} に関連する合成テストデータです。",
            url=f"https://www.youtube.com/watch?v=mock-{query_hash}-{i}",
            thumbnail_url=None,
            channel_title="mock-channel",
            published_at=now,
        )
        for i in range(count)
    ]


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))
