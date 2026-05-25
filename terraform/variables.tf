variable "aws_region" {
  description = "AWS region where resources will be created"
  type        = string
}

variable "project_name" {
  description = "Project name used for resource names and tags"
  type        = string
}

variable "environment" {
  description = "Environment name such as dev, test, or prod"
  type        = string
}

variable "ec2_instance_type" {
  description = "EC2 instance type for the Docker host"
  type        = string
}

variable "ec2_key_name" {
  description = "Existing EC2 key pair name from AWS Console"
  type        = string
}

variable "my_ip_cidr" {
  description = "Your public IP in CIDR format for SSH, example 1.2.3.4/32"
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "s3_bucket_name" {
  description = "S3 bucket name for uploaded files"
  type        = string
}
