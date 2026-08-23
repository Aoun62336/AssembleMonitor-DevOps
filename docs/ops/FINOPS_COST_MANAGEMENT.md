# FinOps & Cost Management

> [!TIP]
> Cost optimization is achieved by utilizing Kubernetes Horizontal Pod Autoscaling (HPA) to scale workloads down to minimum replicas during idle periods, and Terraform to execute total environmental suspension during non-operational hours.

## Purpose

This document outlines the financial operations (FinOps) strategies employed to manage and optimize AWS infrastructure costs for the AssembleMonitor platform, ensuring the Amazon EKS environment maintains cost-efficiency alongside high availability.

## Cost-Generating Infrastructure

| Resource | Function | Cost Optimization Strategy |
|---|---|---|
| **Amazon EKS Cluster** | Kubernetes Control Plane | `$0.10/hour` baseline. Suspended via Terraform during non-production periods. |
| **EC2 `c7i-flex.large` Nodes** | EKS Worker Nodes | Fixed configuration (2 nodes). Cluster Autoscaler is not deployed; node scaling requires Terraform modification. Pod-level scaling is managed by HPA. |
| **EBS (20 GB)** | Node Root Volumes | Configured for `delete_on_termination` to prevent orphaned volume accumulation. |
| **Application Load Balancer** | Traffic Routing & WAF | Stateful Terraform resource; destroyed when the cluster is suspended. |
| **RDS PostgreSQL** | Primary Datastore | Stopped during non-business hours; automated snapshots managed by lifecycle retention policies. |
| **S3 Buckets** | Object Storage | S3 Object Versioning enabled. Transition to Glacier/Infrequent Access lifecycle policies are planned future optimizations. |
| **CloudWatch** | Telemetry Aggregation | Strict log retention policies enforced to prevent unbound storage cost scaling. |

## Auto-Scaling Efficiency

During active operation, cost efficiency is governed by Kubernetes-native scaling primitives:

- **Horizontal Pod Autoscaler (HPA)**: Monitors CPU utilization via the Metrics Server, dynamically scaling pod replicas up during load events and down to the configured minimum during low-traffic periods. (Memory-based scaling is not implemented).
- **Node Configuration**: Node count is statically defined at the Terraform minimum (2 nodes). Without Cluster Autoscaler or Karpenter, underlying compute remains static while pod density fluctuates.

## Non-Production Environment Suspension

The cloud environment is fully codified. To eliminate idle resource costs during non-active periods, the complete stack must be suspended and re-provisioned on demand:

### Infrastructure Suspension

```bash
# Execute pre-suspension database export
pg_dump -h <RDS_ENDPOINT> -U <DB_USERNAME> -d <DB_NAME> > backup.sql

# Execute total infrastructure teardown (EKS, ALB, WAF)
terraform destroy
```

### Infrastructure Re-Provisioning

```bash
# Execute full infrastructure rebuild
terraform apply

# Validate ArgoCD initialization and synchronization
kubectl get pods -n argocd
kubectl get pods -n assemblemonitor
```

## Localized Development Strategy

To bypass cloud compute costs entirely, engineers execute local feature development using the Docker Compose stack:

```bash
# Initialize local execution environment (FastAPI, React, PostgreSQL)
docker compose up -d
```

## RDS Lifecycle Management

> [!WARNING]
> Stopped RDS instances automatically restart after 7 days in accordance with AWS maintenance policies. Active monitoring via AWS Budgets and Cost Explorer is required to detect unintended resource initiation.
