resource "aws_secretsmanager_secret" "app_secret" {
  name        = var.secret_name
  description = "Application secrets for AssembleMonitor advanced deployment"

  tags = merge(local.common_tags, {
    Name = var.secret_name
  })
}

resource "aws_secretsmanager_secret_version" "app_secret_version" {
  secret_id = aws_secretsmanager_secret.app_secret.id

  secret_string = jsonencode({
    DATABASE_URL   = "postgresql+asyncpg://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.address}:5432/${var.db_name}"
    JWT_SECRET_KEY = var.jwt_secret_key
    AWS_REGION     = var.aws_region
    S3_BUCKET_NAME = aws_s3_bucket.uploads.bucket
  })
}
