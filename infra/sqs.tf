# 5回処理に失敗したメッセージは滞留させず、調査用にDLQへ退避する
resource "aws_sqs_queue" "collection_dlq" {
  name = "${local.name_prefix}-collection-queue-dlq"

  tags = {
    Name = "${local.name_prefix}-collection-queue-dlq"
  }
}

resource "aws_sqs_queue" "collection" {
  name                       = "${local.name_prefix}-collection-queue"
  visibility_timeout_seconds = 60

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.collection_dlq.arn
    maxReceiveCount     = 5
  })

  tags = {
    Name = "${local.name_prefix}-collection-queue"
  }
}

output "sqs_collection_queue_url" {
  description = "収集タスクキューのURL"
  value       = aws_sqs_queue.collection.url
}
