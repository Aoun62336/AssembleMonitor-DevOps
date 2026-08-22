# Incident Response & Disaster Recovery

> [!CAUTION]
> This document defines recovery procedures for critical incidents, including regional outages, data loss, or deployment failures. 
> Note: RTO/RPO figures are architectural design estimates derived from local testing and do not represent contractual Service Level Agreements (SLAs).

## Recovery Objectives (RTO / RPO)

| Subsystem | RTO Estimate | RPO Estimate | Methodology |
|---|---|---|---|
| **Infrastructure** | ~8–15 min | N/A | Full AWS EKS, ALB, WAF provisioning via Terraform |
| **Application** | ~3–10 min | N/A | ArgoCD synchronization from GitHub repository |
| **Database (RDS)** | ~15–30 min | up to 24 h | AWS RDS automated backups; manual pre-migration snapshots |
| **Object Storage (S3)** | Minutes | Per-version | AWS S3 Versioning |

---

## Application Rollback Procedures

### Kubernetes Rollback (GitOps / ArgoCD)

Application state is managed declaratively via GitOps, enabling auditable, version-controlled rollbacks without direct cluster access.

**Method 1: Git Revert (Primary)**
Reverting the target commit in the GitHub repository triggers automatic synchronization via ArgoCD.

```bash
git revert HEAD
git push origin main
```

**Method 2: ArgoCD UI (Fallback)**
If GitHub is inaccessible, rollbacks can be triggered directly via the ArgoCD control plane:
1. Access the ArgoCD Dashboard.
2. Select the `assemblemonitor-app` application.
3. Select **History and Rollback**.
4. Select the target stable deployment and click **Rollback**.

---

## Infrastructure Disaster Recovery

Total cluster failure recovery leverages complete Terraform codification:

1. **Re-Provision**: Execute `terraform apply` to provision a replacement EKS Cluster and Node Group. Terraform handles the installation of ArgoCD, External Secrets Operator, and Metrics Server.
2. **ALB Re-Attachment**: Terraform automatically binds the Load Balancer target groups to the new EKS instances.
3. **GitOps Sync**: ArgoCD automatically synchronizes application manifests from the GitHub repository.
4. **State Reconnection**: Stateless pods reconnect to the persistent RDS instance using credentials synchronized by the External Secrets Operator from AWS Secrets Manager.

---

## Database Recovery (RDS PostgreSQL)

### Automated Backups
AWS RDS is configured with automated daily backups. Manual snapshots are required prior to executing destructive Alembic schema migrations.

### Manual Database Export
```bash
mkdir -p ~/db-backups
pg_dump -h <RDS_ENDPOINT> -p 5432 -U <DB_USERNAME> -d <DB_NAME> > ~/db-backups/assemblemonitor_$(date +%F_%H-%M).sql
```

### Database Restore
```bash
psql -h <RDS_ENDPOINT> -p 5432 -U <DB_USERNAME> -d <DB_NAME> < backup.sql
```

---

## Validated Reliability Exercises

The following fault injection exercises were executed against the local Docker Compose environment on 2026-08-20 to validate failure detection and probe separation.

| Incident ID | Fault Injection | Telemetry / Outcome | MTTR | Postmortem |
|---|---|---|---|---|
| **INC-001** | PostgreSQL container termination | `/live` = 200, `/ready` = 503; auto-recovered | **2 min 9 sec** | [INC-001](incidents/INC-001-database-outage.md) |
| **INC-002** | FastAPI container termination | Nginx returned 502 immediately; auto-recovered | **2 min 35 sec** | [INC-002](incidents/INC-002-api-outage-nginx-502.md) |
| **INC-003** | DNS resolution failure (`DATABASE_URL`) | `/live` = 200, `/ready` = 503; recovered | **2 min 22 sec** | [INC-003](incidents/INC-003-database-dns-failure.md) |

> [!NOTE]
> MTTR metrics reflect local Docker Compose recovery times and do not represent production performance. Drill execution scripts are located in [`scripts/fault-drills/`](../../scripts/fault-drills/).
