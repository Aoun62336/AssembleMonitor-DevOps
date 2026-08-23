# =============================================================================
# Module: network — Unit Tests
#
# Uses the Terraform native testing framework (terraform test, Terraform 1.7+).
# mock_provider stubs all AWS API calls so no credentials or real
# infrastructure are required. These are pure configuration-logic tests.
#
# Run locally:
#   cd terraform/modules/network
#   terraform init -backend=false
#   terraform test
#
# All tests use command = plan — no resources are ever created.
# =============================================================================

mock_provider "aws" {}

# ---------------------------------------------------------------------------
# Test 1: Correct number of subnets created for a two-AZ deployment.
# ---------------------------------------------------------------------------
run "creates_correct_number_of_subnets" {
  command = plan

  variables {
    vpc_id           = "vpc-test000000000001"
    public_subnet_id = "subnet-pub000000000001"
    name_prefix      = "test-app"
    aws_region       = "us-east-1"
    private_subnet_cidr_map = {
      a = "10.0.1.0/24"
      b = "10.0.2.0/24"
    }
    tags = {
      Environment = "test"
    }
  }

  assert {
    condition     = length(aws_subnet.private) == 2
    error_message = "Expected 2 private subnets for a two-AZ map, got ${length(aws_subnet.private)}."
  }

  assert {
    condition     = aws_subnet.private["a"].cidr_block == "10.0.1.0/24"
    error_message = "Subnet A CIDR does not match the configured value."
  }

  assert {
    condition     = aws_subnet.private["b"].cidr_block == "10.0.2.0/24"
    error_message = "Subnet B CIDR does not match the configured value."
  }
}

# ---------------------------------------------------------------------------
# Test 2: Private subnets must never auto-assign public IPs.
# ---------------------------------------------------------------------------
run "private_subnets_disable_public_ip" {
  command = plan

  variables {
    vpc_id           = "vpc-test000000000001"
    public_subnet_id = "subnet-pub000000000001"
    name_prefix      = "test-app"
    aws_region       = "us-east-1"
    private_subnet_cidr_map = {
      a = "10.0.1.0/24"
    }
  }

  assert {
    condition     = aws_subnet.private["a"].map_public_ip_on_launch == false
    error_message = "Private subnets must not auto-assign public IPs."
  }
}

# ---------------------------------------------------------------------------
# Test 3: NAT gateway must be placed in the designated public subnet.
# ---------------------------------------------------------------------------
run "nat_gateway_placed_in_correct_subnet" {
  command = plan

  variables {
    vpc_id           = "vpc-test000000000001"
    public_subnet_id = "subnet-pub000000000001"
    name_prefix      = "test-app"
    aws_region       = "us-east-1"
    private_subnet_cidr_map = {
      a = "10.0.1.0/24"
    }
  }

  assert {
    condition     = aws_nat_gateway.main.subnet_id == "subnet-pub000000000001"
    error_message = "NAT gateway must be placed in the designated public subnet."
  }
}

# ---------------------------------------------------------------------------
# Test 4: Private route table must have a default route through NAT gateway.
# ---------------------------------------------------------------------------
run "route_table_has_default_nat_route" {
  command = plan

  variables {
    vpc_id           = "vpc-test000000000001"
    public_subnet_id = "subnet-pub000000000001"
    name_prefix      = "test-app"
    aws_region       = "us-east-1"
    private_subnet_cidr_map = {
      a = "10.0.1.0/24"
    }
  }

  assert {
    condition = contains(
      [for r in aws_route_table.private.route : r.cidr_block],
      "0.0.0.0/0"
    )
    error_message = "Private route table must have a 0.0.0.0/0 default route through the NAT gateway."
  }
}

# ---------------------------------------------------------------------------
# Test 5: Validation rule rejects an empty subnet map.
# ---------------------------------------------------------------------------
run "rejects_empty_subnet_map" {
  command = plan

  expect_failures = [var.private_subnet_cidr_map]

  variables {
    vpc_id           = "vpc-test000000000001"
    public_subnet_id = "subnet-pub000000000001"
    name_prefix      = "test-app"
    aws_region       = "us-east-1"
    private_subnet_cidr_map = {}
  }
}
