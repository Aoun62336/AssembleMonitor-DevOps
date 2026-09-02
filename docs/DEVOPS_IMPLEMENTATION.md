# AssembleMonitor: DevOps Implementation and Troubleshooting

This document is the primary technical reference for this Cloud/DevOps implementation. It covers what was built, why each decision was made, what problems were encountered, and where to find the supporting evidence in the repository.

---

## 1. Project Context

**Application layer** (built during internship):
- Frontend: React 18 + Vite 5
- Backend: Python FastAPI + SQLAlchemy (async) + Alembic
- Database: PostgreSQL 16

**Cloud/DevOps layer** (independently implemented by Aoun):
- AWS infrastructure provisioned with Terraform
- Containerized with Docker, orchestrated on Amazon EKS
- CI/CD via Jenkins; GitOps delivery via Argo CD; pre-merge validation via GitHub Actions
- Secrets via IRSA + AWS Secrets Manager + External Secrets Operator
- Observability via OpenTelemetry → AMP / Loki / Tempo / Grafana
- Reliability validated through probe design, PDB/NetworkPolicy, and controlled fault drills

---

## 2. My Responsibilities

### AWS Infrastructure
Designed and provisioned the full AWS environment using Terraform. No manual console provisioning.

- **VPC / networking**: Used the default AWS VPC with two custom private subnets (`172.31.96.0/24`, `172.31.97.0/24`) across two AZs. Private subnets have no public IP auto-assignment; all node egress routes through a NAT Gateway.
- **EKS**: Managed Kubernetes control plane (v1.36). `c7i-flex.large` node group with Auto Scaling (2 min / 3 max). Public and private endpoint access.
- **ALB**: External traffic entry point. Terminates HTTP and routes to EKS NodePort 30080. WAFv2 attached.
- **WAF**: CommonRuleSet, KnownBadInputs managed rule groups. Rate-limit rule: 2000 requests per IP per 5-minute window.
- **RDS**: PostgreSQL `db.t4g.micro` in private subnets. Security group allows connections from EKS node SG only.
- **S3**: Two buckets: application artifact storage (site photos) and observability backend (Loki chunks, Tempo traces).
- **IAM + IRSA**: OIDC provider for EKS cluster. Six distinct IAM roles for service accounts: Backend, ESO, OTel Collector, Grafana, Loki/Tempo, EBS CSI.
- **Secrets Manager**: Stores `DATABASE_URL`, `JWT_SECRET_KEY`, and RDS master password.
- **CloudWatch**: ALB, RDS, and EKS alarms provisioned via Terraform.

Evidence: `terraform/*.tf`

### Terraform

Wrote the complete infrastructure definition. Extracted the private-networking layer into a reusable module (`terraform/modules/network/`) so the networking logic can be tested independently with `mock_provider` (no AWS credentials required). The module creates private subnets, NAT Gateway, EIP, route tables, and associations given an existing VPC.

Evidence: `terraform/modules/network/`

### Docker

Built multi-stage Dockerfiles for both backend and frontend. Backend uses a non-root user. Images are tagged with `${BUILD_NUMBER}` by Jenkins and pushed to Docker Hub.

Evidence: `backend/Dockerfile` · `frontend/Dockerfile`

### Jenkins CI/CD

Built the `Jenkinsfile-gitops` pipeline (primary EKS path) and `Jenkinsfile-k3s` (K3s staging path).

**GitOps pipeline stages:**
1. Checkout
2. Trivy filesystem scan (backend, then frontend)
3. SonarQube SAST (backend, then frontend) + quality gate enforcement
4. Backend build validation (dry-run compileall inside container)
5. Frontend build validation
6. Final Docker image builds (tagged `BUILD_NUMBER` and `latest`)
7. Trivy image scans (HIGH/CRITICAL, `--exit-code 1`)
8. Docker Hub push
9. Manual approval gate (10-minute timeout)
10. GitOps update: `sed` patches the image tag in `k8s/helm-chart/values/app.yaml`, commits, and pushes to GitHub; this is what triggers Argo CD

Evidence: `Jenkinsfile-gitops`

### GitHub Actions

Five parallel pre-merge validation jobs on every pull request targeting `main`:

| Job | What it checks |
|---|---|
| `backend-test` | Python compileall + pytest suite (23 tests, no real database) |
| `frontend-build` | `npm ci` + Vite production build |
| `terraform-validate` | `fmt -check` + `init` + `validate` + `terraform test` on network module |
| `helm-validate` | Dependency build + `helm lint` + template render |
| `secret-scan` | Gitleaks v3 full-history scan (SHA-pinned) |

All five are enforced as required status checks by the `main-protection` branch ruleset.

Evidence: `.github/workflows/pr-validation.yml`

### Argo CD

Provisioned via Terraform `helm_release`. Configured via `k8s/argocd-application.yaml`, which points Argo CD at the `k8s/helm-chart/` path in the GitHub repository.

When Jenkins commits a new image tag, Argo CD detects the change and reconciles the EKS cluster to the new desired state. Jenkins never talks to the Kubernetes API directly in the primary path: the cluster's state is always determined by Git.

Evidence: `k8s/argocd-application.yaml` · `terraform/argocd.tf`

### Kubernetes

The umbrella Helm chart at `k8s/helm-chart/` manages the `assemblemonitor` namespace.

| Control | Configuration | Why |
|---|---|---|
| **Deployments** | Separate backend and frontend | Independent scaling and rollout |
| **Services** | Backend: ClusterIP · Frontend: NodePort 30080 | Backend is internal only; NodePort feeds the ALB |
| **HPA** | CPU-based, 2→5 replicas for both | Handle traffic spikes without manual intervention |
| **Probes** | Liveness = `/api/health/live` · Readiness = `/api/health/ready` | Process health separated from dependency health |
| **Resource limits** | Requests and limits defined for both containers | Predictable scheduler behavior, no noisy-neighbor CPU starvation |
| **Security context** | Non-root · no privilege escalation · dropped capabilities | Reduce container attack surface |
| **PDB** | `maxUnavailable: 1` | Prevents rolling updates or node drains from removing all replicas simultaneously |
| **NetworkPolicy** | Restricts backend ingress to frontend and OTel pods only | Lateral movement requires an explicit allow rule |
| **Topology spread** | Configured to distribute replicas across AZs where scheduling allows | Reduce blast radius of a single AZ failure |

Evidence: `k8s/helm-chart/templates/`

### Secrets / IAM

Secret delivery chain:
```
EKS OIDC Provider
      ↓
IAM Role (OIDC trust policy)
      ↓
IRSA (Kubernetes ServiceAccount annotation → temporary credentials)
      ↓
External Secrets Operator
      ↓
AWS Secrets Manager
      ↓
Kubernetes Secret (created/rotated by ESO)
      ↓
Backend Pod environment variables
```

No long-lived AWS credentials exist inside any pod. The ESO ServiceAccount is annotated with the ESO IAM role ARN; AWS STS issues temporary credentials via the OIDC token. The backend uses the same mechanism to access S3 directly.

Evidence: `terraform/iam.tf` · `terraform/secrets.tf` · `k8s/helm-chart/templates/serviceaccount.yaml` · `k8s/helm-chart/templates/external-secret.yaml`

### Observability

```
FastAPI (OTLP gRPC, port 4317)
        ↓
OTel Collector DaemonSet
  ├── Metrics (cAdvisor + kube-state-metrics)  →  AMP  →  Grafana
  ├── Logs (filelog receiver, /var/log/pods)   →  Loki  →  S3  →  Grafana
  └── Traces (OTLP from FastAPI)               →  Tempo  →  S3  →  Grafana
```

External EC2 nodes (Jenkins, SonarQube) are scraped by a separate `otel-external-scraper` deployment. Grafana dashboards are provisioned as version-controlled JSON loaded by a Helm ConfigMap.

Evidence: `docker/otel-collector-config.yaml` · `k8s/helm-chart/` · `k8s/helm-chart/dashboards/`

### Reliability

Implemented separated liveness and readiness probes, PDB, NetworkPolicy, and executed three controlled fault drills to validate the probe behavior end-to-end. See [Problems I Encountered](#4-problems-i-encountered) for the probe design rationale.

Evidence: `backend/app/routers/health.py` · `scripts/fault-drills/` · `docs/ops/incidents/`

---

## 3. Architecture

→ [Architecture diagrams and full system documentation](architecture/ARCHITECTURE.md)

The following design characteristics shape every implementation decision in the Cloud/DevOps layer:

- Application workloads run in private subnets with no direct public ingress
- All external traffic enters through a Terraform-managed ALB with WAFv2 attached
- Kubernetes cluster state is defined exclusively by Git; Argo CD detects drift and reconciles
- All pod-to-AWS API communication uses temporary IRSA credentials; no static keys

---

## 4. Problems I Encountered

### Problem 1 — Jenkins K3s deployment: SSH target over private IP

**Context:** The `Jenkinsfile-k3s` pipeline deploys to a K3s cluster running on an EC2 instance inside the same VPC as Jenkins. The deployment mechanism is SSH + `kubectl apply`.

**Problem:** The pipeline needed a reliable way to reach the K3s instance. Using the public IP is unreliable (it changes on instance restart) and unnecessary since Jenkins is already in the same VPC.

**Investigation:** Checked how the K3s instance is identified and whether Jenkins has VPC-internal access.

**Resolution:** Implemented a `Find K3s EC2` pipeline stage that queries `aws ec2 describe-instances` with a Name tag filter and state filter (`running`), extracts the `PrivateIpAddress`, and writes it to `k3s_private_ip.txt`. All subsequent SSH stages read from that file. The pipeline fails explicitly if the instance is not found or not running.

```bash
K3S_PRIVATE_IP=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${K3S_INSTANCE_NAME}" \
            "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].PrivateIpAddress" \
  --output text)
```

**Evidence:** `Jenkinsfile-k3s` — stages `Find K3s EC2` through `Post-Deploy Verification`

---

### Problem 2 — OpenTelemetry collector configuration

**Context:** Local Docker Compose OTel integration to validate FastAPI trace ingestion before EKS deployment.

**Problem:** The observability stack required configuration corrections — the collector container path and Prometheus environment syntax needed to be aligned before telemetry routing worked.

**Investigation:** Inspected the collector container configuration and watched runtime output.

**Resolution:** Corrected the collector container path and Prometheus-related environment syntax. Confirmed traces appearing in collector output:

```
assemblymonitor_otel_collector | TracesExporter {"resource spans": 1, "spans": 3}
assemblymonitor_otel_collector | GET /api/health/live  http.status_code=200
```

**Evidence:** `docker/otel-collector-config.yaml` · `k8s/helm-chart/` · observability screenshots

---

### Problem 3 — Argo CD perpetual diff on ExternalSecret

**Context:** After deploying the ExternalSecret resource through Argo CD, the application showed a persistent out-of-sync state.

**Problem:** The ESO controller was adding default field values to the live ExternalSecret resource that were not present in the Git-defined manifest. Argo CD compared the live resource against the Git source and reported a continuous diff.

**Investigation:** Compared the Argo CD diff output against the rendered Helm template and the live resource representation via `kubectl get externalsecret -o yaml`.

**Resolution:** Explicitly declared the defaulted ExternalSecret fields in the Helm template so the Git resource matched what the controller produces. The diff resolved and Argo CD reached `Synced` status.

**Evidence:** `k8s/helm-chart/templates/external-secret.yaml`

---

### Problem 4 — Health probe architecture: liveness must not check the database

**Context:** Designing the health endpoint architecture for Kubernetes probe configuration.

**Problem:** The initial design used a single `/health` endpoint. Kubernetes was configured to use it for both liveness and readiness. This created a failure mode: if the database went down temporarily, the readiness check would fail correctly, but eventually the liveness check would also fail, causing Kubernetes to restart the FastAPI process, even though the process itself was healthy.

**Why this matters:** Restarting a healthy process does not restore a failed database. It adds unnecessary churn, can cause a restart loop, and slows recovery time once the database comes back.

**Resolution:** Separated into three endpoints:

| Endpoint | Dependency | Kubernetes behavior |
|---|---|---|
| `/api/health` | Process + database | Legacy; not used for probes |
| `/api/health/live` | Process only | Liveness: restart container if this fails |
| `/api/health/ready` | Database (`SELECT 1`, 3s timeout) | Readiness: remove pod from endpoints if 503; restore automatically when 200 |

With this design: database outage → `/ready` returns 503 → pod removed from traffic → process stays alive → database recovers → `/ready` returns 200 → pod re-added to traffic. No restart occurs.

**Evidence:** `backend/app/routers/health.py` · `backend/tests/test_health.py` · `k8s/helm-chart/templates/backend-deployment.yaml`

---

## 5. Controlled Reliability Drills

> These are controlled local Docker Compose exercises executed to validate probe behavior and recovery mechanisms. They are not production incidents.

| ID | Fault injected | What was verified | Recovery duration |
|---|---|---|---|
| **INC-001** | PostgreSQL container stopped | `/live` = 200, `/ready` = 503 during outage; `/ready` recovers after restart | 2 min 9 sec |
| **INC-002** | FastAPI container stopped | Nginx returns 502; direct API unavailable | 2 min 35 sec |
| **INC-003** | Invalid `DATABASE_URL` hostname | `/live` = 200, `/ready` = 503 (DNS failure); recovers after config restore + container recreate | 2 min 22 sec |

Drill scripts: `scripts/fault-drills/` · Postmortems: `docs/ops/incidents/`

---

## 6. Troubleshooting Method

Symptom-driven diagnostic procedures are organized by symptom type in [`ops/TROUBLESHOOTING.md`](ops/TROUBLESHOOTING.md): Nginx 502, readiness probe 503, and Kubernetes CrashLoopBackOff. Each section includes diagnostic commands, expected outputs, and recovery steps.

---

## 7. Evidence Map

| Component | Location |
|---|---|
| AWS infrastructure | `terraform/` |
| Reusable Terraform network module | `terraform/modules/network/` |
| Terraform module tests | `terraform/modules/network/tests/` |
| Jenkins CI/CD — EKS GitOps path | `Jenkinsfile-gitops` |
| Jenkins CI/CD — K3s staging path | `Jenkinsfile-k3s` |
| GitHub Actions pre-merge validation | `.github/workflows/pr-validation.yml` |
| Kubernetes Helm templates | `k8s/helm-chart/templates/` |
| Environment values | `k8s/helm-chart/values/` |
| Argo CD application configuration | `k8s/argocd-application.yaml` · `terraform/argocd.tf` |
| ExternalSecret resource | `k8s/helm-chart/templates/external-secret.yaml` |
| Workload IAM roles / IRSA | `terraform/iam.tf` · `k8s/helm-chart/templates/serviceaccount.yaml` |
| Docker image definitions | `backend/Dockerfile` · `frontend/Dockerfile` |
| OTel Collector configuration | `docker/otel-collector-config.yaml` · Helm OTel templates |
| Grafana dashboards | `k8s/helm-chart/dashboards/` |
| Reliability drill scripts | `scripts/fault-drills/` |
| Incident postmortems | `docs/ops/incidents/` |
| Troubleshooting runbook | `docs/ops/TROUBLESHOOTING.md` |
| Deployment procedures | `docs/deployments/` |

---

## 8. Engineering Decisions

Each entry below states the trade-off that drove a specific design choice. The rationale is grounded in what was actually implemented, not general best-practice advice.

### Why Terraform over manual provisioning

Every AWS resource is defined in code and version-controlled. Reprovisioning the full environment (EKS cluster, networking, RDS, ALB, WAF, IAM, observability stack) requires a single `terraform apply`. Manual provisioning creates configuration drift; there is no audit trail and no reliable way to recreate the environment identically.

### Why private subnets for EKS nodes and RDS

EKS worker nodes and RDS should not be directly reachable from the public internet. Private subnets with no public IP auto-assignment ensure that even a misconfigured security group does not expose them; inbound access requires going through the ALB (application traffic) or a VPC-internal path (administrative). This is a defense-in-depth boundary enforced at the network layer, independent of security group rules.

### Why ALB in front of EKS rather than exposing pods directly

The ALB is Terraform-managed, which means WAF attachment, certificate management, and health check configuration are all in version control. Using a Kubernetes Ingress controller would move that provisioning inside the cluster, adding controller operational overhead and making WAF integration more complex. The trade-off is that the ALB uses NodePort (30080), which is a documented architectural choice in `docs/architecture/ARCHITECTURE.md`.

### Why Argo CD for CD rather than having Jenkins deploy directly

If Jenkins applied Kubernetes manifests directly, it would require cluster-admin credentials stored in the Jenkins credential store, a significant security exposure. With Argo CD, Jenkins never communicates with the Kubernetes API at all; it only commits an updated image tag to Git. The cluster's desired state is always a Git commit, not a pipeline execution. As a consequence, any out-of-band manual change to the cluster is automatically detected and reconciled back to the Git-defined state.

### Why IRSA instead of IAM users or instance-level roles

IAM users have long-lived access keys that must be rotated manually and stored as secrets. Instance-level roles give every pod on a node the same permissions, which violates least privilege. IRSA scopes a temporary, automatically-rotating credential to a specific Kubernetes ServiceAccount, meaning each workload has exactly the permissions it needs and nothing more. The IMDSv2 hop-limit setting (`http_put_response_hop_limit = 1`) closes the escape hatch where a pod could query the instance metadata to assume the node role instead.

### Why External Secrets Operator instead of committing Kubernetes Secrets

A Kubernetes Secret is base64-encoded, not encrypted. Committing it to Git exposes credentials in plain text to anyone with repository access, now and in the perpetual git history. ESO fetches the secret value from AWS Secrets Manager at runtime, creates the Kubernetes Secret in the cluster, and rotates it without requiring a redeployment. The Git repository contains only the ESO configuration, not the credential values.

### Why separate liveness and readiness probes

A single health endpoint cannot distinguish between two different failure modes. If the database becomes temporarily unreachable, the application process is still alive and will recover when the database comes back; restarting the container solves nothing and adds churn. The separated design means Kubernetes removes the pod from traffic routing (readiness failure) without restarting the process (liveness remains 200). Recovery is automatic once the dependency is restored.

### Why the Terraform network module was extracted

Networking code inline in the root module cannot be tested without provisioning real AWS resources. Extracting it into a module with a defined input/output contract allows the configuration logic to be verified with `mock_provider` (no credentials, no cost, no infrastructure created). The five `terraform test` cases cover CIDR assignment, public-IP enforcement on private subnets, NAT Gateway placement, default route configuration, and input validation. They run in CI on every pull request.

### Why GitHub Actions and Jenkins exist as separate systems

GitHub Actions provides repository-native validation on every pull request: syntax, tests, Helm lint, Terraform validation, secret scanning. These run without any persistent infrastructure. Jenkins handles the release path: SonarQube SAST, Trivy image scanning, Docker registry publishing, the manual approval gate, and the GitOps commit. The separation means pre-merge feedback is fast and stateless, while the release pipeline has the depth, history, and control that Jenkins provides.
