variable "aws_region" {
  description = "AWS region where resources will be created"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile used by Terraform"
  type        = string
  default     = "default"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "assemblemonitor"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "am-dev"
}

#variable "my_ip_cidr" {
#  description = "Your public IP in CIDR format for SSH access"
#  type        = string
#}

variable "key_pair_name" {
  description = "Existing EC2 key pair name"
  type        = string
}

variable "app_instance_type" {
  description = "EC2 instance type for app ASG instances"
  type        = string
  default     = "c7i-flex.large"
}

variable "asg_min_size" {
  description = "Minimum number of instances in ASG"
  type        = number
  default     = 0
}

variable "asg_desired_capacity" {
  description = "Desired number of instances in ASG"
  type        = number
  default     = 0
}

variable "asg_max_size" {
  description = "Maximum number of instances in ASG"
  type        = number
  default     = 0
}

variable "github_repo_url" {
  description = "GitHub repository URL"
  type        = string
}

variable "dockerhub_username" {
  description = "Docker Hub username"
  type        = string
}

variable "backend_image" {
  description = "Backend Docker image"
  type        = string
}

variable "frontend_image" {
  description = "Frontend Docker image"
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "assemblemonitor"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "assembleuser"
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "jwt_secret_key" {
  description = "JWT secret key for backend app"
  type        = string
  sensitive   = true
}

variable "s3_bucket_name" {
  description = "S3 bucket name for app uploads"
  type        = string
}

variable "secret_name" {
  description = "AWS Secrets Manager secret name"
  type        = string
  default     = "assemblemonitor/dev/app-secrets"
}

variable "k3s_sg_id" {
  description = "Security group ID of the existing K3S EC2 instance — used to allow it inbound access to RDS. Set this value in terraform.tfvars (gitignored)."
  type        = string
}
