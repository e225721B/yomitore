# apps/api と apps/worker のコンテナイメージ置き場
resource "aws_ecr_repository" "app" {
  for_each = toset(["api", "worker"])

  name                 = "${local.name_prefix}-${each.key}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  # dev環境なので、terraform destroy時にイメージが残っていてもリポジトリごと削除できるようにする。
  # 本番ではイメージを誤って消さないようfalseにすべき。
  force_delete = true
}

# 未タグ(dangling)イメージは7日で自動削除してストレージ費用を抑える
resource "aws_ecr_lifecycle_policy" "app" {
  for_each = aws_ecr_repository.app

  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images older than 7 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

output "ecr_repository_urls" {
  description = "ECRリポジトリURL（docker push先）"
  value       = { for k, v in aws_ecr_repository.app : k => v.repository_url }
}
