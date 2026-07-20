resource "aws_iam_role" "app_role" {
  name = "${local.name_prefix}-app-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      },
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = "system:serviceaccount:assemblemonitor:assemblemonitor-backend-sa"
          }
        }
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app-role"
  })
}

resource "aws_iam_policy" "app_policy" {
  name        = "${local.name_prefix}-app-policy"
  description = "Allow app EC2 to read Secrets Manager and access S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadAppSecret"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.app_secret.arn
      },
      {
        Sid    = "S3ObjectAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.uploads.arn}/*"
      },
      {
        Sid    = "S3ListBucket"
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.uploads.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "app_policy_attach" {
  role       = aws_iam_role.app_role.name
  policy_arn = aws_iam_policy.app_policy.arn
}

resource "aws_iam_role_policy_attachment" "app_ssm_attach" {
  role       = aws_iam_role.app_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "app_instance_profile" {
  name = "${local.name_prefix}-app-instance-profile"
  role = aws_iam_role.app_role.name
}

resource "aws_iam_role_policy_attachment" "eks_node_app_policy" {
  role       = aws_iam_role.eks_node_role.name
  policy_arn = aws_iam_policy.app_policy.arn
}
