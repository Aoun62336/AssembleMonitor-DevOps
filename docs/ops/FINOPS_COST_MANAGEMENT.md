# 💰 AssembleMonitor FinOps & Cost Management

> [!TIP]
> Cost efficiency is achieved by utilizing Kubernetes auto-scaling (HPA) to scale pods down to the configured minimum replicas during idle periods, and Terraform to completely suspend environments out-of-hours.

## 🎯 Purpose

This document outlines the financial operations (FinOps) strategies employed to manage and optimize AWS infrastructure costs for the AssembleMonitor platform, ensuring the highly available Amazon EKS environment remains cost-efficient.

## 📊 Cost-Producing Resources

| Resource                           | Purpose                            | Cost Optimization Strategy                                                                                                                           |
| ---------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Amazon EKS Cluster**             | Managed Kubernetes Control Plane   | `$0.10/hour` - Cluster is suspended/destroyed via Terraform during extended non-production periods.                                                  |
| **EC2 c7i-flex.large Node Groups** | Runs Kubernetes pods and workloads | Fixed at 2 nodes (min 2, max 3); no Cluster Autoscaler is deployed — node scaling is managed manually via Terraform node group configuration. Pod-level scaling is handled by HPA. |
| **EBS 20 GB**                      | EKS Node root disk                 | Automatically deleted upon node termination to prevent orphaned volume charges.                                                                      |
| **Application Load Balancer**      | Traffic routing & WAF protection   | Tied to Terraform state; destroyed when cluster is offline.                                                                                          |
| **RDS PostgreSQL**                 | Stateful production database       | Stopped during non-business hours; automated snapshots managed by retention policies.                                                                |
| **S3 Bucket**                      | Object storage                     | S3 Object Versioning enabled on both buckets. Lifecycle transition policies (e.g., to Glacier) are a planned cost optimization, not yet implemented. |
| **CloudWatch**                     | Metrics/logs                       | Log retention policies enforced to prevent infinite storage growth.                                                                                  |

## ⚖️ Auto-Scaling Efficiency

During active operation, cost efficiency is primarily driven by Kubernetes-native auto-scaling:

- **HPA (Horizontal Pod Autoscaler)** monitors **CPU utilization** via the Metrics Server, dynamically scaling pod replicas up during traffic spikes and down to the configured minimum during low-traffic periods. Memory-based scaling is not currently configured.
- **Node Count** is fixed at the Terraform-defined minimum (2 nodes). No Cluster Autoscaler or Karpenter is deployed; node-level scaling requires a manual Terraform change.

## ⏸️ Non-Production Environment Suspension

For staging, development, or non-active periods, the cloud environment is completely codified. Rather than leaving idle resources running, the entire stack can be suspended and re-provisioned on demand:

### Suspending Infrastructure

```bash
# Export necessary databases before teardown
pg_dump -h <RDS_ENDPOINT> -U <DB_USERNAME> -d <DB_NAME> > backup.sql

# Tear down the EKS cluster, ALB, and WAF
terraform destroy
```

### Re-Provisioning Infrastructure

```bash
# Rebuild infrastructure (includes ArgoCD, ESO, Metrics Server, and all app workloads)
terraform apply

# Verify ArgoCD is running and syncing the application
kubectl get pods -n argocd
kubectl get pods -n assemblemonitor
```

## 💻 Daily Cost-Safe Practice

For localized feature development, engineers bypass cloud costs entirely by utilizing the local Docker Compose environment:

```bash
# Spin up local replica (FastAPI, React, Postgres)
docker compose up -d
```

## ⚠️ RDS Cost Management Reminder

> [!WARNING]
> Stopped RDS instances automatically restart after 7 days due to AWS maintenance requirements. Ensure active monitoring via AWS Budgets and Cost Explorer to detect unintended restarts.
