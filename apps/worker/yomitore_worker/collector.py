from datetime import datetime, timedelta, timezone

from . import db, hot_topics, queue, youtube
from .config import Config


def _due_for_collection(item: db.TrackedItem, cooldown: timedelta, now: datetime) -> bool:
    """再検索してよいか。YouTube の search は取得件数に関わらず1回100ユニット掛かるので、
    直前に検索したばかりの対象を毎回引き直さない。"""
    if item.last_collected_at is None:
        return True
    return now - item.last_collected_at >= cooldown


def run(config: Config, mock: bool = False, force: bool = False) -> dict:
    use_mock = mock or config.youtube_api_key is None
    if use_mock and not mock:
        print("[collector] YOUTUBE_API_KEY 未設定のため mock モードで実行します")

    conn = db.connect(config.database_url)
    tracked_items = db.fetch_tracked_items(conn)

    sqs_client = queue.get_client(config)
    queue_url = queue.get_queue_url(sqs_client, config.sqs_queue_name)

    # クールダウン中の対象を外す。mock は API を呼ばないので常に全件を対象にする。
    cooldown = timedelta(hours=config.collect_cooldown_hours)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if force or use_mock:
        due_items = tracked_items
    else:
        due_items = [item for item in tracked_items if _due_for_collection(item, cooldown, now)]
    skipped = len(tracked_items) - len(due_items)
    if skipped:
        print(
            f"[collector] スキップ: {skipped}件"
            f"（{config.collect_cooldown_hours}時間以内に収集済み。--force で強制実行）"
        )

    stats = {
        "tracked_items": len(due_items),
        "skipped_items": skipped,
        "hot_topics": 0,
        "videos_found": 0,
        "new_content": 0,
        "enqueued": 0,
        "failed_queries": 0,
        "quota_exceeded": False,
    }

    def collect(query: str, label: str, topic: str | None) -> bool:
        """1クエリ分の収集。失敗しても例外を投げず、成功したかどうかを返す。

        1件の検索が失敗しただけでパイプライン全体（マッチング・トレンド集計）まで
        止めてしまうと、すでに集まっているコンテンツも画面に反映されないため。
        """
        if use_mock:
            videos = youtube.generate_mock_videos(query, config.max_results_per_query)
        else:
            try:
                videos = youtube.search_videos(
                    config.youtube_api_key, query, config.max_results_per_query
                )
            except youtube.QuotaExceeded:
                stats["quota_exceeded"] = True
                print(
                    "[collector] YouTube API の1日の割り当てを使い切りました。"
                    "以降の検索は中止します（リセットは日本時間16時ごろ）"
                )
                return False
            except youtube.SearchFailed as err:
                stats["failed_queries"] += 1
                print(f'[collector] [{label}] "{query}": {err} → この検索はスキップします')
                return False

        stats["videos_found"] += len(videos)
        print(f'[collector] [{label}] "{query}": {len(videos)}件取得')

        for video in videos:
            content_id, created = db.upsert_content(conn, video, topic=topic)
            if created:
                stats["new_content"] += 1
                queue.send_content_collected_message(sqs_client, queue_url, content_id, video.source_id)
                stats["enqueued"] += 1
        return True

    for item in due_items:
        if stats["quota_exceeded"]:
            break
        # 興味分野は「分野名 + 本の語」で検索する（分野名だけだと本と無関係な動画が混ざるため）。
        # 本(BOOK)はタイトルそのもので引く。
        query = f"{item.title} {config.interest_query_suffix}" if item.type == "INTEREST" else item.title

        if not collect(query, db.category_of(item.type, item.book_status), topic=None):
            continue
        # mock はクォータを使わないので、収集済みの印は付けない
        # （--mock で動かしたせいで本物の収集がクールダウンで止まるのを避ける）
        if not use_mock:
            db.mark_collected(conn, item.id)

    # 「その他」タブ用。追跡対象と重ならないホットトピックも収集しておき、
    # どの追跡対象にもマッチしなかったものが「今、熱い分野」として並ぶ。
    topics = hot_topics.exclude_tracked(hot_topics.load_hot_topics(), [item.title for item in tracked_items])
    stats["hot_topics"] = len(topics)
    for topic in topics:
        if stats["quota_exceeded"]:
            break
        collect(topic, "HOT_TOPIC", topic=topic)

    return stats
