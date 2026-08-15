resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${local.name_prefix}-db-subnet-group"
  }
}

resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds"
  description = "Allow Postgres access from internal services"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from EKS nodes"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_eks_cluster.main.vpc_config[0].cluster_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-rds-sg"
  }
}

resource "aws_db_instance" "main" {
  identifier     = "${local.name_prefix}-postgres"
  engine         = "postgres"
  engine_version = var.postgres_version
  instance_class = var.rds_instance_class

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "yomitore"
  username = var.rds_master_username
  # パスワードは自前で発行・保管せず、RDSにSecrets Manager上で管理させる（コード上に平文を置かない）
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az            = false
  publicly_accessible = false

  backup_retention_period = 1

  # dev環境向けの簡略設定。本番では skip_final_snapshot = false, deletion_protection = true にすべき。
  skip_final_snapshot = true
  deletion_protection = false

  tags = {
    Name = "${local.name_prefix}-postgres"
  }
}

output "rds_endpoint" {
  description = "RDSエンドポイント（ホスト:ポート）"
  value       = aws_db_instance.main.endpoint
}

output "rds_master_user_secret_arn" {
  description = "マスターパスワードが保管されているSecrets ManagerのARN"
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}
