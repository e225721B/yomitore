from . import db, queue, youtube
from .config import Config


def run(config: Config, mock: bool = False) -> dict:
    use_mock = mock or config.youtube_api_key is None
    if use_mock and not mock:
        print("[collector] YOUTUBE_API_KEY 未設定のため mock モードで実行します")

    conn = db.connect(config.database_url)
    tracked_items = db.fetch_tracked_items(conn)

    sqs_client = queue.get_client(config)
    queue_url = queue.get_queue_url(sqs_client, config.sqs_queue_name)

    stats = {"tracked_items": len(tracked_items), "videos_found": 0, "new_content": 0, "enqueued": 0}

    for item in tracked_items:
        if use_mock:
            videos = youtube.generate_mock_videos(item.title, config.max_results_per_query)
        else:
            videos = youtube.search_videos(config.youtube_api_key, item.title, config.max_results_per_query)
        stats["videos_found"] += len(videos)
        print(f"[collector] [{item.type}] \"{item.title}\": {len(videos)}件取得")

        for video in videos:
            content_id, created = db.upsert_content(conn, video)
            if created:
                stats["new_content"] += 1
                queue.send_content_collected_message(sqs_client, queue_url, content_id, video.source_id)
                stats["enqueued"] += 1

    return stats
