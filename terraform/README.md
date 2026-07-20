# 🏗️ AssembleMonitor Infrastructure (Terraform)

> [!IMPORTANT]
> This directory contains the Infrastructure as Code (IaC) configuration for deploying AssembleMonitor to AWS using Terraform. 

## 🏗️ Architecture & Resources Provisioned

This setup provisions an advanced, production-ready AWS environment. The following core resources are created:

- **Networking (VPC)**: A custom VPC with public and private subnets, Internet Gateway, and NAT Gateways.
- **Compute (Amazon EKS)**: An Amazon EKS cluster with managed Node Groups (`c7i-flex.large`) running across multiple Availability Zones.
- **Ingress (ALB & WAF)**: An Application Load Balancer (ALB) routing traffic directly to the Kubernetes NodePorts, protected by an AWS Web Application Firewall (WAF).
- **Database (RDS)**: A managed PostgreSQL database inside the private subnets.
- **Storage (S3)**: An S3 bucket for storing site uploads and images.
- **Secrets Management**: Secrets (database credentials, JWT keys) are managed in AWS Secrets Manager and synchronized into the Kubernetes cluster using the **External Secrets Operator (ESO)**.
- **Identity and Access Management**: IAM policies enforce the principle of least privilege. **IAM Roles for Service Accounts (IRSA)** provides pod-level AWS access, while the EC2 Instance Metadata Service (IMDSv2) hop limit is restricted to prevent unauthorized credential retrieval.

## 📋 Prerequisites

Before you can provision the infrastructure, ensure you have the following:

1. **Terraform**: Installed locally ([Download Terraform](https://www.terraform.io/downloads.html)).
2. **AWS CLI**: Installed and configured (`aws configure`) with appropriate administrative access.
3. **AWS Key Pair**: An existing EC2 Key Pair created in your target AWS region (e.g., `AM-Key`).
4. **AWS Profile**: A configured AWS named profile (e.g., `assemblemonitor-terraform`), or use `default`.

## ⚙️ Configuration (`terraform.tfvars`)

You must define your variables in a `terraform.tfvars` file before running the deployment. Since this file contains sensitive data (like database passwords and JWT secrets), **it is excluded from version control.**

Create a `terraform.tfvars` file in this directory using the following template:

```hcl
# AWS Setup
aws_region  = "us-east-1"
aws_profile = "assemblemonitor-terraform" # Or "default"

# General
project_name = "assemblemonitor"
environment  = "advance-dev"

# Security & Access
my_ip_cidr    = "YOUR_PUBLIC_IP/32" # E.g., "203.0.113.1/32"
key_pair_name = "AM-Key"            # Name of the Key Pair in AWS Console

# EC2 & Auto Scaling
app_instance_type    = "c7i-flex.large"
asg_min_size         = 1
asg_desired_capacity = 2
asg_max_size         = 3

# Application Details
github_repo_url    = "https://github.com/YOUR_USERNAME/YOUR_REPO.git"
dockerhub_username = "your_dockerhub_username"
backend_image      = "your_dockerhub_username/assemblemonitor-backend"
frontend_image     = "your_dockerhub_username/assemblemonitor-frontend"

# Database (RDS)
db_instance_class    = "db.t4g.micro"
db_allocated_storage = 20
db_name              = "your_db_name"
db_username          = "your_db_username"
db_password          = "YOUR_SECURE_PASSWORD"

# App Secrets
jwt_secret_key = "YOUR_JWT_SECRET"
s3_bucket_name = "your-unique-s3-bucket-name"
secret_name    = "assemblemonitor/dev/app-secrets"
```

## 🚀 Standard Workflow

Follow these steps to deploy or update the infrastructure:

### 1. Initialize Terraform
Downloads the required AWS provider plugins and initializes the backend.
```bash
terraform init
```

### 2. Format & Validate (Optional but recommended)
Ensures your code is correctly formatted and syntactically valid.
```bash
terraform fmt
terraform validate
```

### 3. Plan the Deployment
Shows an execution plan detailing exactly what resources will be created, modified, or destroyed. **Always review this before applying.**
```bash
terraform plan
```

### 4. Apply the Changes
Provisions the infrastructure on AWS. You will be prompted to type `yes` to confirm.
```bash
terraform apply
```

### 5. View Outputs
After a successful deployment, Terraform will print the outputs (like the Load Balancer DNS name). If you need to view them again later, run:
```bash
terraform output
```
*(You can access your live application by navigating to the ALB DNS name in your browser).*

## 🛑 Teardown / Destruction

When you are done testing or want to remove all resources to avoid AWS charges, run the destroy command. **Warning: This will delete the database and all data within it.**

```bash
terraform destroy
```
Type `yes` when prompted to confirm the destruction of the infrastructure.
