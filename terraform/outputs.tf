output "alb_dns_name" {
  description = "Application Load Balancer DNS name"
  value       = aws_lb.app_alb.dns_name
}

output "alb_url" {
  description = "Application URL through ALB"
  value       = "http://${aws_lb.app_alb.dns_name}"
}

output "target_group_name" {
  description = "ALB target group name"
  value       = aws_lb_target_group.app_tg.name
}

output "autoscaling_group_name" {
  description = "Auto Scaling Group name"
  value       = aws_autoscaling_group.app_asg.name
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  description = "RDS port"
  value       = aws_db_instance.postgres.port
}

output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.uploads.bucket
}

output "secret_name" {
  description = "Secrets Manager secret name"
  value       = aws_secretsmanager_secret.app_secret.name
}

output "app_security_group_id" {
  description = "App EC2 security group ID"
  value       = aws_security_group.app_sg.id
}

output "alb_security_group_id" {
  description = "ALB security group ID"
  value       = aws_security_group.alb_sg.id
}
