from yomitore_worker.config import load_config
from yomitore_worker.trends import run


def main() -> None:
    config = load_config()
    counts = run(config)

    print(f"[trends] 集計完了（直近{config.trend_window_days}日、{len(counts)}件の追跡対象）")
    for item in counts:
        print(f"  [{item['type']}] {item['title']}: {item['matchCount']}件")


if __name__ == "__main__":
    main()
