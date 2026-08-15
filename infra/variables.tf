variable "aws_region" {
  description = "デプロイ先のAWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "リソース名のプレフィックスやタグに使うプロジェクト名"
  type        = string
  default     = "yomitore"
}

variable "environment" {
  description = "環境名（dev/staging/prodなど）"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "VPC全体のCIDR"
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "使用するアベイラビリティゾーンの数（EKSの要件で最低2）"
  type        = number
  default     = 2
}

variable "postgres_version" {
  description = "RDS PostgreSQLのバージョン（pgvector対応バージョン）"
  type        = string
  default     = "16.14"
}

variable "rds_instance_class" {
  description = "RDSインスタンスクラス"
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_master_username" {
  description = "RDSマスターユーザー名"
  type        = string
  default     = "yomitore_admin"
}

variable "redis_node_type" {
  description = "ElastiCache(Redis)ノードタイプ"
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_engine_version" {
  description = "ElastiCache(Redis)エンジンバージョン"
  type        = string
  default     = "7.1"
}

variable "eks_kubernetes_version" {
  description = "EKSクラスタのKubernetesバージョン"
  type        = string
  default     = "1.34"
}

variable "eks_node_instance_types" {
  description = "EKSマネージドノードグループのインスタンスタイプ"
  type        = list(string)
  default     = ["t3.small"]
}

variable "eks_node_desired_size" {
  type    = number
  default = 1
}

variable "eks_node_min_size" {
  type    = number
  default = 1
}

variable "eks_node_max_size" {
  type    = number
  default = 2
}

variable "k8s_namespace" {
  description = "アプリをデプロイするKubernetes namespace"
  type        = string
  default     = "yomitore"
}

variable "worker_service_account_name" {
  description = "収集/マッチ/トレンドワーカーが使うKubernetes ServiceAccount名"
  type        = string
  default     = "yomitore-worker"
}

variable "api_service_account_name" {
  description = "APIサーバーが使うKubernetes ServiceAccount名"
  type        = string
  default     = "yomitore-api"
}
