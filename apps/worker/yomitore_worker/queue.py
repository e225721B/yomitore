import json

import boto3

from .config import Config


def get_client(config: Config):
    kwargs = {"region_name": config.aws_region}
    if config.sqs_endpoint_url:
        # ローカル(ElasticMQ)向け: ダミー認証情報とローカルエンドポイントを使用。
        # 本番(AWS)では sqs_endpoint_url を未設定にし、通常の認証情報チェーンに委ねる。
        kwargs["endpoint_url"] = config.sqs_endpoint_url
        kwargs["aws_access_key_id"] = "local"
        kwargs["aws_secret_access_key"] = "local"
    return boto3.client("sqs", **kwargs)


def get_queue_url(client, queue_name: str) -> str:
    return client.get_queue_url(QueueName=queue_name)["QueueUrl"]


def send_content_collected_message(client, queue_url: str, content_id: str, source_id: str) -> None:
    client.send_message(
        QueueUrl=queue_url,
        MessageBody=json.dumps({"contentId": content_id, "source": "YOUTUBE", "sourceId": source_id}),
    )


def receive_messages(client, queue_url: str, max_messages: int = 10) -> list[dict]:
    response = client.receive_message(
        QueueUrl=queue_url,
        MaxNumberOfMessages=max_messages,
        WaitTimeSeconds=1,
    )
    return response.get("Messages", [])


def delete_message(client, queue_url: str, receipt_handle: str) -> None:
    client.delete_message(QueueUrl=queue_url, ReceiptHandle=receipt_handle)
