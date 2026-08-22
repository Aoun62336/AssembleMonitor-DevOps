# =============================================================================
# Example: modular-network — Input Variables
# =============================================================================

variable "project_name" {
  description = "Project name used to construct resource name prefixes (e.g. 'assemblemonitor')."
  type        = string
  default     = "assemblemonitor"
}

variable "environment" {
  description = "Deployment environment label used in resource names and tags (e.g. 'dev', 'staging', 'prod')."
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region where resources will be provisioned (e.g. 'us-east-1')."
  type        = string
  default     = "us-east-1"
}

variable "vpc_id" {
  description = "ID of the existing VPC in which to create private networking resources."
  type        = string
}

variable "public_subnet_id" {
  description = "ID of a public subnet in the VPC where the NAT gateway will be placed."
  type        = string
}

variable "private_subnet_cidr_map" {
  description = <<-EOT
    Map of Availability Zone suffix to private subnet CIDR block.
    Example: { a = "10.0.1.0/24", b = "10.0.2.0/24" }
    At least one entry is required (enforced by the module).
  EOT
  type        = map(string)
}
