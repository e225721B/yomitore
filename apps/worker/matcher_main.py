import argparse

from yomitore_worker.config import load_config
from yomitore_worker.matcher import run


def main() -> None:
    parser = argparse.ArgumentParser(description="M3: 収集コンテンツ × 追跡対象 のAIマッチング")
    parser.add_argument(
        "--backfill",
        action="store_true",
        help="SQSを使わず、DB内の全Contentに対してマッチングをやり直す",
    )
    args = parser.parse_args()

    config = load_config()
    stats = run(config, backfill=args.backfill)

    print(
        "[matcher] 完了: "
        f"処理件数={stats['processed']}件 "
        f"マッチ数={stats['matched_pairs']}件 "
        f"未検出content={stats['skipped_missing']}件"
    )


if __name__ == "__main__":
    main()
