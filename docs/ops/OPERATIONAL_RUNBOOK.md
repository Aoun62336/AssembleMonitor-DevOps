# 📘 AssembleMonitor Operational Runbook

> [!NOTE]
> This runbook is the definitive guide for engineers interacting with the AssembleMonitor environments, bridging local development and production cloud incident response.

## 🎯 Scope

This runbook provides standard operating procedures (SOPs) for provisioning, accessing, and troubleshooting the AssembleMonitor cloud environments.

## 💻 1. Local Development Environment

For rapid iteration without incurring cloud costs, engineers should utilize the local Docker Compose stack.

```bash
# Provision local stack (FastAPI, React, Postgres)
docker compose up -d

# Run database migrations
docker compose exec api alembic upgrade head
```

**Local Endpoints:**

- Frontend: `http://localhost:3000`
- Backend Swagger Docs: `http://localhost:8000/api/docs`

## ☁️ 2. Production Environment (EKS & ALB)

The primary production environment is fully codified in Terraform and Kubernetes manifests.

### Environment Provisioning

If the cluster was torn down for cost savings or disaster recovery, follow these steps to achieve full operational status:

1. **Provision Infrastructure**:
   ```bash
   cd terraform/
   terraform apply -auto-approve
   ```
2. **Wait for Node Readiness**: The EKS managed Node Groups take approximately 3-5 minutes to join the cluster.
3. **Verify GitOps Controller (ArgoCD)**:
   ArgoCD is installed automatically by Terraform (`helm_release "argocd"` in `terraform/argocd.tf`). Verify it is running:
   ```bash
   kubectl get pods -n argocd
   ```
4. **Verify Ingress & GitOps Sync**: ArgoCD will automatically detect the GitHub repository and synchronize the Helm charts into the cluster. The AWS Application Load Balancer will automatically detect the new EKS NodePorts once the pods are healthy.
5. **Access Application**: `http://<ALB_DNS_NAME>`

## 🚀 3. CI/CD Operations (Jenkins)

The CI/CD pipeline is handled by a dedicated Jenkins server (`assemblemonitor-jenkins`).

1. **Accessing Jenkins**: Open `http://JENKINS_SERVER_PUBLIC_IP:8080`.
2. **Triggering Deployments**: Commits to the `main` branch automatically trigger the `assemblemonitor-cicd` pipeline. If a manual rollback or re-deploy is required, trigger the pipeline manually from the Jenkins UI.

## 🧪 4. Staging Environment (Legacy K3s)

_(Optional Phase 2 Infrastructure)_

If testing against the staging K3s cluster:

1. Ensure the K3s EC2 instance is running.
2. SSH into the master node:
   ```bash
   ssh -i key.pem ubuntu@K3S_SERVER_EC2_PUBLIC_IP
   ```
3. Deploy manifests manually (if bypassing Jenkins):
   ```bash
   kubectl apply -f k8s/
   ```

## 📊 5. CloudWatch Monitoring & Telemetry

Centralized logging and metrics aggregation through AWS CloudWatch is critical for maintaining observability across the highly available Amazon EKS cluster and its underlying infrastructure.

### Configured Alarms

The following alarms are actively provisioned via Terraform to provide immediate anomaly detection:

| Alarm Identifier             | Threshold Condition             | Architectural Impact                                                                                                                                                                   |
| ---------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ALB Unhealthy Targets**    | `UnHealthyHostCount > 0`        | The ALB detects that EKS node proxy containers have failed their health checks.                                                                                                        |
| **ALB Target 5xx Errors**    | `HTTPCode_Target_5XX_Count > 5` | The backend application is crashing and returning HTTP 5xx errors to users. _(Note: Missing data is treated as `notBreaching` to prevent false positives during low-traffic periods)._ |
| **ASG EC2 CPU Utilization**  | `CPUUtilization > 80%`          | Monitors the EC2 Auto Scaling Group (legacy path). Currently at 0 desired capacity; alert remains in place for when the ASG path is activated.                                        |
| **RDS CPU Utilization**      | `CPUUtilization > 80%`          | Database compute is constrained, potentially indicating slow queries or high connection counts.                                                                                        |
| **RDS Storage Depletion**    | `FreeStorageSpace < 2 GB`       | Database storage is critically low. Immediate intervention is required to prevent database lockup.                                                                                     |

### Telemetry Validation (Testing Alarms)

To validate monitoring dashboards and test potential incident response workflows, alarms can be manually triggered into an `ALARM` state using the AWS CLI:

```bash
# Trigger the Unhealthy Targets alarm
aws cloudwatch set-alarm-state \
  --region us-east-1 \
  --alarm-name assemblemonitor-advance-dev-alb-unhealthy-targets \
  --state-value ALARM \
  --state-reason "Manual validation of incident response workflows"
```
