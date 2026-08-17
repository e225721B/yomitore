"""「その他（今、熱い分野）」タブのための、追跡対象によらないホットトピック。

ユーザーが登録していない分野の話題を届けるのが狙いなので、収集時に
登録済みの追跡対象と重なるトピックは除外する。
"""

import os

# 本まわりで常に話題が動いている分野を既定値として置く。
# 運用では HOT_TOPICS 環境変数（カンマ区切り）で差し替えられる。
DEFAULT_HOT_TOPICS = [
    "本屋大賞",
    "芥川賞 直木賞",
    "話題の新刊",
    "ベストセラー 小説",
    "書店員 おすすめ",
    "映像化 原作小説",
]


def load_hot_topics() -> list[str]:
    raw = os.environ.get("HOT_TOPICS")
    if not raw:
        return list(DEFAULT_HOT_TOPICS)
    return [topic.strip() for topic in raw.split(",") if topic.strip()]


# 部分一致で除外を判定する最小の長さ。「SF」のような短いジャンル名で
# 無関係なトピックまで巻き込まないための下限。
_MIN_SUBSTRING_LEN = 3


def exclude_tracked(topics: list[str], tracked_titles: list[str]) -> list[str]:
    """すでに追跡している分野と重なるトピックを落とす。"""
    normalized = {title.strip().lower() for title in tracked_titles if title.strip()}
    long_titles = {title for title in normalized if len(title) >= _MIN_SUBSTRING_LEN}

    def overlaps(topic: str) -> bool:
        key = topic.strip().lower()
        if key in normalized:
            return True
        if len(key) < _MIN_SUBSTRING_LEN:
            return False
        return any(key in title or title in key for title in long_titles)

    return [topic for topic in topics if not overlaps(topic)]
