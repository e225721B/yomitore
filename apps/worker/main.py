import argparse

from yomitore_worker.collector import run
from yomitore_worker.config import load_config


def main() -> None:
    parser = argparse.ArgumentParser(description="M2: 外部コンテンツの自動収集")
    parser.add_argument(
        "--mock",
        action="store_true",
        help="YouTube API を呼ばず、合成データでパイプライン(DB保存+SQS投入)を検証する",
    )
    args = parser.parse_args()

    config = load_config()
    stats = run(config, mock=args.mock)

    print(
        "[collector] 完了: "
        f"追跡対象={stats['tracked_items']}件 "
        f"取得動画={stats['videos_found']}件 "
        f"新規保存={stats['new_content']}件 "
        f"SQS投入={stats['enqueued']}件"
    )


if __name__ == "__main__":
    main()
