# AssembleMonitor Infrastructure as Code (Terraform)

> [!IMPORTANT]
> This directory contains the Infrastructure as Code (IaC) configuration for deploying AssembleMonitor to AWS via Terraform.

## Architecture & Resources Provisioned

This configuration provisions the AWS production environment. Core resources include:

- **Networking (VPC)**: Default AWS VPC configured with two custom private subnets (`172.31.96.0/24`, `172.31.97.0/24`) and a NAT Gateway for worker node egress.
- **Compute (Amazon EKS)**: Amazon EKS cluster with managed Node Groups (`c7i-flex.large`) spanning multiple Availability Zones.
- **Ingress (ALB & WAF)**: Application Load Balancer (ALB) routing to Kubernetes NodePorts, secured by AWS Web Application Firewall (WAFv2).
- **Database (RDS)**: Managed PostgreSQL database deployed strictly within private subnets.
- **Storage (S3)**: S3 bucket configured for object storage (site uploads and images).
- **Secrets Management**: Credentials (database passwords, JWT keys) provisioned in AWS Secrets Manager and synchronized to the cluster via External Secrets Operator (ESO).
- **Identity and Access Management**: IAM Roles for Service Accounts (IRSA) configured for pod-level least privilege access. EC2 Instance Metadata Service (IMDSv2) hop limit restricted to prevent unauthorized metadata access.

## Prerequisites

Required local dependencies and AWS configurations:

1. **Terraform**: CLI installed (`>= 1.5.0`).
2. **AWS CLI**: Authenticated with administrative permissions (`aws configure`).
3. **AWS Key Pair**: Existing EC2 Key Pair in the target region.
4. **AWS Profile**: Named profile configured (or `default` profile active).

## Configuration (`terraform.tfvars`)

Runtime variables must be defined in `terraform.tfvars`.
**Note:** This file is excluded from version control to prevent credential leakage.

Example configuration template:

```hcl
# AWS Configuration
aws_region  = "us-east-1"
aws_profile = "default"

# Environment Metadata
project_name = "assemblemonitor"
environment  = "advance-dev"

# Security & Access
key_pair_name = "AM-Key"

# Compute (EC2 & Auto Scaling)
app_instance_type    = "c7i-flex.large"
asg_min_size         = 1
asg_desired_capacity = 2
asg_max_size         = 3

# Application Artifacts
github_repo_url    = "https://github.com/USERNAME/REPO.git"
dockerhub_username = "docker_user"
backend_image      = "docker_user/assemblemonitor-backend"
frontend_image     = "docker_user/assemblemonitor-frontend"

# Database Configuration (RDS)
db_instance_class    = "db.t4g.micro"
db_allocated_storage = 20
db_name              = "dbname"
db_username          = "dbuser"
db_password          = "SECURE_PASSWORD"

# Application Secrets
jwt_secret_key = "JWT_SECRET"
s3_bucket_name = "unique-s3-bucket-name"
secret_name    = "assemblemonitor/dev/app-secrets"
```

## Standard Execution Workflow

### 1. Initialization
Initialize the backend and download provider plugins.
```bash
terraform init
```

### 2. Validation
Format configuration files and validate syntax.
```bash
terraform fmt
terraform validate
```

### 3. Plan
Generate and review the execution plan.
```bash
terraform plan
```

### 4. Apply
Provision infrastructure.
```bash
terraform apply
```

### 5. Outputs
Retrieve deployment metadata (e.g., ALB DNS endpoint).
```bash
terraform output
```

## Decommissioning Workflow

To permanently destroy all provisioned infrastructure (including databases and stored data):

```bash
terraform destroy
```

---

## Module Refactor — `modules/network` (Aug 2026)

A reusable child module was extracted from the root configuration to isolate networking logic and improve testability.

### Module Structure

| Path | Description |
|---|---|
| `terraform/modules/network/` | Reusable module: private subnets, NAT gateway, route table (configurable via `private_subnet_cidr_map`). |
| `terraform/modules/network/tests/` | Native unit tests using `terraform test` and `mock_provider` (no AWS credentials required). |
| `terraform/examples/modular-network/` | Example root module implementing the network child module; validated statically in CI. |

### Module Unit Testing

Execute the native Terraform unit test suite locally:

```bash
cd terraform/modules/network
terraform init -backend=false
terraform test
```

**Test Coverage:** 5 tests executing against `mock_provider "aws" {}`. Asserts correct subnet count, expected CIDR boundaries, NAT gateway deployment location, default route propagation, and empty-map validation.

> [!NOTE]
> The root `terraform/` directory retains the primary production configuration. The `modules/` and `examples/` directories represent the refactored architecture. A provider lock file (`.terraform.lock.hcl`) is intentionally excluded from the reusable child module per HashiCorp best practices.
