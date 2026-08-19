import sys

from yomitore_worker.config import load_config
from yomitore_worker.releases import run


def main() -> None:
    config = load_config()

    # アプリIDが無いときは異常終了させない。収集・マッチングと同じパイプラインに
    # 並ぶため、ここで落とすと後続まで止まってしまう。
    if not config.google_books_api_key:
        print("[releases] GOOGLE_BOOKS_API_KEY が未設定のため、続編・新刊のチェックをスキップします")
        print("[releases] apps/api/.env と同じキーを apps/worker/.env に設定してください")
        return

    stats = run(config)
    print(
        "[releases] 完了: "
        f"対象の本={stats['books']}冊 "
        f"候補={stats['candidates']}件 "
        f"新規={stats['new_releases']}件 "
        f"失敗={stats['failed']}件"
    )
    if stats["failed"] and stats["new_releases"] == 0 and stats["failed"] == stats["books"]:
        print("[releases] エラー: すべての問い合わせが失敗しました")
        sys.exit(1)


if __name__ == "__main__":
    main()
