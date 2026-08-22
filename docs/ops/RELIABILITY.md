# AssembleMonitor Reliability Definitions

> [!IMPORTANT]
> The SLI definitions and SLO targets below are **reliability design targets for engineering practice**.
> They are not measured commercial SLAs, contractual uptime guarantees, or historical production uptime claims.
> Targets were selected based on common industry baselines for internal applications of this type.
> Actual production measurement would require a monitoring system configured to record and aggregate
> these signals over a sustained period.

---

## Service Level Indicators (SLIs)

An SLI is a quantitative measure of service behaviour. The following indicators are candidates for
ongoing measurement in this system, based on the monitoring infrastructure already provisioned.

| SLI | Definition | Signal Source |
|---|---|---|
| **HTTP Availability** | Proportion of requests to `/api/health` that return `2xx` over a rolling window | ALB access logs, Prometheus `http_requests_total` |
| **HTTP 5xx Error Rate** | Proportion of requests returning `5xx` status codes | CloudWatch `HTTPCode_Target_5XX_Count` alarm (threshold > 5) |
| **Request Latency (p99)** | 99th-percentile response time for API requests | OpenTelemetry traces → Tempo → Grafana |
| **Backend Readiness** | Proportion of `/api/health/ready` calls returning `200` | Prometheus scrape of the health endpoint |
| **ALB Unhealthy Targets** | Count of EKS node targets failing ALB health checks | CloudWatch `UnHealthyHostCount` alarm (threshold > 0) |
| **RDS Availability** | PostgreSQL responding to connections (no `TimeoutError` in health probe) | Application logs, CloudWatch `RDS CPU` and `FreeStorageSpace` alarms |

---

## Service Level Objectives (SLOs)

An SLO is a target range for an SLI. The following targets represent design goals for this system.

> [!NOTE]
> These figures have not been validated against measured production traffic. They should be
> treated as starting points for observability configuration, not performance guarantees.

| SLO | Target | Measurement Window | Rationale |
|---|---|---|---|
| **API Availability** | ≥ 99.5% | 30-day rolling | Appropriate for an internal web application without SLA commitments |
| **5xx Error Rate** | < 0.5% of requests | 7-day rolling | Aligns with the existing CloudWatch alarm threshold of > 5 errors |
| **p99 Latency** | < 2 000 ms | 1-hour rolling | Baseline for acceptable interactive response time |
| **Readiness Probe Success Rate** | ≥ 99% | 30-day rolling | Ensures Kubernetes traffic gating is working as intended |
| **ALB Unhealthy Target Count** | 0 sustained for > 5 min | Real-time | Matches the provisioned CloudWatch alarm for `UnHealthyHostCount > 0` |
| **RDS Storage Free** | > 2 GB at all times | Real-time | Matches the provisioned CloudWatch alarm for `FreeStorageSpace < 2 GB` |

---

## Error Budget

An error budget is the inverse of an SLO — the allowable amount of unreliability within the objective window.

For a **99.5% availability SLO over 30 days** (43 200 minutes):

| Budget item | Calculation | Value |
|---|---|---|
| Allowed downtime per 30 days | `43 200 × 0.005` | **216 minutes** (~3 h 36 min) |
| Allowed downtime per 7 days | `10 080 × 0.005` | **50 minutes** |
| Allowed downtime per 24 hours | `1 440 × 0.005` | **7 minutes** |

> [!NOTE]
> These error budget figures are illustrative. Meaningful error budget tracking requires an
> automated measurement pipeline (e.g. Prometheus recording rules + Grafana alerting).

---

## Observed Reliability Data (Fault Drills — 2026-08-20)

The following controlled recovery durations were measured during controlled fault drill exercises against the local
Docker Compose environment. These figures represent the local development stack only and do not
represent EKS production behaviour.

| Drill | Fault Injected | Observed Recovery Duration | Postmortem |
|---|---|---|---|
| INC-001 | PostgreSQL container stopped | **2 min 9 sec** | [`INC-001-database-outage.md`](incidents/INC-001-database-outage.md) |
| INC-002 | FastAPI container stopped | **2 min 35 sec** | [`INC-002-api-outage-nginx-502.md`](incidents/INC-002-api-outage-nginx-502.md) |
| INC-003 | Bad `DATABASE_URL` hostname (DNS failure) | **2 min 22 sec** | [`INC-003-database-dns-failure.md`](incidents/INC-003-database-dns-failure.md) |

**Observations:**
- Probe separation clearly distinguished application-process liveness from database-dependent readiness during INC-001 and INC-003.
- INC-001 and INC-003 recovered after the injected dependency/configuration fault was removed.
- INC-002 required an explicit API service restart, as expected after intentionally stopping the API container.
- No data loss occurred during the drills; the PostgreSQL volume was preserved.

---

## Monitoring Infrastructure

The following tooling is provisioned and available for SLI measurement:

| Tool | Scope | Location |
|---|---|---|
| **Prometheus-compatible application metrics** | FastAPI exposes `/metrics` through prometheus-fastapi-instrumentator; historical EKS application-metric scraping is not claimed unless the endpoint is wired into the Prometheus/AMP scrape configuration. | Helm chart: `k8s/helm-chart/` |
| **Grafana** | Dashboards for request rate, latency, error rate | Helm chart: `k8s/helm-chart/dashboards/` |
| **Tempo** | Distributed tracing for request flow | Helm chart: `k8s/helm-chart/` |
| **Loki** | Log aggregation | Helm chart: `k8s/helm-chart/` |
| **OpenTelemetry Collector** | OTLP Collector pipeline; current local evidence specifically proves FastAPI trace ingestion. | `docker/otel-collector-config.yaml` |
| **CloudWatch** | ALB, RDS, and EC2 alarms | Terraform: `terraform/` |

---

> [!NOTE]
> For incident response procedures and recovery time objectives, see [`INCIDENT_RESPONSE.md`](INCIDENT_RESPONSE.md).
> For first-response troubleshooting steps, see [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).
