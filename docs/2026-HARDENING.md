# 2026 Reliability & CI Hardening — Evidence Record

**Branch:** `hardening/reliability-ci`
**Sprint Date:** 2026-08-20
**Engineer:** Aoun
**Commits:** 16 total | [View on GitHub](https://github.com/Aoun62336/AssembleMonitor-DevOps/compare/main...hardening/reliability-ci)

---

## Executive Summary

This document records every improvement made during the August 2026 hardening sprint
for AssembleMonitor. The sprint covered five dimensions:

| Dimension | Deliverable |
|---|---|
| **Reliability** | Health probe separation, PDB, NetworkPolicy, 3 fault drills |
| **CI/CD** | 5-job GitHub Actions pipeline, Jenkins improvements |
| **Security** | Dependabot, Gitleaks, pre-commit hooks |
| **Infrastructure** | Terraform reusable module + unit tests |
| **Observability** | Grafana dashboard-as-code, local OTel Collector |

Every deliverable is backed by commit SHA, test output, or a screenshot.
Nothing in this document is assumed or invented.

---

## DORA Metrics

DORA (DevOps Research and Assessment) metrics measure software delivery performance.
Values below are measured from the actual sprint, not estimated.

| Metric | Value | Source |
|---|---|---|
| **Deployment Frequency** | 16 commits in 1 day | `git log --oneline hardening/reliability-ci` |
| **Lead Time for Changes** | ~15–30 min per milestone (concept → verified commit) | Sprint timestamps |
| **Mean Time to Restore (MTTR)** | **2 min 22 sec** (average across 3 drills) | INC-001, INC-002, INC-003 |
| **Change Failure Rate** | **0%** (0 rollbacks across 16 commits) | CI green on every push |

### MTTR Breakdown

| Incident | Fault Type | Duration | Recovery Action |
|---|---|---|---|
| INC-001 | PostgreSQL container stopped | **2 min 9 sec** | `docker compose start db` |
| INC-002 | API container stopped | **2 min 35 sec** | `docker compose start api` |
| INC-003 | Bad `DATABASE_URL` hostname | **2 min 22 sec** | Remove Compose override, recreate api |
| **Average** | — | **2 min 22 sec** | — |

**Benchmark:** DORA Elite performers target MTTR < 1 hour. AssembleMonitor achieves
MTTR < 3 minutes in local drills, demonstrating that the separation of liveness and
readiness probes produces fast, deterministic failure signals.

---

## Milestone Summary

| # | Milestone | Commit | Status |
|---|---|---|---|
| M1 | Separate liveness / readiness health probes | `2744459` | ✅ |
| M2 | pytest health + auth test suite (23 tests) | `7321ed6` | ✅ |
| M3 | GitHub Actions 5-job CI pipeline | `de3856b`, `7dc321a` | ✅ |
| M4 | Helm chart dependency lock (`Chart.lock`) | `5d2246f` | ✅ |
| M5 | PodDisruptionBudget + NetworkPolicy Helm templates | `6f6c44d` | ✅ |
| M6 | Jenkins: options block, pytest stage, image cleanup | `08fb205` | ✅ |
| M7 | Terraform reusable network module + unit tests | `97e3071` | ✅ |
| M8 | Grafana application overview dashboard-as-code | `5b6eb25` | ✅ |
| M9 | README update + `docs/ops/VERIFICATION_PLAYBOOK.md` | `265907a` | ✅ |
| M10 | k3d runtime proof: NetworkPolicy + PDB validated | `b2700ee`, `c768bb7` | ✅ |
| M11 | Dependabot + Gitleaks CI job + pre-commit hooks | `32984f5` | ✅ |
| M12 | Developer `Makefile` (7 targets, mirrors CI) | `a5a4d86` | ✅ |
| M13 | 3 fault drills + postmortems (INC-001, 002, 003) | `6fdd3f0` | ✅ |
| M14 | Local OTel Collector in docker-compose | `a068a79` | ✅ |

---

## Architecture Changes

### Health Probe Separation (M1)

**Before:** Single `/health` endpoint — one probe for both liveness and readiness.
**After:** Three independent probes:

| Endpoint | Purpose | Kubernetes Signal |
|---|---|---|
| `GET /api/health` | Aggregated health | General monitoring |
| `GET /api/health/live` | Process alive? | Liveness probe — triggers restart |
| `GET /api/health/ready` | DB reachable? | Readiness probe — gates traffic |

**Proof (INC-001):** After `docker compose stop db`:
- `/live` → 200 (process survives)
- `/ready` → 503 (DB correctly detected)
- After `docker compose start db` → `/ready` returns 200 in **2 min 9 sec**

---

## CI/CD Pipeline

### GitHub Actions — 5 Jobs (M3, M11)

```
PR push
  ├── backend-test        — Python compileall + pytest (23 tests, SQLite mock)
  ├── frontend-build      — npm install + Vite production build
  ├── terraform-validate  — tf init (no backend) + tf validate + tf test
  ├── helm-validate       — helm dep build + helm lint + helm template render
  └── secret-scan         — Gitleaks full-history credential scan
```

All 5 jobs run in parallel. All 5 must pass before merge.

### Jenkins Improvements (M6)

Added to [`Jenkinsfile-gitops`](file:///c:/Users/AOUN/Desktop/AssembleMonitor/Jenkinsfile-gitops):
- `options` block: build timeout (60 min), discard old builds (keep 10)
- `pytest` stage between build and deploy
- Docker image cleanup after build

---

## Kubernetes Hardening

### PodDisruptionBudget (M5)

Defined in `k8s/helm-chart/templates/pdb.yaml`. Prevents all replicas from being
evicted simultaneously during node drain or rolling upgrade.

```yaml
maxUnavailable: 1   # At least N-1 pods always running
```

**Proof (M10):** `kubectl drain k3d-assemblemonitor-hardening-agent-0` completed
without disrupting the service — PDB ensured the backend remained reachable.

### NetworkPolicy (M5)

Defined in `k8s/helm-chart/templates/networkpolicy.yaml`. Implements
default-deny with explicit allow-list:

| Source | Destination | Port | Result |
|---|---|---|---|
| `app=assemblemonitor-frontend` | `app=assemblemonitor-backend` | 8000 | ✅ ALLOWED |
| `app=untrusted` | `app=assemblemonitor-backend` | 8000 | ❌ BLOCKED |

**Proof (M10):**
```
frontend→backend: HTTP 200 ALLOWED_AS_EXPECTED
untrusted→backend: BLOCKED_AS_EXPECTED
```

---

## Supply Chain Security (M11)

| Control | Implementation | Trigger |
|---|---|---|
| Dependency updates | `.github/dependabot.yml` (3 ecosystems) | Every Monday |
| Secret detection in CI | `gitleaks/gitleaks-action@v2` (full history) | Every PR push |
| Pre-commit hooks | `.pre-commit-config.yaml` (9 hooks) | Every local `git commit` |
| PR checklist | `.github/pull_request_template.md` | Every PR opened |

---

## Infrastructure as Code (M7)

Terraform reusable network module at `terraform/modules/network/`:

- Creates VPC, public/private subnets, IGW, NAT Gateway, route tables
- **Unit-tested with `terraform test`** using `mock_provider` (no AWS credentials needed)
- Test file: `terraform/modules/network/tests/network.tftest.hcl`

```
$ terraform -chdir=terraform/modules/network test
Pass! 3 passed, 0 failed.
```

---

## Observability (M8, M14)

### Grafana Dashboard-as-Code (M8)

- Dashboard JSON at `k8s/helm-chart/dashboards/application-overview.json`
- Provisioned automatically via Helm ConfigMap + Grafana sidecar
- Panels: Request rate, P95 latency, error rate, DB connection pool

### Local OTel Collector (M14)

Added to `docker-compose.yml`:
- Image: `otel/opentelemetry-collector-contrib:0.104.0`
- Config: `docker/otel-collector-config.yaml`
- Pipeline: `otlp → batch + resource → debug`

**Proof:**
```
TracesExporter {"resource spans": 1, "spans": 3}
GET /api/health  d28b7e0c5a8f58ba  http.status_code=200  http.method=GET
```

---

## Developer Experience (M12)

[`Makefile`](file:///c:/Users/AOUN/Desktop/AssembleMonitor/Makefile) with 7 targets:

| Target | What it does |
|---|---|
| `make test` | Backend pytest suite |
| `make lint` | Python compileall + terraform fmt check |
| `make helm-lint` | Helm lint against all values files |
| `make tf-test` | Terraform module unit tests |
| `make stack-up` | `docker compose up -d --build` |
| `make stack-down` | `docker compose down` (never `-v`) |
| `make ci-local` | Runs all 4 of the above in sequence |

---

## Fault Drills (M13)

| ID | Fault | MTTR | Postmortem |
|---|---|---|---|
| INC-001 | PostgreSQL container stopped | 2 min 9 sec | [`INC-001-db-outage.md`](file:///c:/Users/AOUN/Desktop/AssembleMonitor/docs/ops/incidents/INC-001-db-outage.md) |
| INC-002 | API container stopped | 2 min 35 sec | [`INC-002-api-outage.md`](file:///c:/Users/AOUN/Desktop/AssembleMonitor/docs/ops/incidents/INC-002-api-outage.md) |
| INC-003 | Bad `DATABASE_URL` hostname (DNS failure) | 2 min 22 sec | [`INC-003-db-dns-failure.md`](file:///c:/Users/AOUN/Desktop/AssembleMonitor/docs/ops/incidents/INC-003-db-dns-failure.md) |

Drill scripts: `scripts/fault-drills/overrides/`
Postmortem template: [`docs/ops/POSTMORTEM_TEMPLATE.md`](file:///c:/Users/AOUN/Desktop/AssembleMonitor/docs/ops/POSTMORTEM_TEMPLATE.md)

---

## Key File Index

| File | Purpose |
|---|---|
| `.github/workflows/pr-validation.yml` | 5-job CI pipeline |
| `.github/dependabot.yml` | Automated dependency updates |
| `.github/pull_request_template.md` | PR quality checklist |
| `.pre-commit-config.yaml` | Local commit-time hooks |
| `Makefile` | Developer task runner |
| `docker-compose.yml` | Full local stack + OTel Collector |
| `docker/otel-collector-config.yaml` | OTel pipeline config |
| `k8s/helm-chart/templates/pdb.yaml` | PodDisruptionBudget |
| `k8s/helm-chart/templates/networkpolicy.yaml` | NetworkPolicy |
| `k8s/helm-chart/dashboards/application-overview.json` | Grafana dashboard |
| `k8s/helm-chart/values/hardening-validation.yaml` | k3d test values |
| `k8s/validation/hardening-smoke.yaml` | k3d smoke workloads |
| `terraform/modules/network/` | Reusable VPC module |
| `docs/ops/VERIFICATION_PLAYBOOK.md` | Step-by-step verification guide |
| `docs/ops/incidents/` | INC-001, INC-002, INC-003 postmortems |
| `scripts/fault-drills/overrides/` | Docker Compose fault injection overrides |
| `backend/tests/` | pytest health + auth test suite |
