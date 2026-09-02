# Infrastructure as Code (Terraform)

> [!IMPORTANT]
> The AWS Cloud environment is fully codified using HashiCorp Terraform. Manual provisioning via the AWS Console is strictly prohibited to prevent configuration drift.

## Purpose

Terraform defines the full AWS infrastructure as code. The complete cloud environment is version-controlled and auditable; reprovisioning from scratch requires only `terraform apply`.

## Provisioned Resources

- **Amazon EKS**: Managed Kubernetes control plane and auto-scaling Node Group (`c7i-flex.large`), including necessary IAM roles and policies.
- **EKS OIDC Provider & IRSA**: OpenID Connect provider for the EKS cluster, enabling Kubernetes ServiceAccounts to assume IAM roles without EC2 metadata access.
- **Application Load Balancer (ALB) & WAF**: External ingress, routed to EKS NodePort, protected by WAFv2 (CommonRuleSet, KnownBadInputs, rate-limiting).
- **VPC & Networking**: Default AWS VPC with two custom private subnets across AZs, plus NAT Gateway for secure node egress.
- **Security Groups**: ALB → EKS Nodes → RDS isolation.
- **RDS PostgreSQL**: `db.t4g.micro` in private subnets. Not directly reachable from the internet.
- **S3 Buckets**: Application artifact storage (site photos) and observability backend (Loki, Tempo).
- **AWS Secrets Manager**: Database credentials and JWT keys.
- **AWS CloudWatch**: ALB, RDS, and EKS alarms.
- **Route 53 & ACM** _(configuration present, not applied)_: Exists in `route53.tf`, plan-validated. Not applied; no custom domain is registered and public access uses the ALB DNS name.
- **Outputs**: ALB DNS name, RDS endpoint.

## Security & State Management

> [!WARNING]
> **IMDSv2 Configuration:** The EKS Node Launch Template sets `http_put_response_hop_limit = 1`, preventing pods from querying EC2 instance metadata to assume the underlying node IAM role.

> [!WARNING]
> **State Security:** `.tfstate` and `terraform.tfvars` are excluded from version control via `.gitignore`. Remote state backends are recommended for multi-developer environments.

## Execution Workflow

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply -auto-approve
```

---

## Terraform Implementation

Resources are organized by responsibility layer:

```
Networking
  ├── private subnets (modules/network)
  ├── NAT Gateway
  └── route tables

Compute / Kubernetes
  ├── EKS cluster (eks.tf)
  ├── managed node group
  └── EBS CSI driver (addons.tf)

Traffic
  ├── ALB (alb_asg.tf)
  └── WAF (waf.tf)

Data
  ├── RDS PostgreSQL (rds.tf)
  └── S3 buckets (s3.tf)

Identity & Secrets
  ├── IAM roles + policies (iam.tf)
  ├── OIDC provider / IRSA
  └── Secrets Manager (secrets.tf)

Operations
  ├── CloudWatch alarms (cloudwatch.tf)
  ├── Metrics Server
  ├── External Secrets Operator
  └── Argo CD (argocd.tf)
```

## Reusable Network Module

The private-networking layer is extracted into `terraform/modules/network/` so it can be unit-tested independently of the rest of the infrastructure.

The module creates private subnets, a NAT Gateway, an EIP, a private route table, and route table associations within a caller-provided existing VPC. Five native `terraform test` cases using `mock_provider` verify the configuration logic without requiring AWS credentials.

→ [Network module documentation](../../terraform/modules/network/README.md)

