# IRSA (IAM Roles for Service Accounts):
# PodにAWSの長期アクセスキーを持たせず、Kubernetes ServiceAccountに紐づけたIAMロールを
# STSで一時的に引き受けさせる仕組み。そのためにEKSのOIDCプロバイダをIAMに登録する。

data "tls_certificate" "eks" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

locals {
  oidc_provider_url = replace(aws_iam_openid_connect_provider.eks.url, "https://", "")
}

### 収集/マッチ/トレンドワーカー用ロール: SQSキューの操作のみ許可

resource "aws_iam_role" "worker_irsa" {
  name = "${local.name_prefix}-worker-irsa"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.eks.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.oidc_provider_url}:sub" = "system:serviceaccount:${var.k8s_namespace}:${var.worker_service_account_name}"
          "${local.oidc_provider_url}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "worker_sqs" {
  name = "${local.name_prefix}-worker-sqs"
  role = aws_iam_role.worker_irsa.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl",
      ]
      Resource = [
        aws_sqs_queue.collection.arn,
        aws_sqs_queue.collection_dlq.arn,
      ]
    }]
  })
}

### APIサーバー用ロール: RDSマスターパスワード(Secrets Manager)の読み取りのみ許可

resource "aws_iam_role" "api_irsa" {
  name = "${local.name_prefix}-api-irsa"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.eks.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "${local.oidc_provider_url}:sub" = "system:serviceaccount:${var.k8s_namespace}:${var.api_service_account_name}"
          "${local.oidc_provider_url}:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "api_secrets" {
  name = "${local.name_prefix}-api-secrets"
  role = aws_iam_role.api_irsa.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = aws_db_instance.main.master_user_secret[0].secret_arn
    }]
  })
}

output "worker_irsa_role_arn" {
  description = "ワーカーPodのServiceAccountにannotationするIAMロールARN"
  value       = aws_iam_role.worker_irsa.arn
}

output "api_irsa_role_arn" {
  description = "APIサーバーPodのServiceAccountにannotationするIAMロールARN"
  value       = aws_iam_role.api_irsa.arn
}
