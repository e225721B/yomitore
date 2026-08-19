import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    database_url: str
    youtube_api_key: str | None
    sqs_queue_name: str
    sqs_endpoint_url: str | None
    aws_region: str
    max_results_per_query: int
    collect_cooldown_hours: int
    match_score_threshold: float
    redis_url: str
    trend_window_days: int


def load_config() -> Config:
    return Config(
        database_url=os.environ["DATABASE_URL"],
        youtube_api_key=os.environ.get("YOUTUBE_API_KEY") or None,
        sqs_queue_name=os.environ.get("SQS_QUEUE_NAME", "collection-queue"),
        # ローカルでは ElasticMQ を指す。本番(AWS)では未設定にし、実 SQS エンドポイントを使う。
        sqs_endpoint_url=os.environ.get("SQS_ENDPOINT_URL") or None,
        aws_region=os.environ.get("AWS_REGION", "us-east-1"),
        max_results_per_query=int(os.environ.get("MAX_RESULTS_PER_QUERY", "50")),
        # 同じ追跡対象を何度も検索してクォータを使い切らないための間隔（時間）。
        collect_cooldown_hours=int(os.environ.get("COLLECT_COOLDOWN_HOURS", "6")),
        match_score_threshold=float(os.environ.get("MATCH_SCORE_THRESHOLD", "0.3")),
        redis_url=os.environ.get("REDIS_URL", "redis://localhost:6379"),
        trend_window_days=int(os.environ.get("TREND_WINDOW_DAYS", "7")),
    )
