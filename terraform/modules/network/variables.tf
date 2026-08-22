# =============================================================================
# Module: network — Input Variables
# =============================================================================

variable "vpc_id" {
  description = "ID of the VPC in which to create private networking resources."
  type        = string
}

variable "public_subnet_id" {
  description = "ID of a public subnet where the NAT gateway will be placed."
  type        = string
}

variable "name_prefix" {
  description = "Prefix used for resource names (e.g. 'assemblemonitor-am-dev')."
  type        = string
}

variable "aws_region" {
  description = "AWS region; used to construct Availability Zone names (e.g. 'us-east-1')."
  type        = string
}

variable "private_subnet_cidr_map" {
  description = <<-EOT
    Map of Availability Zone suffix to private subnet CIDR block.
    Example: { a = "172.31.96.0/24", b = "172.31.97.0/24" }
    At least one entry is required.
  EOT
  type        = map(string)

  validation {
    condition     = length(var.private_subnet_cidr_map) >= 1
    error_message = "At least one private subnet CIDR must be provided."
  }
}

variable "tags" {
  description = "Additional tags merged onto all resources created by this module."
  type        = map(string)
  default     = {}
}
