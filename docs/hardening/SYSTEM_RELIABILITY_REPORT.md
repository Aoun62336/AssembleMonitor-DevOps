# AssembleMonitor — System Reliability & CI Hardening Report

**Execution Period:** 2026-08-20 — 2026-08-22
**Branch Reference:** `hardening/reliability-ci`
**Primary Engineer:** Aoun
**Status:** In Progress — Branch pending final review and integration to `main`
**Evidence Index:** Telemetry artifacts, execution SHAs, and architectural validations attached.

---

## Executive Summary

This hardening phase addressed five distinct capability dimensions to elevate the operational maturity of the AssembleMonitor platform:

| Capability Dimension | Delivered Implementation | Operational Outcome |
|---|---|---|
| **Reliability Engineering** | Health probe segregation, PodDisruptionBudgets, NetworkPolicies, and structured fault injection (3 drills). | Failure manifestations are deterministic; three controlled local fault drills recorded recovery durations between 2 min 9 sec and 2 min 35 sec. |
| **CI/CD Pipeline** | 5-stage parallel GitHub Actions pipeline; five-job GitHub Actions validation workflow; final main branch ruleset pending verification. | Mandatory static validation enforced prior to code integration. |
| **Supply Chain Security** | Gitleaks Action v3 (immutable SHA-pinned reference), detect-secrets baselining, Dependabot automation, and pre-commit hooks. | Multilayered credential detection: local environment, ingress integration, and repository history. |
| **Infrastructure as Code** | Selected private-network infrastructure modularization within an existing VPC, coupled with 5 native unit tests (`mock_provider`). | IaC logic is unit-testable within CI boundaries without necessitating AWS credential exposure. |
| **Observability** | Declarative Grafana dashboards (Dashboard-as-Code); localized OpenTelemetry Collector integration. | Telemetry visualizations are version-controlled; distributed traces are available in local development. |

---

## Hardening Exercise Measurements

The following measurements were captured during the controlled August 2026 hardening exercises. They are project-validation measurements and are not presented as production DORA metrics.

| Measurement | Observed Value | Evidence |
|---|---:|---|
| Database-outage recovery duration | **2 min 9 sec** | INC-001 |
| API-outage recovery duration | **2 min 35 sec** | INC-002 |
| Database DNS/configuration recovery duration | **2 min 22 sec** | INC-003 |
| Average controlled drill recovery duration | **2 min 22 sec** | INC-001–003 |
| Backend automated tests | **23 passed** | Pytest / GitHub Actions |
| Terraform network-module tests | **5 passed, 0 failed** | `terraform test` |

### Controlled Recovery-Time Distribution

| Incident ID | Fault Injection Vector | Recovery Duration | Recovery Mechanism |
|---|---|---|---|
| INC-001 | PostgreSQL container termination | **2 min 9 sec** | Container restart (`docker compose start db`) |
| INC-002 | API container termination | **2 min 35 sec** | Container restart (`docker compose start api`) |
| INC-003 | Invalid `DATABASE_URL` (DNS resolution failure) | **2 min 22 sec** | Configuration correction and container recreation |
| **Aggregate** | — | **2 min 22 sec** | — |

---

## Technical Milestones

| Reference | Objective | Execution SHA | Verification Status |
|---|---|---|---|
| M1 | Segregation of liveness and readiness health probes | `2744459` | Verified |
| M2 | Pytest execution suite (23 automated backend tests) | `7321ed6` | Verified |
| M3 | GitHub Actions CI pipeline (5 parallel jobs) | `de3856b`, `7dc321a` | Verified |
| M4 | Helm dependency version locking (`Chart.lock`) | `5d2246f` | Verified |
| M5 | PodDisruptionBudget and NetworkPolicy templating | `6f6c44d` | Verified |
| M6 | Terraform network modularization and unit testing | `97e3071` | Verified |
| M7 | Grafana application overview (Dashboard-as-Code) | `5b6eb25` | Verified |
| M8 | Documentation standardization and playbook creation | `265907a` | Verified |
| M9 | k3d runtime validation of NetworkPolicy and PDB | `b2700ee`, `c768bb7` | Verified |
| M10 | Supply chain security enforcement (Dependabot, Gitleaks, hooks) | `32984f5` | Verified |
| M11 | Developer `Makefile` automation | `a5a4d86` | Verified |
| M12 | Fault drill execution and postmortem analysis | `6fdd3f0` | Verified |
| M13 | Localized OpenTelemetry Collector integration | `a068a79` | Verified |
| M14 | Operational runbook standardization | Current branch | Verified |
| M15 | Documentation refactoring to enterprise standards | Current branch | Verified |
| M16 | Enforcement of `main-protection` branch ruleset (5 required checks) | Pending | Pending |

---

## Architectural Modifications

### Health Probe Segregation (M1)

**Legacy Architecture:** A singular `/health` endpoint facilitated both liveness and readiness validations.
**Hardened Architecture:** Three independent probes established to delineate operational concerns:

| Endpoint | Function | Kubernetes Orchestration Impact |
|---|---|---|
| `GET /api/health` | Aggregated diagnostic (Process + Database) | Generic system monitoring |
| `GET /api/health/live` | Process execution validation | Liveness probe — triggers container termination/restart upon failure |
| `GET /api/health/ready` | Downstream dependency validation | Readiness probe — isolates pod from ingress traffic without triggering restarts |

**Architectural Rationale:** The legacy shared health endpoint could not distinguish application-process health from database-dependent service readiness. The hardened design separates process liveness from dependency-aware readiness so a database outage can remove a pod from Ready service endpoints without requiring the application process to be considered unhealthy.

**Empirical Validation (INC-001):** Following database termination:
- `/live` returned `200 OK` (uvicorn process persists).
- `/ready` returned `503 Service Unavailable`.
- Following database restoration, `/ready` autonomously recovered to `200 OK` in **2 min 9 sec**.

---

## Continuous Integration Pipeline

### GitHub Actions Integration (M3, M10)

Five jobs execute in parallel upon branch pushes and pull requests targeting the `main` branch:

```text
PR Integration Trigger
  ├── backend-test        — Pytest execution (23 automated backend tests using mocked SQLAlchemy AsyncSession dependencies)
  ├── frontend-build      — Dependency resolution and Vite compilation
  ├── terraform-validate  — formatting validation, initialization, schema validation, and unit tests
  ├── helm-validate       — Dependency resolution, linting, and dry-run template rendering
  └── secret-scan         — Gitleaks historical credential detection
```

**Merge Prerequisites (M16):** `backend-test`, `frontend-build`, `terraform-validate`, `helm-validate`, and `secret-scan` are mandatory status checks pending configuration of the main branch ruleset.

---

## Kubernetes Resilience Hardening

### PodDisruptionBudget (M5)

Implemented via `k8s/helm-chart/templates/pdb.yaml`.
Ensures a minimum threshold of application replicas remain available during voluntary disruptions such as administrative node drains. Deployment rolling-update behavior remains governed by the Deployment strategy.

```yaml
maxUnavailable: 1   # Voluntary disruptions through the Kubernetes Eviction API may make at most one selected replica unavailable at a time.
```

Governed by `pdb.enabled` and `hpa.enabled` feature toggles within `values/app.yaml`. Requires Kubernetes API version `policy/v1`.

**Validation (M9):** Runtime validation targeted a k3d agent node hosting PDB-selected application test pods. kubectl drain exercised the Kubernetes Eviction API, while the PDB and replacement pod state were observed before and after the drain.

### NetworkPolicy (M5)

Implemented via `k8s/helm-chart/templates/networkpolicy.yaml`.
Applies ingress/egress isolation to the selected frontend and backend workloads and permits only the explicitly defined traffic paths.

A namespace-wide default deny would require an empty `podSelector: {}` selecting every pod. These policies specifically select frontend/backend pods.

| Path | Configuration | Validation |
|---|---|---|
| Frontend → Backend TCP/8000 | Allowed | Runtime-tested in k3d |
| Untrusted Pod → Backend TCP/8000 | Not allowed | Runtime-tested blocked in k3d |
| Backend → PostgreSQL TCP/5432 | Configured allowance | Helm/code validated |
| Backend → OTLP TCP/4317 | Configured allowance | Helm/code validated |
| Backend → HTTPS TCP/443 | Configured allowance | Helm/code validated |

**Validation (M9):** Verified HTTP 200 responses from allowed frontend pods and connection timeouts from isolated untrusted pods.

---

## Supply Chain Security Posture (M10)

| Security Control | Implementation Artifact | Trigger Mechanism |
|---|---|---|
| Dependency Updates | `.github/dependabot.yml` | Weekly execution |
| Credential Scanning | `gitleaks/gitleaks-action@v3` (immutable SHA-pinned reference) | Pull Request creation |
| Pre-Commit Enforcement | `.pre-commit-config.yaml` (9 hooks) | Local `git commit` execution |
| Secrets Baselining | `.secrets.baseline` | Pre-commit evaluation |
| PR Quality Gate | `.github/pull_request_template.md` | Pull Request creation |

---

## Infrastructure as Code Evolution (M6)

Refactored the private-networking layer into a reusable Terraform module that operates within an existing VPC (`terraform/modules/network/`).

- Creates private subnets, NAT egress, private routing, and route-table associations within a caller-provided VPC.
- Validated via `terraform test` leveraging `mock_provider` (bypassing AWS credential requirements).
- Validation Artifact: `terraform/modules/network/tests/network_unit.tftest.hcl`.

```text
$ terraform -chdir=terraform/modules/network test
  run "creates_correct_number_of_subnets"... pass
  run "private_subnets_disable_public_ip"... pass
  run "nat_gateway_placed_in_correct_subnet"... pass
  run "route_table_has_default_nat_route"... pass
  run "rejects_empty_subnet_map"... pass
Success! 5 passed, 0 failed.
```

---

## Observability Advancements (M7, M13)

### Declarative Dashboards (M7)

- Definition: `k8s/helm-chart/dashboards/application-overview.json`.
- Provisioned dynamically via Helm ConfigMap and ingested by the Grafana sidecar.
- The dashboard defines request-rate, error-rate, latency, Kubernetes CPU/memory, and workload-readiness panels. Kubernetes resource panels align with the existing cluster metrics pipeline; application request panels depend on Prometheus-compatible FastAPI metrics being scraped into the configured Prometheus data source.

### Local Telemetry Ingestion (M13)

Integrated OpenTelemetry Collector into local `docker-compose.yml` for trace validation:
- Architecture: `otlp` receiver → `batch` processor → `debug` exporter.

```text
assemblymonitor_otel_collector | TracesExporter {"resource spans": 1, "spans": 3}
assemblymonitor_otel_collector | GET /api/health/live  http.status_code=200
```

---

## Incident Response Drills (M12)

Three localized fault injections executed to validate probe configuration and resilience mechanisms.

| Identifier | Fault Scenario | Telemetry Observation | Postmortem Artifact |
|---|---|---|---|
| INC-001 | Database termination | `/live`=200, `/ready`=503 | `INC-001-database-outage.md` |
| INC-002 | API termination | Nginx HTTP 502 | `INC-002-api-outage-nginx-502.md` |
| INC-003 | Invalid DB Hostname | `/live`=200, `/ready`=503 | `INC-003-database-dns-failure.md` |

---

## Technical Artifact Index

| Artifact | Function |
|---|---|
| `.github/workflows/pr-validation.yml` | Core CI pipeline definition |
| `.pre-commit-config.yaml` | Local quality assurance enforcement |
| `Makefile` | Core local validation and operational task automation |
| `docker/otel-collector-config.yaml` | OTel pipeline definition |
| `k8s/helm-chart/templates/pdb.yaml` | PodDisruptionBudget definition |
| `k8s/helm-chart/templates/networkpolicy.yaml` | Frontend/backend selected-workload isolation policies |
| `k8s/helm-chart/dashboards/application-overview.json` | Grafana dashboard layout definition |
| `terraform/modules/network/` | Reusable private-network module for an existing VPC |
| `terraform/modules/network/tests/` | Infrastructure unit test definitions |
| `docs/ops/TROUBLESHOOTING.md` | Incident decision trees |
| `docs/ops/VERIFICATION_PLAYBOOK.md` | Hardening verification procedures |
