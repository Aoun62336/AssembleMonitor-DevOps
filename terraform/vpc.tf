resource "aws_subnet" "app_private_a" {
  vpc_id                  = data.aws_vpc.default.id
  cidr_block              = "172.31.96.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = false

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-a"
  })
}

resource "aws_subnet" "app_private_b" {
  vpc_id                  = data.aws_vpc.default.id
  cidr_block              = "172.31.97.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = false

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-b"
  })
}

data "aws_subnet" "default_a" {
  filter {
    name   = "availability-zone"
    values = ["${var.aws_region}a"]
  }
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  default_for_az = true
}

data "aws_subnet" "default_b" {
  filter {
    name   = "availability-zone"
    values = ["${var.aws_region}b"]
  }
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  default_for_az = true
}

resource "aws_ec2_tag" "public_a_elb" {
  resource_id = data.aws_subnet.default_a.id
  key         = "kubernetes.io/role/elb"
  value       = "1"
}

resource "aws_ec2_tag" "public_b_elb" {
  resource_id = data.aws_subnet.default_b.id
  key         = "kubernetes.io/role/elb"
  value       = "1"
}

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-eip"
  })
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = data.aws_subnet.default_a.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat"
  })
}

resource "aws_route_table" "private" {
  vpc_id = data.aws_vpc.default.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-rt"
  })
}

resource "aws_route_table_association" "app_private_a" {
  subnet_id      = aws_subnet.app_private_a.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "app_private_b" {
  subnet_id      = aws_subnet.app_private_b.id
  route_table_id = aws_route_table.private.id
}
