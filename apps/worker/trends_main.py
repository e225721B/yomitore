from yomitore_worker.config import load_config
from yomitore_worker.trends import run


def main() -> None:
    config = load_config()
    result = run(config)
    items = result["items"]
    topics = result["topics"]

    print(f"[trends] 集計完了（直近{config.trend_window_days}日、{len(items)}件の追跡対象）")
    for item in items:
        print(f"  [{item['category']}] {item['title']}: {item['matchCount']}件")

    print(f"[trends] 今、熱い分野（追跡対象外）: {len(topics)}件")
    for topic in topics:
        print(f"  [OTHER] {topic['topic']}: {topic['contentCount']}件")


if __name__ == "__main__":
    main()
