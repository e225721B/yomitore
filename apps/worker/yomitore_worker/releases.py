"""登録した本の続編・同じ著者の新刊を、Google Books から検出する。

同じ著者の本を新しい順に引き、登録本より新しいものを候補にする。
タイトルからシリーズ名を取り出して、続編か単に同じ著者の新刊かを分ける。
"""

import re
import time
import unicodedata
from dataclasses import dataclass
from datetime import date, timedelta

import requests

from . import db
from .config import Config

SEARCH_URL = "https://www.googleapis.com/books/v1/volumes"

# 立て続けに叩かないための待ち時間
REQUEST_INTERVAL_SEC = 0.5


class MissingApiKey(RuntimeError):
    """Google Books のAPIキーが未設定。"""


class SearchFailed(RuntimeError):
    """検索に失敗した。メッセージにAPIキーは含めない。"""


@dataclass(frozen=True)
class Candidate:
    title: str
    author: str | None
    publisher: str | None
    # ISBN。取れない場合は "gb:<volumeId>" を代わりの鍵にする。
    isbn: str
    release_date: date | None
    release_label: str
    url: str
    thumbnail_url: str | None


# 巻数・版などの「巻を表す部分」。シリーズ名を取り出すために落とす。
_VOLUME_PATTERNS = [
    r"第?\s*\d+\s*巻",
    r"\(\s*\d+\s*\)",
    r"（\s*\d+\s*）",
    r"[\s　]\d+$",
    r"[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+$",
    r"[上中下]巻?$",
    r"vol\.?\s*\d+",
]

# サブタイトルの区切り。以降はシリーズ判定に使わない。
_SUBTITLE_SEPARATORS = r"[―—\-–—:：〜~｜|/／]"


def normalize(title: str) -> str:
    """比較用にタイトルをそろえる（全角半角・空白・記号）。"""
    text = unicodedata.normalize("NFKC", title).lower()
    text = re.sub(r"[\s　]+", "", text)
    return text.strip()


def series_key(title: str) -> str:
    """巻数とサブタイトルを落とした「シリーズ名」。続編判定の鍵にする。"""
    text = unicodedata.normalize("NFKC", title).lower()
    text = re.split(_SUBTITLE_SEPARATORS, text)[0]
    for pattern in _VOLUME_PATTERNS:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)
    text = re.sub(r"[\s　]+", "", text)
    return text.strip()


def classify(tracked_title: str, candidate_title: str) -> str | None:
    """続編か、同じ著者の新刊か。同じ本そのものなら None（通知しない）。"""
    if normalize(tracked_title) == normalize(candidate_title):
        return None

    base, other = series_key(tracked_title), series_key(candidate_title)
    if not base or not other:
        return "SAME_AUTHOR"
    # 「三体」→「三体Ⅱ 黒暗森林」のように、シリーズ名が一致/前方一致すれば続編扱い
    if len(base) >= 2 and (base == other or other.startswith(base) or base.startswith(other)):
        return "SEQUEL"
    return "SAME_AUTHOR"


def parse_published_date(label: str) -> date | None:
    """publishedDate（"2024-02-21" / "2024-02" / "2024"）を日付にする。

    月・日が無いものは月初・年初として扱う（並べ替えのため）。
    """
    if not label:
        return None
    parts = label.split("-")
    try:
        year = int(parts[0])
        month = int(parts[1]) if len(parts) > 1 else 1
        day = int(parts[2]) if len(parts) > 2 else 1
        return date(year, month, day)
    except (ValueError, IndexError):
        return None


def _get(params: dict, api_key: str) -> dict:
    """Google Books を叩いて JSON を返す。例外にURL（キー付き）は載せない。"""
    if not api_key:
        raise MissingApiKey("Google Books のキー（GOOGLE_BOOKS_API_KEY）が設定されていません")
    try:
        response = requests.get(SEARCH_URL, params={**params, "key": api_key}, timeout=10)
    except requests.RequestException as err:
        raise SearchFailed(f"Google Books に接続できませんでした: {type(err).__name__}") from None

    if response.status_code == 429:
        raise SearchFailed("Google Books の1日の割り当てを使い切りました")
    if not response.ok:
        raise SearchFailed(f"Google Books がエラーを返しました (HTTP {response.status_code})")
    return response.json()


def search_by_author(api_key: str, author: str, hits: int = 40) -> list[Candidate]:
    """同じ著者の本を新しい順に引く。"""
    data = _get(
        {
            "q": f'inauthor:"{author}"',
            "orderBy": "newest",
            "maxResults": min(hits, 40),
            "country": "JP",
        },
        api_key,
    )
    items = data.get("items", [])
    return [c for c in (_to_candidate(item) for item in items) if c is not None]


def resolve_author_by_title(api_key: str, title: str) -> str | None:
    """著者が未登録の本のために、タイトルから著者を引く。

    本の登録経路によっては著者が入らない（著者情報の無い版を選んだ場合など）。
    著者が分からないと新刊を探せないので、ここで補う。
    """
    try:
        data = _get({"q": f'intitle:"{title}"', "maxResults": 5, "country": "JP"}, api_key)
    except (SearchFailed, MissingApiKey):
        return None
    for item in data.get("items", []):
        authors = (item.get("volumeInfo") or {}).get("authors") or []
        if authors:
            return ", ".join(authors)
    return None


def _to_candidate(item: dict) -> Candidate | None:
    info = item.get("volumeInfo") or {}
    title = (info.get("title") or "").strip()
    if not title:
        return None
    subtitle = (info.get("subtitle") or "").strip()
    full_title = f"{title} {subtitle}".strip() if subtitle else title

    # ISBN があればそれを、無ければ volume ID を重複排除の鍵にする
    isbn = ""
    for ident in info.get("industryIdentifiers") or []:
        if ident.get("type") == "ISBN_13":
            isbn = ident.get("identifier", "")
            break
        if ident.get("type") == "ISBN_10" and not isbn:
            isbn = ident.get("identifier", "")
    key = isbn or f"gb:{item.get('id', '')}"
    if key == "gb:":
        return None

    label = (info.get("publishedDate") or "").strip()
    thumbnail = ((info.get("imageLinks") or {}).get("thumbnail") or "").replace("http://", "https://")
    return Candidate(
        title=full_title,
        author=", ".join(info.get("authors") or []) or None,
        publisher=(info.get("publisher") or "").strip() or None,
        isbn=key,
        release_date=parse_published_date(label),
        release_label=label or "発売日不明",
        url=info.get("infoLink") or item.get("selfLink") or "",
        thumbnail_url=thumbnail or None,
    )


def run(config: Config) -> dict:
    """登録済みの本ごとに著者で検索し、新しい本を BookRelease に記録する。"""
    conn = db.connect(config.database_url)
    books = [item for item in db.fetch_tracked_items(conn) if item.type == "BOOK"]

    stats = {"books": len(books), "candidates": 0, "new_releases": 0, "failed": 0}
    if not books:
        print("[releases] 登録された本がありません")
        return stats

    since = date.today() - timedelta(days=config.release_recent_days)

    for index, book in enumerate(books):
        if index:
            time.sleep(REQUEST_INTERVAL_SEC)

        author = book.author
        if not author:
            author = resolve_author_by_title(config.google_books_api_key, book.title)
            if author:
                # 次回以降のために保存しておく
                db.update_author(conn, book.id, author)
                print(f'[releases] "{book.title}": 著者を補完しました → {author}')
        if not author:
            print(f'[releases] "{book.title}": 著者が分からないため、新刊を探せません')
            continue

        try:
            candidates = search_by_author(config.google_books_api_key, author)
        except SearchFailed as err:
            stats["failed"] += 1
            print(f'[releases] "{book.title}": {err} → スキップします')
            continue

        found = 0
        for candidate in candidates:
            # 発売済みで古いものは通知しない（これから出る本・最近出た本だけ）
            if candidate.release_date and candidate.release_date < since:
                continue
            kind = classify(book.title, candidate.title)
            if kind is None:
                continue
            stats["candidates"] += 1
            if db.upsert_book_release(conn, book.id, kind, candidate):
                stats["new_releases"] += 1
                found += 1
                mark = "続編" if kind == "SEQUEL" else "同じ著者"
                print(f'[releases] [{mark}] "{book.title}" → 「{candidate.title}」({candidate.release_label})')
        if found == 0:
            print(f'[releases] "{book.title}": 新しい情報はありません')

    return stats
