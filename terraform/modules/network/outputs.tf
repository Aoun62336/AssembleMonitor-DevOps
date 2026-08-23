# =============================================================================
# Module: network — Output Values
# =============================================================================

output "private_subnet_ids" {
  description = "Map of AZ suffix to private subnet ID (e.g. { a = 'subnet-xxx', b = 'subnet-yyy' })."
  value       = { for k, v in aws_subnet.private : k => v.id }
}

output "private_subnet_id_list" {
  description = "Ordered list of private subnet IDs (for use with EKS node group and RDS subnet group)."
  value       = [for v in aws_subnet.private : v.id]
}

output "nat_gateway_id" {
  description = "ID of the NAT gateway."
  value       = aws_nat_gateway.main.id
}

output "nat_eip_public_ip" {
  description = "Public IP address of the NAT gateway's Elastic IP. Useful for allowlisting in security groups."
  value       = aws_eip.nat.public_ip
}

output "private_route_table_id" {
  description = "ID of the private route table. Use to associate additional subnets outside this module."
  value       = aws_route_table.private.id
}
