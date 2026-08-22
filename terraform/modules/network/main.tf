# =============================================================================
# Module: network — Resources
#
# Creates private subnets, a NAT gateway, and a private route table inside
# an existing VPC. Designed to augment an AWS default VPC with the private
# networking required by EKS node groups and RDS subnet groups.
#
# Usage example (root module):
#
#   module "network" {
#     source           = "./modules/network"
#     vpc_id           = data.aws_vpc.default.id
#     public_subnet_id = data.aws_subnet.default_a.id
#     name_prefix      = local.name_prefix
#     aws_region       = var.aws_region
#     private_subnet_cidr_map = {
#       a = "172.31.96.0/24"
#       b = "172.31.97.0/24"
#     }
#     tags = local.common_tags
#   }
# =============================================================================

# ── Private subnets ──────────────────────────────────────────────────────────
# One subnet per entry in var.private_subnet_cidr_map.
# Public IP auto-assignment is disabled — instances use NAT for internet access.

resource "aws_subnet" "private" {
  for_each = var.private_subnet_cidr_map

  vpc_id                  = var.vpc_id
  cidr_block              = each.value
  availability_zone       = "${var.aws_region}${each.key}"
  map_public_ip_on_launch = false

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-${each.key}"
  })
}

# ── NAT gateway ──────────────────────────────────────────────────────────────
# Placed in the designated public subnet to give private subnets outbound
# internet access (required by EKS nodes for ECR image pulls and AWS APIs).

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-nat-eip"
  })
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = var.public_subnet_id

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-nat"
  })

  # Ensure the EIP is allocated before attaching it.
  depends_on = [aws_eip.nat]
}

# ── Private route table ───────────────────────────────────────────────────────
# Routes all egress traffic through the NAT gateway.
# Associated with every private subnet created above.

resource "aws_route_table" "private" {
  vpc_id = var.vpc_id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-rt"
  })
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private.id
}
