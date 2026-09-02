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

Total cluster failure recovery uses complete Terraform codification:

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

Three controlled fault drills were executed on 2026-08-20 to validate probe separation and recovery behavior. Results, recovery durations, and individual postmortems are in [`RELIABILITY.md`](RELIABILITY.md) and [`incidents/`](incidents/).

---

## Escalation Matrix

If automated recovery (ArgoCD) and Level 1 remediation fails to restore service within 15 minutes, initiate the escalation protocol:

1. **L1 On-Call:** Cloud Operations Engineer (Acknowledge within 5 min).
2. **L2 Escalation:** Platform Engineering Lead (Engaged at T+15 min).
3. **L3 Escalation:** AWS Enterprise Support (Severity 1 Ticket via AWS Console).

---

## Stakeholder Communication Templates

*For use in the `#incident-response` Slack/Teams channel.*

**Incident Declaration:**
> **SEV-2 INCIDENT DECLARED**
> **Impact:** AssembleMonitor API is currently returning 5xx errors for core services.
> **Current Status:** Investigating telemetry. ArgoCD sync confirmed healthy. Investigating database connectivity.
> **Next Update:** 15 minutes.

**Incident Resolution:**
> **INCIDENT RESOLVED**
> **Impact:** API services fully restored.
> **Root Cause:** Database connection saturation; recovered via automated RDS failover.
> **Postmortem:** A postmortem document will be published within 48 hours.
