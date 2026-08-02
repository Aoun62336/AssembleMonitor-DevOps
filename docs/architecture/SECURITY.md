# 🛡️ AssembleMonitor Security Posture

> [!IMPORTANT]
> Security in AssembleMonitor is achieved through a strict DevSecOps pipeline and deeply nested AWS private networks to ensure zero public exposure of critical assets. No sensitive data is stored in version control.

## 1. Identity & Access Management (IAM & IRSA)
AssembleMonitor follows the principle of least privilege for all cloud interactions.
- **Root Account Protection**: The AWS root account is secured and not utilized for daily provisioning.
- **IAM Roles for Service Accounts (IRSA)**: The EKS cluster leverages IRSA to grant specific Kubernetes pods an OIDC-backed Web Identity Token. This allows pods (like the backend API or External Secrets Operator) to assume an IAM role directly, entirely bypassing the need for long-lived access keys or node-level permissions.
- **IMDSv2 Restriction**: The EKS Node Launch Template sets `http_put_response_hop_limit = 1`, preventing containers from unauthorized querying of the EC2 Instance Metadata Service (IMDSv2) to assume the underlying server's IAM role.

## 2. Network Boundary & Perimeter Defense
All application resources are heavily shielded from the public internet.
- **VPC & Subnets**: EKS Nodes and the RDS database reside deep within private subnets. External egress is routed securely through a NAT Gateway.
- **Application Load Balancer (ALB) & WAF**: External traffic must flow through the ALB. The ALB is protected by an AWS Web Application Firewall (WAFv2). Managed rule groups (CommonRuleSet, KnownBadInputs) actively monitor and log SQLi and XSS requests, while a rate-limit rule actively blocks any single IP exceeding 2,000 requests per 5-minute window.
- **Security Groups**: Granular network isolation ensures the EKS Nodes only accept HTTP traffic from the ALB, and the RDS database exclusively permits PostgreSQL connections from the EKS Node Security Group.

## 3. Data Security & Secrets Management
To comply with strict DevSecOps standards, no secrets are ever hardcoded or committed to version control.
- **AWS Secrets Manager**: Application secrets (Database URL, JWT Key) and RDS master passwords are securely centralized in AWS Secrets Manager.
- **External Secrets Operator (ESO)**: The cluster runs ESO, which authenticates to AWS via IRSA. It dynamically pulls the AWS Secrets payload and creates native Kubernetes `Secret` objects. Pods mount these synced secrets as environment variables at runtime, ensuring GitOps repositories remain free of sensitive data.
- **S3 Bucket Security**: S3 Block Public Access is strictly enabled at the bucket level, and IAM policies scope read/write capabilities strictly to authorized application roles.

## 4. DevSecOps & Pipeline Integrity
Security is continuously enforced throughout the CI/CD lifecycle.
- **Static Application Security Testing (SAST)**: SonarQube Quality Gates are configured to instantly abort Jenkins deployments if critical vulnerabilities or code smells are detected in the source code.
- **Container Security**: Trivy container image scanning is enforced in the CI/CD pipeline. Docker images are scanned to guarantee zero embedded secrets or critical CVEs before being pushed to the registry. The Backend FastAPI Dockerfile also utilizes a non-root, restricted user for execution.
