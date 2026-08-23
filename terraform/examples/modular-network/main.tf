# =============================================================================
# Example: modular-network — Module Call
#
# Demonstrates how to consume the reusable network module to provision
# private subnets, a NAT gateway, and route tables inside an existing VPC.
#
# This example is validated in CI (init -backend=false + validate) but is
# never applied against real AWS infrastructure.
#
# Usage:
#   cp terraform.tfvars.example terraform.tfvars   # fill in real IDs
#   terraform init
#   terraform plan
# =============================================================================

module "network" {
  source = "../../modules/network"

  vpc_id           = var.vpc_id
  public_subnet_id = var.public_subnet_id
  name_prefix      = "${var.project_name}-${var.environment}"
  aws_region       = var.aws_region

  private_subnet_cidr_map = var.private_subnet_cidr_map

  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = "Aoun"
  }
}

# ---------------------------------------------------------------------------
# Outputs — expose key IDs for use by callers of this example
# ---------------------------------------------------------------------------
output "private_subnet_ids" {
  description = "Map of AZ suffix to private subnet ID produced by the network module."
  value       = module.network.private_subnet_ids
}

output "nat_gateway_id" {
  description = "ID of the NAT gateway produced by the network module."
  value       = module.network.nat_gateway_id
}

output "nat_eip_public_ip" {
  description = "Public IP of the NAT gateway EIP — allowlist this in upstream security groups."
  value       = module.network.nat_eip_public_ip
}
