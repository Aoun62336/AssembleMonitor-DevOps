# AssembleMonitor — Cloud-Native Construction Management Platform

<!-- Infrastructure & Cloud -->

[![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-%23326ce5.svg?style=for-the-badge&logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Terraform](https://img.shields.io/badge/Terraform-%235835CC.svg?style=for-the-badge&logo=terraform&logoColor=white)](https://www.terraform.io/)
[![Docker](https://img.shields.io/badge/Docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

<!-- CI/CD & DevSecOps -->

[![Jenkins](https://img.shields.io/badge/Jenkins-%232C5263.svg?style=for-the-badge&logo=jenkins&logoColor=white)](https://www.jenkins.io/)
[![ArgoCD](https://img.shields.io/badge/ArgoCD-%23EF7B4D.svg?style=for-the-badge&logo=argo&logoColor=white)](https://argo-cd.readthedocs.io/)
[![PR Validation](https://github.com/Aoun62336/AssembleMonitor-DevOps/actions/workflows/pr-validation.yml/badge.svg?branch=main)](https://github.com/Aoun62336/AssembleMonitor-DevOps/actions/workflows/pr-validation.yml)

<!-- Observability -->

[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-000000?style=for-the-badge&logo=opentelemetry&logoColor=white)](https://opentelemetry.io/)
[![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=for-the-badge&logo=prometheus&logoColor=white)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Grafana-%23F46800.svg?style=for-the-badge&logo=grafana&logoColor=white)](https://grafana.com/)

<!-- Application Stack -->

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)

---

AssembleMonitor is a cloud-native construction site management platform deployed on AWS Elastic Kubernetes Service (EKS). The architecture incorporates Terraform-provisioned infrastructure, a Jenkins-based GitOps CI/CD pipeline, External Secrets Operator for credential management, and an OpenTelemetry observability stack encompassing metrics, logs, and distributed traces. The platform demonstrates end-to-end infrastructure automation, security-by-design, and operational observability across the DevOps lifecycle.

The platform provisions distinct access across four Role-Based Access Control (RBAC) tiers and supports two independently documented deployment architectures: a **GitOps EKS pipeline** (Primary Production) and a **K3s Jenkins pipeline** (Staging/Lightweight).

---

## Architectural Highlights

| Category | Implementation Detail |
|---|---|
| **Infrastructure** | EKS v1.36 · 2-node cluster (`c7i-flex.large`) · HPA scaling (2→5 replicas) · AWS ALB with WAFv2 |
| **Security** | IMDSv2 enforcement · IAM Roles for Service Accounts (IRSA) across 6 workloads · External Secrets Operator (zero secrets in repository) · WAF rate-limiting (2000 req/IP/window) |
| **Observability** | End-to-end OpenTelemetry integration: Metrics → AMP, Logs → Loki, Traces → Tempo, unified within Grafana |
| **GitOps** | Jenkins → GitHub → ArgoCD → EKS · Imperative `kubectl` commands eliminated from CI · ArgoCD autonomous drift remediation |
| **DevSecOps** | SonarQube static analysis and Trivy CVE scanning enforced during build phase (shift-left security) |
| **FinOps** | Ephemeral cluster execution: Daily `terraform destroy` and `terraform apply` cycles limit compute expenditure (Restoration RTO: ~8–10 minutes) |
| **Reliability** | 23-test Pytest suite · GitHub Actions 5-job parallel CI (backend-test, frontend-build, terraform-validate, helm-validate, secret-scan) · PodDisruptionBudgets governing voluntary pod eviction · `terraform test` module validation · Declarative Grafana dashboards |

## Architecture Overview

![AssembleMonitor — High-Level Overview](docs/architecture/00-master-overview.png)

> The system architecture integrates a Jenkins GitOps CI/CD pipeline, an AWS WAF-protected ALB routing to Amazon EKS within private subnets, IRSA-secured workloads, External Secrets Operator synchronization from AWS Secrets Manager, and a comprehensive OpenTelemetry observability pipeline directing logs to Grafana Loki, traces to Grafana Tempo, and metrics to Amazon Managed Prometheus.

→ [View comprehensive architecture documentation](docs/architecture/ARCHITECTURE.md)

---

## Technology Stack

### Application Layer

| Component | Technology |
|---|---|
| **Frontend** | React 18 · Vite 5 · React Router v6 · HTML/CSS · Vanilla JS |
| **Backend** | Python FastAPI, SQLAlchemy (async engine), Alembic |
| **Database** | PostgreSQL 16 (Amazon RDS) |
| **Storage** | Amazon S3 (Versioned site artifact storage) |
| **Authentication** | JWT via python-jose and passlib/bcrypt (Access & Refresh tokens) |
| **Web Server** | Nginx (Frontend asset delivery within container runtime) |

### DevOps & Infrastructure Layer

| Category | Tool | Rationale |
|---|---|---|
| **Cloud Provider** | AWS | Utilization of managed services (WAF, Secrets Manager, RDS, EKS, AMP) |
| **IaC** | Terraform | Declarative, version-controlled infrastructure ensuring environmental reproducibility |
| **Containerization** | Docker | Consistent runtime environment across local execution and EKS |
| **Orchestration** | Amazon EKS | Managed control plane mitigating operational overhead; native integration with HPA, IRSA, and EBS CSI |
| **CI** | Jenkins (EC2 Hosted) | Private network isolation, direct SonarQube integration, stateful build history |
| **CD (GitOps)** | ArgoCD | Repository functions as single source of truth; eliminates Jenkins cluster-admin credentials; automatic drift remediation |
| **Manifests** | Helm | DRY templating mechanism for environment-parameterized Kubernetes resource definitions |
| **DevSecOps** | SonarQube & Trivy | Shift-Left enforcement of quality gates and CVE scanning prior to registry publication |
| **Config Management**| Ansible | Idempotent OS-level provisioning for Jenkins, K3s, and SonarQube EC2 instances |
| **Secret Management**| External Secrets Operator | Eliminates base64-encoded Kubernetes Secrets in source control via dynamic synchronization from AWS Secrets Manager |
| **Observability** | OTEL, AMP, Loki, Tempo, Grafana | Comprehensive telemetry pipeline with declarative dashboard provisioning |

---

## Functional Capabilities

The platform provisions specialized interfaces based on RBAC designations:

| Role | Operational Scope |
|---|---|
| **Admin** | System administration, user management, cross-project analytics |
| **Project Manager** | Project/phase planning, task allocation, budget oversight |
| **Site Engineer** | Labor attendance logging, task progression, material consumption tracking, artifact ingestion |
| **Client** | Read-only project visibility |

Artifacts (site photographs) are securely persisted in Amazon S3 utilizing IRSA Web Identity Tokens, eliminating embedded credentials within the application runtime.

---

## Deployment Architectures

The project supports two distinct, automated deployment pipelines, documented independently:

| Specification | Path 1 — EKS GitOps (Primary) | Path 2 — K3s Pipeline |
|---|---|---|
| **Orchestration** | Amazon EKS (Managed Control Plane) | K3s (Self-managed EC2) |
| **CD Mechanism** | ArgoCD (GitOps synchronization) | Jenkins (`kubectl apply`) |
| **Manifest Format** | Helm Chart (`k8s/helm-chart/`) | Kubernetes YAML (`k8s/*.yaml`) |
| **Secret Management**| External Secrets Operator → AWS Secrets Manager | Kubernetes `Secret` (Base64) |
| **Auto-Scaling** | HPA (Metrics Server, 2–5 replicas at 70% CPU) | Manual replica configuration |
| **Observability** | OTEL + AMP + Loki + Tempo + Grafana | Node Exporter + Prometheus |
| **Jenkins Pipeline** | `Jenkinsfile-gitops` | `Jenkinsfile-k3s` |
| **Target Environment**| Cloud-native, GitOps-based production | Staging, resource-constrained environments |

---

## Path 1 — EKS GitOps Pipeline (Primary)

The `Jenkinsfile-gitops` pipeline executes the following sequence:

```text
Source Commit → Trivy FS Scan → SonarQube SAST → Quality Gate
  → Docker Compilation → Trivy Image Scan → Docker Hub Push
  → [Manual Authorization Gate] → Helm Values Update (Git Push)
  → ArgoCD Autonomous Synchronization → EKS Rolling Deployment
```

→ [Detailed CI/CD Pipeline documentation](docs/ops/CI_CD_PIPELINE.md)

### EKS Infrastructure Provisioning

Infrastructure is provisioned declaratively via Terraform (`terraform/`):

| Component | Specifications |
|---|---|
| **EKS Cluster** | Kubernetes v1.36, configured with public and private endpoint access |
| **Node Group** | `c7i-flex.large`, On-Demand tier, Auto Scaling Group (2 Min / 3 Max) |
| **Networking** | Private subnets distributed across 2 Availability Zones (`172.31.96.0/24`, `172.31.97.0/24`) utilizing a NAT Gateway |
| **Load Balancer** | AWS ALB routing to EKS NodePort (30080) via ASG attachment |
| **WAF** | WAFv2 implementing Common Rules, Known Bad Inputs, and Rate-Limiting (2000 requests/IP/window) |
| **Database** | Amazon RDS PostgreSQL (`db.t4g.micro`), isolated within private subnets |
| **Storage** | Amazon S3 (Versioned artifact bucket and Observability backend for Loki/Tempo) |
| **Secret Management**| AWS Secrets Manager integrated with External Secrets Operator |
| **EKS Add-ons** | EBS CSI Driver, Metrics Server, External Secrets Operator deployed via `helm_release` |
| **ArgoCD** | Provisioned via Terraform `helm_release`, declarative configuration via `argocd-apps` |

### Security — IAM Roles for Service Accounts (IRSA)

Pod-level AWS API access is authenticated exclusively via IRSA. IMDSv2 is enforced on all nodes with `hop_limit=1`, preventing pods from querying EC2 instance metadata to assume the underlying node role. Six distinct IRSA roles apply the principle of least privilege across service accounts (Backend, ESO, OTEL Collector, Grafana, Loki/Tempo, EBS CSI).

→ [IRSA Configuration Details](docs/architecture/SECURITY.md)

### Kubernetes Workload Definitions

The umbrella Helm chart (`k8s/helm-chart/`) manages the `assemblemonitor` namespace, configuring the application logic (`values/app.yaml`) and the observability stack (`values/observability.yaml`), including Loki, Tempo, kube-state-metrics, the OpenTelemetry Collector DaemonSet, and Grafana.

**Application Layer Configuration** (`values/app.yaml`):

- **Backend Deployment**: FastAPI, ClusterIP Service (Port 8000), HPA scaling (2→5 replicas).
- **Frontend Deployment**: React/Nginx, NodePort Service (Port 30080), HPA scaling (2→5 replicas).
- **Secret Synchronization**: External Secrets Operator syncing from the `assemblemonitor-secrets` cluster entity.
- **Probe Configuration**: Delineated liveness (`/api/health/live`) and readiness (`/api/health/ready`) probes.

### Observability Pipeline Data Flow

The OpenTelemetry Collector DaemonSet aggregates telemetry signals:
- **Metrics** (cAdvisor + kube-state-metrics) → Amazon Managed Prometheus (AMP) → Grafana.
- **Logs** (filelog receiver tailing `/var/log/pods`) → Loki → Amazon S3 → Grafana.
- **Traces** (OTLP gRPC from FastAPI application) → Tempo → Amazon S3 → Grafana.
- External infrastructure nodes (Jenkins, K3s, SonarQube) are monitored via an independent `otel-external-scraper` deployment.

### EKS Deployment Execution

```bash
# 1. Provision Infrastructure
cd terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply

# 2. Authenticate Kubectl Context
aws eks update-kubeconfig --region us-east-1 --name <EKS_CLUSTER_NAME>

# 3. Validate Workload Initialization
kubectl get pods -n assemblemonitor

# 4. Retrieve Administrative Interface Endpoints
./get-urls.sh

# 5. Retrieve Application Ingress Endpoint
terraform output alb_url
```

> **Ephemeral Cluster Lifecycle:** The EKS cluster is decommissioned nightly for cost optimization. All system components are provisioned automatically during `terraform apply`. Imperative Kubernetes commands (`helm install`, `kubectl apply`) are not required during environment initialization.

---

## Path 2 — K3s Jenkins Pipeline

### Pipeline Overview

```text
Source Commit → Jenkins → SonarQube SAST → Trivy Scan → Docker Compilation
    → Docker Hub → [Manual Authorization Gate] → `kubectl apply` → K3s Rolling Deployment
```

The `Jenkinsfile-k3s` pipeline executes the CI/CD sequence against a K3s cluster operating on a standalone AWS EC2 instance.

### K3s Infrastructure Parameters

| Component | Specifications |
|---|---|
| **Kubernetes** | K3s distribution on a singular AWS EC2 instance |
| **Manifest Definitions** | Explicit Kubernetes YAML (`k8s/` directory) |
| **Secret Management** | Kubernetes `Secret` resources (Base64 encoded via `k8s/secret.yaml`) |
| **Service Exposure** | Frontend: NodePort `30080` — Backend: NodePort `30081` |
| **Telemetry** | Prometheus Node Exporter (systemd daemon via Ansible) |

### K3s Deployment Execution

**Automated CI/CD Initiation:**

1. Commit modifications to the `main` branch.
2. Trigger the `AssembleMonitor-Pipeline` job within the Jenkins interface.
3. Provide authorization at the manual deployment gate.

**Application Access:**

| Service | Endpoint |
|---|---|
| Frontend | `http://<K3S_PUBLIC_IP>:30080` |
| Backend API | `http://<K3S_PUBLIC_IP>:30081/api/health` |

> Note: Ensure the corresponding AWS Security Group permits ingress TCP traffic on ports 30080 and 30081.

---

## Local Development Execution

Local iterative development utilizes Docker Compose for full-stack emulation:

```bash
# Initialize application stack (Frontend, Backend, PostgreSQL, Adminer)
docker compose up --build -d

# Execute database schema migrations
docker compose exec api alembic upgrade head

# Bootstrap administrative credentials
docker compose exec api python seed_admin.py
```

| Service | Local Endpoint |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API (Swagger UI) | http://localhost:8000/api/docs |
| Database UI (Adminer) | http://localhost:8080 |

---

## System Verification Previews

The following artifacts document the operational status of the primary system components.

### CI/CD & DevSecOps Validation

**Jenkins GitOps Pipeline Execution**
![Jenkins GitOps Pipeline](docs/assets/screenshots/cicd-jenkins-pipeline-gitops.png)

**ArgoCD Application Synchronization State**
![ArgoCD Synced](docs/assets/screenshots/cicd-argocd-app-synced.png)

**SonarQube Static Analysis Quality Gate**
![SonarQube Quality Gate](docs/assets/screenshots/cicd-sonarqube-frontend-backend.png)

---

### Observability & Infrastructure Validation

**Grafana Kubernetes Cluster Overview (AMP Metrics)**
![Grafana K8s Dashboard](docs/assets/screenshots/obs-grafana-k8s-dashboard.png)

**Amazon EKS Resource Allocation State**
![EKS Cluster State](docs/assets/screenshots/infra-eks-nodes-pods-svc-hpa.png)

---

### Application Interface Validation

**AssembleMonitor Authentication Portal**
![Application Landing Page](docs/assets/screenshots/app-landing-page.png)

> Comprehensive architectural and operational artifacts are persisted within the [`docs/assets/screenshots/`](docs/assets/screenshots/) repository directory.

---

## Documentation Index

| Resource | Scope |
|---|---|
| [Architecture](docs/architecture/ARCHITECTURE.md) | Comprehensive architectural diagrams encompassing System Context, Network Topology, Security Boundaries, and Data Flow |
| [CI/CD Pipeline](docs/ops/CI_CD_PIPELINE.md) | Pipeline stage definitions and security integration points |
| [Infrastructure](docs/ops/INFRASTRUCTURE.md) | Terraform resource provisioning definitions |
| [Security](docs/architecture/SECURITY.md) | IRSA policies, WAF configuration, and network isolation protocols |
| [Operational Runbook](docs/ops/OPERATIONAL_RUNBOOK.md) | Standard Operating Procedures (SOPs) for provisioning and telemetry monitoring |
| [Incident Response](docs/ops/INCIDENT_RESPONSE.md) | RTO/RPO objectives, rollback procedures, and disaster recovery execution |
| [Performance Testing](performance-tests/README.md) | k6 load generation methodology and latency baselines |
| [FinOps](docs/ops/FINOPS_COST_MANAGEMENT.md) | Expenditure analysis and infrastructure optimization procedures |
| [Verification Playbook](docs/ops/VERIFICATION_PLAYBOOK.md) | Procedural execution commands for infrastructure hardening validation |

### Deployment Procedures

| Resource | Target Architecture |
|---|---|
| [01 — Local Environment](docs/deployments/01-LOCAL-DOCKER.md) | Localized Docker Compose emulation |
| [02 — K3s Cluster](docs/deployments/02-K3S-CLUSTER.md) | Lightweight EC2 Kubernetes orchestration |
| [03 — Amazon EKS (Primary)](docs/deployments/03-AWS-EKS-PROD.md) | Production-grade GitOps EKS architecture |

---

## Engineering Trade-Off Analysis

| Architectural Decision | Rationale & Trade-Off |
|---|---|
| **ALB NodePort vs. Ingress Controller** | Consolidates load balancer provisioning within Terraform state; leverages native AWS WAF integration; reduces in-cluster operational complexity. |
| **ArgoCD GitOps vs. Imperative CI Deployments** | Introduces ArgoCD controller compute overhead; eliminates Jenkins requirement for cluster-admin credentials; ensures deployment immutability and visualizes configuration drift. |
| **Amazon EKS vs. Self-Managed K3s** | Incurs managed control plane costs ($73/month); eliminates etcd maintenance overhead; provides native integration with AWS IAM (IRSA) and Horizontal Pod Autoscaler. |
| **External Secrets Operator vs. Native Secrets** | Introduces operational dependency on the ESO controller; completely eliminates base64 encoded secrets from source control; enables dynamic secret rotation without application redeployment. |
| **Self-Hosted Jenkins vs. SaaS CI (GitHub Actions)** | Imposes server maintenance overhead; provides secure, isolated network execution and facilitates direct SonarQube integration without public egress requirements. |

---

## Reliability & CI Hardening (August 2026)

The following reliability enhancements were implemented and validated via GitHub Actions CI.

| Milestone | Implementation Details | Validation Mechanism |
|---|---|---|
| **M1 — Probe Isolation** | Segregated `/api/health` into `/api/health/live` (process liveness) and `/api/health/ready` (database connectivity readiness). | `grep health/live backend/Dockerfile` |
| **M2 — Pytest Implementation** | Implemented 23 pytest scenarios validating authentication and probe endpoints, utilizing Python 3.12 mock shims for OTEL. | `cd backend && python -m pytest tests/ -v` |
| **M3 — GitHub Actions Pipeline** | Configured concurrent execution (4 jobs): Backend compilation, Frontend build, Terraform validation, Helm linting. | CI Pipeline Execution Log Validation |
| **M4 — Helm Dependency Locking** | Implemented `Chart.lock` to enforce exact version constraints for upstream dependencies (Loki, Tempo, Kube-State-Metrics, OTEL Collector). | `cat k8s/helm-chart/Chart.lock` |
| **M5 — PDB & Network Policies** | Configured `PodDisruptionBudget` (maxUnavailable: 1) for application workloads; structured `NetworkPolicy` templates for optional deployment isolation. | `helm template ... \| grep PodDisruptionBudget` |
| **M6 — Jenkinsfile Security** | Applied `options {}` enforcement (timeouts, concurrent build prevention), enabled `DOCKER_BUILDKIT=1`, and integrated unit test execution within container build context. | `grep "Backend Unit Tests" Jenkinsfile-gitops` |
| **M7 — Terraform Module Extraction** | Abstracted network topology into a reusable Terraform module; implemented 5 unit tests utilizing `terraform test` against a mocked provider state. | `grep "^run " terraform/modules/network/tests/network_unit.tftest.hcl` |
| **M8 — Declarative Grafana Dashboards** | Configured application telemetry dashboard (RPS, latency percentiles, resource utilization) as an immutable JSON artifact loaded via Helm ConfigMap. | JSON Parser Validation |

→ [Comprehensive Verification Procedures](docs/ops/VERIFICATION_PLAYBOOK.md)

---

## Operational Retrospective

- **Observability Stack Integration:** Establishing the OpenTelemetry pipeline across Tempo, Loki, and Amazon Managed Prometheus required extensive version alignment between the OTEL collector, Prometheus receivers, and backend APIs. Resolution necessitated precise configuration of the OTEL DaemonSet to ensure validated telemetry routing into the Grafana visualization layer.
- **GitOps and Ephemeral Infrastructure:** Managing the state transition from Terraform infrastructure provisioning to ArgoCD application synchronization validated the necessity of declarative infrastructure and immutable deployment patterns. The cluster is periodically torn down and reprovisioned to maintain IaC hygiene and control costs.
