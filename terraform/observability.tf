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

/*
# ---------------------------------------------------------
# Amazon Managed Grafana (AMG)
# ---------------------------------------------------------
resource "aws_grafana_workspace" "main" {
  name                     = "${local.name_prefix}-amg"
  account_access_type      = "CURRENT_ACCOUNT"
  authentication_providers = ["AWS_SSO"]
  permission_type          = "SERVICE_MANAGED"
  role_arn                 = aws_iam_role.amg_role.arn
  data_sources             = ["PROMETHEUS", "CLOUDWATCH"]

  vpc_configuration {
    subnet_ids         = [data.aws_subnets.default.ids[0], data.aws_subnets.default.ids[1]]
    security_group_ids = [aws_security_group.amg_vpc_access_sg.id]
  }

  tags = local.common_tags
}

resource "aws_security_group" "amg_vpc_access_sg" {
  name        = "${local.name_prefix}-amg-vpc-access-sg"
  description = "Lets Amazon Managed Grafana reach Loki and Tempo running inside EKS"
  vpc_id      = data.aws_vpc.default.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-amg-vpc-access-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "eks_from_amg" {
  security_group_id            = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
  referenced_security_group_id = aws_security_group.amg_vpc_access_sg.id
  from_port                    = 3100
  ip_protocol                  = "tcp"
  to_port                      = 3200
}

resource "aws_iam_role" "amg_role" {
  name = "${local.name_prefix}-amg-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "grafana.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "amg_prometheus_attach" {
  role       = aws_iam_role.amg_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSGrafanaWorkspacePermissionManagementV2"
}

output "amg_workspace_endpoint" {
  value = aws_grafana_workspace.main.endpoint
}
*/
