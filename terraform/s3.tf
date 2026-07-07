resource "aws_s3_bucket" "uploads" {
  bucket = var.s3_bucket_name

  tags = merge(local.common_tags, {
    Name = var.s3_bucket_name
  })
}

resource "aws_s3_bucket_public_access_block" "uploads_block_public" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "uploads_versioning" {
  bucket = aws_s3_bucket.uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}
