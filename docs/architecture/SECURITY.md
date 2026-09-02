# AssembleMonitor Security Posture

> [!IMPORTANT]
> Security in AssembleMonitor is implemented through a layered DevSecOps pipeline and AWS private networking. Application workloads run inside private subnets with no direct public access. Sensitive data is not stored in version control.

## 1. Identity & Access Management (IAM & IRSA)

AssembleMonitor follows the principle of least privilege for all cloud interactions.

**Secret and identity delivery chain:**

```
EKS OIDC Provider
      ↓
IAM Role (with OIDC trust policy scoped to the service account)
      ↓
IRSA (Kubernetes ServiceAccount annotation → AWS STS issues temporary credentials)
      ↓
External Secrets Operator
      ↓
AWS Secrets Manager
      ↓
Kubernetes Secret (created and rotated by ESO)
      ↓
Backend Pod environment variables
```

**S3 access (site photo upload):**

```
Backend Pod
      ↓
IRSA temporary credentials (via projected ServiceAccount token)
      ↓
S3 API
```

This approach eliminates long-lived AWS access keys from pods entirely. Credentials are short-lived OIDC tokens issued by AWS STS, scoped to a single IAM role, and rotate automatically. Each workload has its own IAM role with only the permissions it needs — ESO cannot access S3, and the backend cannot access Secrets Manager without going through ESO.

- **Root Account Protection**: The AWS root account is secured and not used for daily provisioning.
- **IAM Roles for Service Accounts (IRSA)**: The EKS cluster leverages IRSA to grant specific Kubernetes pods an OIDC-backed Web Identity Token. This allows pods (like the backend API or External Secrets Operator) to assume an IAM role directly, entirely bypassing the need for long-lived access keys or node-level permissions.
- **IMDSv2 Restriction**: The EKS Node Launch Template sets `http_put_response_hop_limit = 1`, preventing containers from unauthorized querying of the EC2 Instance Metadata Service (IMDSv2) to assume the underlying server's IAM role.


## 2. Network Boundary & Perimeter Defense
All application resources are isolated from the public internet.
- **VPC & Subnets**: EKS Nodes and the RDS database reside deep within private subnets. External egress is routed securely through a NAT Gateway.
- **Application Load Balancer (ALB) & WAF**: External traffic must flow through the ALB. The ALB is protected by an AWS Web Application Firewall (WAFv2). Managed rule groups (CommonRuleSet, KnownBadInputs) actively monitor and log SQLi and XSS requests, while a rate-limit rule actively blocks any single IP exceeding 2,000 requests per 5-minute window.
- **Security Groups**: Granular network isolation ensures the EKS Nodes only accept HTTP traffic from the ALB, and the RDS database exclusively permits PostgreSQL connections from the EKS Node Security Group.

## 3. Data Security & Secrets Management
- **AWS Secrets Manager**: Application secrets (Database URL, JWT Key) and RDS master passwords are stored in AWS Secrets Manager — not in source code or Kubernetes manifests.
- **External Secrets Operator (ESO)**: The cluster runs ESO, which authenticates to AWS via IRSA. It dynamically pulls the AWS Secrets payload and creates native Kubernetes `Secret` objects. Pods mount these synced secrets as environment variables at runtime, ensuring GitOps repositories remain free of sensitive data.
- **S3 Bucket Security**: S3 Block Public Access is strictly enabled at the bucket level, and IAM policies scope read/write capabilities strictly to authorized application roles.

## 4. DevSecOps & Pipeline Integrity
Security is continuously enforced throughout the CI/CD lifecycle.
- **Static Application Security Testing (SAST)**: SonarQube Quality Gates are configured to block Jenkins deployments if critical vulnerabilities or code smells are detected in the source code.
- **Container Security**: Trivy container image scanning is enforced in the CI/CD pipeline. Images are scanned for HIGH and CRITICAL CVEs and embedded secrets before being pushed to the registry; the pipeline fails the build (`--exit-code 1`) if any are detected. The Backend FastAPI Dockerfile also utilizes a non-root, restricted user for execution.

## 5. Kubernetes Network Segmentation

Kubernetes `NetworkPolicy` and `PodDisruptionBudget` resources are codified in the Helm chart (`k8s/helm-chart/templates/`) and controlled by feature flags in `values/app.yaml`.

### NetworkPolicy

When `networkPolicy.enabled` is enabled, two policies apply pod-level traffic isolation to the selected frontend and backend workloads:

| Policy | Ingress | Egress |
|---|---|---|
| **Backend** | Port 8000 from frontend pods and OTel collector pods only | DNS (53), PostgreSQL (5432), OTLP gRPC (4317), HTTPS/AWS APIs (443), SMTP (587/465) |
| **Frontend** | Application port 8080; external EKS routing is handled by the Terraform-managed AWS ALB | DNS (53) and backend port 8000 only |

Policies are disabled by default (`networkPolicy.enabled: false`) for EKS historical compatibility and enabled via `values/hardening-validation.yaml` for k3d testing.

### PodDisruptionBudget

Both backend and frontend Deployments define a `PodDisruptionBudget` with `maxUnavailable: 1`, gated on `pdb.enabled` AND `hpa.enabled`.

When enabled:
- voluntary disruptions through the Kubernetes Eviction API may make at most one selected replica unavailable at a time;
- `kubectl drain` respects the disruption budget and may retry evictions while the budget is exhausted;
- Deployment rolling-update availability remains governed by the Deployment rollout strategy rather than by the PodDisruptionBudget.

The manifests use the stable `policy/v1` API.
