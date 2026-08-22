# Infrastructure as Code (Terraform)

> [!IMPORTANT]
> The AWS Cloud environment is fully codified using HashiCorp Terraform. Manual provisioning via the AWS Console is strictly prohibited to prevent configuration drift.

## Purpose

Terraform is utilized to define the AWS infrastructure as code, ensuring consistent, repeatable, and automated provisioning across environments. By codifying the infrastructure, the entire state of the cloud architecture remains version-controlled and auditable.

## Provisioned Resources

- **Amazon EKS**: Provisions the managed Kubernetes control plane and an auto-scaling Node Group (`c7i-flex.large`), injecting necessary IAM roles and policies.
- **EKS OIDC Provider & IRSA**: Provisions an OpenID Connect (OIDC) provider for the EKS cluster, establishing trust with AWS IAM. This enables specific Kubernetes ServiceAccounts to dynamically assume IAM roles (IRSA) without relying on underlying EC2 metadata.
- **Application Load Balancer (ALB) & WAF**: Manages external ingress traffic, strictly routing to the internal EKS NodePorts while filtering malicious requests through an AWS Web Application Firewall.
- **VPC & Networking**: Utilizes the default AWS VPC with two custom private subnets (`172.31.96.0/24`, `172.31.97.0/24`) distributed across Availability Zones, alongside a NAT Gateway to provide secure egress from EKS worker nodes.
- **Security Groups**: Granular network isolation restricting access strictly between the ALB, EKS Nodes, and the RDS database.
- **RDS PostgreSQL**: Highly available managed database instance protected inside private subnets.
- **S3 Buckets**: Two private S3 buckets — one for application uploads (site photos) and one for observability backend storage (Loki chunks and Tempo traces).
- **AWS Secrets Manager**: Secure, centralized storage for database credentials and JWT keys.
- **AWS CloudWatch**: Centralized log groups and metric alarms for proactive telemetry monitoring.
- **Route 53 & ACM** _(Configuration Present, Not Applied)_: A Route 53 hosted zone, ACM certificate, and DNS validation configuration exist in `route53.tf` and are plan-validated. They are not applied as no custom domain is registered for this project; public access utilizes the ALB DNS name output directly (`terraform output alb_url`).
- **Outputs**: Dynamically exports critical values including the ALB DNS name and the RDS endpoint.

## Security & State Management

> [!WARNING]
> **IMDSv2 Configuration:** To enforce least privilege access, the EKS Node Launch Template sets `http_put_response_hop_limit = 1`. This prevents Kubernetes pods from unauthorized querying of the EC2 Instance Metadata Service (IMDSv2) to assume the underlying server IAM role.

> [!WARNING]
> **State Security:** Terraform state files (`.tfstate`) and variable files (`terraform.tfvars`) containing sensitive environment overrides are strictly excluded from version control via `.gitignore`. Remote state backends are recommended for multi-developer environments to ensure state consistency and lock management.

## Execution Workflow

```bash
# Initialize Terraform and download provider plugins
terraform init

# Format configuration files to standard conventions
terraform fmt

# Validate syntactic correctness
terraform validate

# Review the infrastructure execution plan
terraform plan

# Provision or update the infrastructure
terraform apply -auto-approve
```
