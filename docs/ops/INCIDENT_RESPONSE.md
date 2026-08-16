# 🚑 Incident Response & Disaster Recovery

> [!CAUTION]
> In the event of a total regional outage, catastrophic data loss, or a broken deployment, follow this document precisely. Because the infrastructure is codified via Terraform and GitOps, recovery procedures are largely automated. The figures below are design estimates based on observed local testing — they have not been measured under production load and should not be treated as contractual SLAs.

## 🎯 Recovery Objectives (RTO / RPO)

| Tier                                | RTO (estimate)  | RPO (estimate) | Notes                                                         |
| ----------------------------------- | --------------- | -------------- | ------------------------------------------------------------- |
| **Infrastructure** (Terraform)      | ~8–15 min       | N/A            | Full EKS + ALB + WAF reprovisioned from code; timing varies by API latency |
| **Application** (ArgoCD sync)       | ~3–10 min       | N/A            | ArgoCD reconciles cluster state from Git after provisioning   |
| **Database** (RDS automated backup) | ~15–30 min     | up to 24 h     | Daily automated backups; manual snapshots before migrations   |
| **Object Storage** (S3)             | Minutes         | Per-version    | S3 Versioning enabled; previous versions restorable via console/CLI |

---

## ⏪ Application Rollback Procedures

### ☸️ Rollback Steps on Kubernetes (GitOps / ArgoCD)

Because the architecture uses GitOps (ArgoCD), rolling back is driven by Git history — auditable, reproducible, and not dependent on manual cluster access.

**Method 1: Git Revert (Recommended)**
Simply revert the commit in GitHub that triggered the bad deployment. ArgoCD will instantly detect the reverted commit and rollback the cluster state.

```bash
git revert HEAD
git push origin main
```

**Method 2: ArgoCD UI (Emergency)**
If Git is inaccessible, you can instantly rollback via the ArgoCD UI:
1. Open the ArgoCD Dashboard.
2. Select the `assemblemonitor-app` application.
3. Click **History and Rollback**.
4. Select the previous stable deployment and click **Rollback**.

---

## 🚨 Complete Infrastructure Failure Recovery

Because the entire production architecture (VPC, EKS, ALB, WAF) is rigorously codified in Terraform, recovery from a total cluster failure is highly automated:

1. **Re-Provision**: Run `terraform apply` to instantly spin up a replacement EKS Cluster and auto-scaled Node Group. Terraform automatically installs ArgoCD, ESO, and Metrics Server via `helm_release` resources.
2. **ALB Re-Attachment**: The Terraform configuration automatically re-attaches the Load Balancer target groups to the new EKS cluster instances.
3. **GitOps Sync**: ArgoCD is provisioned by Terraform and will automatically sync all application pods from GitHub — no manual `kubectl apply` required.
4. **State Reconnection**: The new stateless pods automatically reconnect to the preserved RDS instance via injected AWS Secrets Manager credentials. Data durability depends on RDS backup retention settings and whether a manual snapshot was taken prior to the failure.

---

## 🗄️ RDS Database Recovery

### Automated Backups
AWS RDS handles automated backups with a configurable retention policy. A manual snapshot is strictly enforced before running risky Alembic schema migrations.

### Manual Database Export
```bash
# Extract a complete SQL dump of the production database
mkdir -p ~/db-backups
pg_dump -h <RDS_ENDPOINT> -p 5432 -U <DB_USERNAME> -d <DB_NAME> > ~/db-backups/assemblemonitor_$(date +%F_%H-%M).sql
```

### Database Restore
```bash
# Restore from a SQL dump
psql -h <RDS_ENDPOINT> -p 5432 -U <DB_USERNAME> -d <DB_NAME> < backup.sql
```
