# INC-003 — Database DNS Resolution Failure

> **Classification:** Controlled local reliability exercise
> **Environment:** Local Docker Compose (development)

---

## Incident Metadata

| Field | Value |
|---|---|
| **Incident ID** | INC-003 |
| **Execution Date** | 2026-08-20 |
| **Start Time** | 19:53:55 IST (UTC+05:30) |
| **End Time** | 19:56:17 IST (UTC+05:30) |
| **Duration** | 2 minutes 22 seconds |
| **Severity** | Simulated — Sev2 equivalent (API degraded, process alive) |
| **Conducted by** | Aoun |

---

## Exercise Objective

Validate that a misconfigured `DATABASE_URL` (pointing to an unresolvable hostname) is detected by the readiness probe without terminating the API process. This simulates a real-world scenario such as an incorrect secret injected during deployment, a deleted DNS record, or an invalid environment variable in a Helm override.

The API process must remain active (`/live → 200`) while readiness gates traffic (`/ready → 503`). In a Kubernetes environment, this prevents the pod from receiving traffic without triggering an unnecessary restart loop.

---

## Fault Injection Trigger

```bash
docker compose \
  -f docker-compose.yml \
  -f scripts/fault-drills/overrides/bad-db-host.yml \
  up -d --force-recreate api
```

The override file (`scripts/fault-drills/overrides/bad-db-host.yml`) replaces the `DATABASE_URL` environment variable within the `api` service:

```text
# Normal:  postgresql+asyncpg://assembleuser:...@db:5432/assemblemonitor
# Injected: postgresql+asyncpg://assembleuser:...@db-invalid:5432/assemblemonitor
```

The hostname `db-invalid` does not exist in the Docker Compose network.

---

## Observed Telemetry (Symptoms)

| Endpoint | Pre-Fault Status | Post-Fault Status | Meets Expectation |
|---|---|---|---|
| `GET /api/health/live` | 200 | **200** | Yes — process survived |
| `GET /api/health/ready` | 200 | **503** | Yes — DNS failure detected |

Response payload post-fault:

```json
{"status":"not_ready","database":"unavailable","version":"0.1.0"}
```

---

## Investigation Procedures

```bash
docker compose logs api --tail=10
```

```text
INFO:     Application startup complete.
INFO:     172.19.0.1:60316 - "GET /api/health/live HTTP/1.1" 200 OK
WARNING | app.routers.health | Database health probe failed: TimeoutError
INFO:     172.19.0.1:46074 - "GET /api/health/ready HTTP/1.1" 503 Service Unavailable
```

The API initialized successfully and the Python process remained active. The `SELECT 1` health probe to `db-invalid:5432` timed out due to a DNS resolution failure, resulting in the health router returning HTTP 503.

---

## Root Cause Analysis

The `DATABASE_URL` was overridden at container initialization via the Compose override file to point to `db-invalid` — an unresolvable hostname within the `assemblemonitor_net` Docker bridge network. During readiness probe execution, the async connection pool attempted to resolve `db-invalid` via Docker's embedded DNS. The resolution failed, preventing TCP connection establishment, and the health probe timed out. The FastAPI process itself was unaffected, and uvicorn continued to serve the liveness endpoint normally.

---

## Recovery Procedures

```bash
# Restart the api service using only the base docker-compose.yml
docker compose up -d --force-recreate api
sleep 15
curl -i http://localhost:8000/api/health/ready
```

Response payload post-recovery:

```json
{"status":"ready","database":"connected","version":"0.1.0"}
```

| Execution Step | Timestamp |
|---|---|
| `docker compose up --force-recreate api` executed | 19:55:55 IST |
| `/api/health/ready` restored to 200 | 19:56:17 IST |
| **Mean Time to Recovery (MTTR)** | **2 min 22 sec** |

---

## Architectural Validation

1. **Configuration Error Detection**: Invalid `DATABASE_URL` configurations degrade readiness without crashing the process. In Kubernetes, the pod remains active while ingress traffic is restricted.
2. **Simulation Verisimilitude**: Injecting an invalid secret via a Compose override accurately simulates deploying with an incorrect Kubernetes Secret or ConfigMap value.
3. **Recovery Simplicity**: Recovery required only a configuration correction and restart, with no data loss or volume impact. The correct `DATABASE_URL` was restored by eliminating the override.

---

## Remediation / Follow-Up Actions

| Action Item | Owner | Status |
|---|---|---|
| N/A — controlled exercise, no production impact | — | Closed |
