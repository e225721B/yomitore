import argparse
import sys

from yomitore_worker.collector import run
from yomitore_worker.config import load_config


def main() -> None:
    parser = argparse.ArgumentParser(description="M2: 外部コンテンツの自動収集")
    parser.add_argument(
        "--mock",
        action="store_true",
        help="YouTube API を呼ばず、合成データでパイプライン(DB保存+SQS投入)を検証する",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="クールダウン（COLLECT_COOLDOWN_HOURS）を無視して全ての追跡対象を再検索する",
    )
    args = parser.parse_args()

    config = load_config()
    stats = run(config, mock=args.mock, force=args.force)

    print(
        "[collector] 完了: "
        f"追跡対象={stats['tracked_items']}件 "
        f"スキップ={stats['skipped_items']}件 "
        f"ホットトピック={stats['hot_topics']}件 "
        f"取得動画={stats['videos_found']}件 "
        f"新規保存={stats['new_content']}件 "
        f"SQS投入={stats['enqueued']}件"
    )

    # クォータ切れは「想定内で、コードでは解決できない状態」なので異常終了にしない。
    # ここで落とすと後続のマッチング・トレンド集計まで止まり、すでに集めた分も画面に出ない。
    if stats["quota_exceeded"]:
        print("[collector] 警告: 割り当て超過のため、収集は途中で打ち切りました")
        return

    # 想定外の失敗（キー不正・ネットワーク断など）で1件も集まらなかったときは異常終了させる
    if stats["failed_queries"] and stats["videos_found"] == 0:
        print(f"[collector] エラー: {stats['failed_queries']}件の検索がすべて失敗しました")
        sys.exit(1)


if __name__ == "__main__":
    main()
