# Operational Runbook

> [!NOTE]
> This runbook provides standard operating procedures (SOPs) for provisioning, accessing, and troubleshooting the AssembleMonitor cloud environments.

## 0. First-Response Troubleshooting

Symptom-driven decision matrices are fully documented in [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).

| Symptom | Probable Cause | Initial Diagnostic Action |
|---|---|---|
| `502 Bad Gateway` (Nginx / port 3000) | `api` container terminated or crashed | Execute `docker compose ps` → `docker compose start api` |
| `/api/health/ready` returns 503 | Database unreachable or invalid `DATABASE_URL` | Execute `docker compose ps db` → verify `DATABASE_URL` environment variable |
| `CrashLoopBackOff` (EKS) | Invalid configuration, missing secret, or OOM event | Execute `kubectl describe pod <pod> -n assemblemonitor` |
| ArgoCD synchronization failure | Jenkins failed to update Helm values repository | Review Jenkins console output → execute `kubectl get pods -n argocd` |
| Terraform apply failure | State file desynchronization or missing variable definitions | Execute `terraform plan` → verify `terraform.tfvars` |

## 1. Local Development Environment

The local Docker Compose stack provides a comprehensive environment for iteration without incurring cloud infrastructure costs.

```bash
# Provision local stack (FastAPI, React, PostgreSQL)
docker compose up -d

# Execute database schema migrations
docker compose exec api alembic upgrade head
```

**Local Endpoints:**
- Frontend: `http://localhost:3000`
- Backend Swagger Documentation: `http://localhost:8000/api/docs`

## 2. Production Environment (EKS & ALB)

The primary production environment is fully defined via Terraform and Kubernetes manifests.

### Environment Provisioning Procedure

To recover from a cluster teardown or disaster scenario, execute the following procedure:

1. **Provision Infrastructure**:
   ```bash
   cd terraform/
   terraform apply -auto-approve
   ```
2. **Await Node Readiness**: EKS managed Node Groups require approximately 3-5 minutes to initialize and join the cluster.
3. **Verify GitOps Controller (ArgoCD)**:
   ArgoCD is installed automatically via the Terraform `helm_release` provider. Verify pod status:
   ```bash
   kubectl get pods -n argocd
   ```
4. **Verify Ingress & GitOps Synchronization**: ArgoCD automatically detects the remote GitHub repository and synchronizes the Helm charts. The AWS Application Load Balancer automatically registers the new EKS NodePorts upon pod readiness.
5. **Access Application**: Navigate to `http://<ALB_DNS_NAME>`.

## 3. CI/CD Operations (Jenkins)

The continuous integration pipeline is managed by a dedicated Jenkins server (`assemblemonitor-jenkins`).

1. **Jenkins Access**: Navigate to `http://JENKINS_SERVER_PUBLIC_IP:8080`.
2. **Deployment Triggers**: Commits merged to the `main` branch automatically trigger the `assemblemonitor-cicd` pipeline. Manual rollbacks or re-deployments must be triggered via the Jenkins UI.

## 4. Staging Environment (Legacy K3s)

_(Optional Phase 2 Infrastructure)_

Procedure for interacting with the legacy K3s staging cluster:

1. Verify the K3s EC2 instance is running.
2. Establish SSH connection to the master node:
   ```bash
   ssh -i key.pem ubuntu@K3S_SERVER_EC2_PUBLIC_IP
   ```
3. Execute manual manifest deployment (if bypassing Jenkins automation):
   ```bash
   kubectl apply -f k8s/
   ```

## 5. CloudWatch Monitoring & Telemetry

Centralized logging and metrics aggregation via AWS CloudWatch provides observability across the Amazon EKS cluster and underlying infrastructure.

### Configured Alarms

The following alarms are provisioned via Terraform to provide anomaly detection:

| Alarm Identifier | Threshold Condition | Architectural Impact |
|---|---|---|
| **ALB Unhealthy Targets** | `UnHealthyHostCount > 0` | The ALB detects that EKS node proxy containers have failed their health checks. |
| **ALB Target 5xx Errors** | `HTTPCode_Target_5XX_Count > 5` | The backend application is returning HTTP 5xx errors to clients. _(Note: Missing data is treated as `notBreaching`)._ |
| **ASG EC2 CPU Utilization** | `CPUUtilization > 80%` | Monitors the legacy EC2 Auto Scaling Group (currently at 0 desired capacity). |
| **RDS CPU Utilization** | `CPUUtilization > 80%` | Database compute constraint, indicating potential slow queries or connection saturation. |
| **RDS Storage Depletion** | `FreeStorageSpace < 2 GB` | Critical database storage depletion. Immediate intervention required to prevent lockup. |

### Telemetry Validation Procedure

To validate monitoring dashboards and incident response workflows, alarms can be manually forced into an `ALARM` state using the AWS CLI:

```bash
# Force the Unhealthy Targets alarm into an ALARM state
aws cloudwatch set-alarm-state \
  --region us-east-1 \
  --alarm-name assemblemonitor-am-dev-alb-unhealthy-targets \
  --state-value ALARM \
  --state-reason "Manual validation of incident response workflows"
```
