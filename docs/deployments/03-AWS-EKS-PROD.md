# Amazon EKS Production Architecture (Primary)

> [!IMPORTANT]
> This represents the primary AWS EKS deployment strategy for AssembleMonitor. The application is orchestrated by an Amazon Elastic Kubernetes Service (EKS) cluster utilizing secure and scalable AWS infrastructure.

**Execution Scope:** Enterprise Production, High Availability, Auto-Scaling
**Complexity:** Very High
**Architecture:** Amazon EKS, Terraform, ArgoCD, Helm, AWS Application Load Balancer (ALB), AWS WAF, Horizontal Pod Autoscaler (HPA), Kubernetes Metrics Server

## Architectural Overview

This architecture is fully integrated into the AWS ecosystem:

1. **Managed Control Plane**: AWS manages the Kubernetes control plane for maximum reliability.
2. **Managed Node Groups**: EC2 instances (`c7i-flex.large`) are dynamically provisioned into private subnets by EKS.
3. **ALB NodePort Integration**: A pre-existing, Terraform-managed Application Load Balancer routes external traffic directly to the Kubernetes `NodePort 30080` via an Auto Scaling Group attachment.
4. **AWS WAF**: The ALB is protected by an AWS WAFv2 instance. Managed rule groups (CommonRuleSet, KnownBadInputs) are configured in count/monitor mode to log SQLi and XSS payloads without blocking requests. A rate-limit rule actively blocks any single IP generating more than 2,000 requests within a 5-minute window.
5. **Horizontal Pod Autoscaling**: The Kubernetes Metrics Server monitors CPU utilization. If CPU exceeds 70%, the HPA automatically scales the frontend and backend pods from a minimum of 2 up to 5 replicas.
6. **GitOps CD (ArgoCD)**: ArgoCD operates within the cluster and continuously synchronizes the deployment state with the Helm charts stored in the GitHub repository.

## Deployment Procedure

### 1. Terraform Provisioning

The underlying infrastructure (EKS cluster, Nodes, ALB, WAF, Security Groups, RDS) must be provisioned via Terraform:

```bash
cd terraform
terraform apply -auto-approve
```

### 2. Cluster Authentication

Upon Terraform completion, configure the local `kubectl` context to authenticate with the EKS cluster:

```bash
aws eks update-kubeconfig --region us-east-1 --name assemblemonitor-am-dev-eks
```

### 3. Verify GitOps Synchronization

ArgoCD is natively installed by Terraform, which also provisions the `argocd-apps` configuration during the `apply` phase.

Verify that ArgoCD has detected the remote repository and initialized the application pods:

```bash
kubectl get pods -n assemblemonitor
```

### 4. Verify Autoscaling (HPA)

Verify the Metrics Server is active and the HPA is successfully tracking CPU load:

```bash
kubectl get hpa -n assemblemonitor
```

## Application Access Endpoints

### 1. Administrative Interfaces (GitOps & Observability)

The AWS LoadBalancers for ArgoCD and Grafana are provisioned dynamically. To retrieve the endpoints without manual port-forwarding, execute the helper script:

```bash
./get-urls.sh
```

### 2. Public Frontend Interface

The application is exposed securely via the AWS Application Load Balancer. Direct access to EC2 instances is prohibited.

Retrieve the ALB endpoint:

```bash
terraform output alb_url
```

Navigate to the output URL (e.g., `http://<ALB_DNS_NAME>`). Traffic is routed from the ALB to the EKS Nodes on Port 30080, and internally proxied to the Nginx and FastAPI pods.

---

## August 2026 Hardening

Subsequent to the primary EKS deployment, the following reliability and security hardening measures were implemented. Consult [`docs/hardening/SYSTEM_RELIABILITY_REPORT.md`](../hardening/SYSTEM_RELIABILITY_REPORT.md) for full evidence.

- CI workflow hardening: ubuntu-24.04 runner, SHA-pinned actions, Helm 3.21.3 (curl+SHA256 verification), Terraform 1.15.8.
- Pre-merge branch ruleset enforcing 4 required status checks.
- Kubernetes NetworkPolicy and PodDisruptionBudget appended to the Helm chart.
- Terraform network module extracted with 5 native unit tests (`mock_provider`).
- 3 controlled fault drills executed (INC-001, INC-002, INC-003) yielding an MTTR range of 2m 9s – 2m 35s.
