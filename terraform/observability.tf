resource "aws_prometheus_workspace" "main" {
  alias = "${local.name_prefix}-amp"
  tags  = local.common_tags
}

output "amp_workspace_endpoint" {
  value = aws_prometheus_workspace.main.prometheus_endpoint
}

# ---------------------------------------------------------
# IAM Role for Service Accounts (IRSA) - OpenTelemetry
# ---------------------------------------------------------
resource "aws_iam_role" "otel_irsa_role" {
  name = "${local.name_prefix}-otel-irsa-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = "system:serviceaccount:assemblemonitor:otel-collector"
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "otel_amp_remote_write" {
  role       = aws_iam_role.otel_irsa_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonPrometheusRemoteWriteAccess"
}

output "otel_irsa_role_arn" {
  value = aws_iam_role.otel_irsa_role.arn
}

# ---------------------------------------------------------
# IAM Role for Service Accounts (IRSA) - Grafana
# ---------------------------------------------------------
resource "aws_iam_role" "grafana_irsa_role" {
  name = "${local.name_prefix}-grafana-irsa-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = "system:serviceaccount:assemblemonitor:grafana"
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "grafana_amp_query" {
  role       = aws_iam_role.grafana_irsa_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonPrometheusQueryAccess"
}

output "grafana_irsa_role_arn" {
  value = aws_iam_role.grafana_irsa_role.arn
}

# ---------------------------------------------------------
# IAM Role for Service Accounts (IRSA) - Observability Backend (Loki/Tempo)
# ---------------------------------------------------------
resource "aws_iam_role" "observability_backend_irsa_role" {
  name = "${local.name_prefix}-obs-backend-irsa"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub" = [
              "system:serviceaccount:assemblemonitor:loki",
              "system:serviceaccount:assemblemonitor:tempo"
            ]
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_policy" "observability_s3_policy" {
  name        = "${local.name_prefix}-obs-s3-policy"
  description = "Allows Loki and Tempo to access the observability S3 bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.observability.arn,
          "${aws_s3_bucket.observability.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "observability_s3_attach" {
  role       = aws_iam_role.observability_backend_irsa_role.name
  policy_arn = aws_iam_policy.observability_s3_policy.arn
}

output "observability_backend_irsa_role_arn" {
  value = aws_iam_role.observability_backend_irsa_role.arn
}

output "observability_s3_bucket_name" {
  value = aws_s3_bucket.observability.id
}

