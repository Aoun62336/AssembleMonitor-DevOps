resource "aws_security_group" "alb_sg" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Allow HTTP traffic to ALB"
  vpc_id      = data.aws_vpc.default.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  ip_protocol       = "tcp"
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "alb_all_outbound" {
  security_group_id = aws_security_group.alb_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "app_sg" {
  name        = "${local.name_prefix}-app-sg"
  description = "Security group for app EC2 instances"
  vpc_id      = data.aws_vpc.default.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "app_http_from_alb" {
  security_group_id            = aws_security_group.app_sg.id
  referenced_security_group_id = aws_security_group.alb_sg.id
  from_port                    = 80
  ip_protocol                  = "tcp"
  to_port                      = 80
}


resource "aws_vpc_security_group_egress_rule" "app_all_outbound" {
  security_group_id = aws_security_group.app_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "rds_sg" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = data.aws_vpc.default.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "rds_postgres_from_app" {
  security_group_id            = aws_security_group.rds_sg.id
  referenced_security_group_id = aws_security_group.app_sg.id
  from_port                    = 5432
  ip_protocol                  = "tcp"
  to_port                      = 5432
}

resource "aws_vpc_security_group_egress_rule" "rds_all_outbound" {
  security_group_id = aws_security_group.rds_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "rds_postgres_from_k3s_sg" {
  security_group_id            = aws_security_group.rds_sg.id
  referenced_security_group_id = data.aws_security_group.k3s_sg.id
  from_port                    = 5432
  ip_protocol                  = "tcp"
  to_port                      = 5432
}

resource "aws_vpc_security_group_ingress_rule" "rds_postgres_from_eks_nodes" {
  security_group_id            = aws_security_group.rds_sg.id
  referenced_security_group_id = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
  from_port                    = 5432
  ip_protocol                  = "tcp"
  to_port                      = 5432
}

resource "aws_vpc_security_group_ingress_rule" "eks_nodes_from_alb" {
  security_group_id            = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
  referenced_security_group_id = aws_security_group.alb_sg.id
  from_port                    = 30080
  ip_protocol                  = "tcp"
  to_port                      = 30080
}
