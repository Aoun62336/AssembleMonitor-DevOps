# INC-001 — PostgreSQL Container Outage

> **Classification:** Controlled local reliability exercise
> **Environment:** Local Docker Compose (development)

---

## Incident Metadata

| Field | Value |
|---|---|
| **Incident ID** | INC-001 |
| **Execution Date** | 2026-08-20 |
| **Start Time** | 19:41:28 IST (UTC+05:30) |
| **End Time** | 19:43:37 IST (UTC+05:30) |
| **Duration** | 2 minutes 9 seconds |
| **Severity** | Simulated — Sev2 equivalent (API degraded, process alive) |
| **Conducted by** | Aoun |

---

## Exercise Objective

Validate that the API's separated health probes correctly distinguish between:
- **Liveness** (`/api/health/live`) — is the Python process active?
- **Readiness** (`/api/health/ready`) — can the API serve traffic based on downstream dependency status?

When the PostgreSQL container is terminated, the process must remain active (live=200) while readiness correctly reports the dependency failure (ready=503). This validates the Kubernetes mechanism that prevents the pod from receiving new traffic without inducing an unnecessary pod restart.

---

## Fault Injection Trigger

```bash
docker compose stop db
```

---

## Observed Telemetry (Symptoms)

| Endpoint | Pre-Fault Status | Post-Fault Status | Meets Expectation |
|---|---|---|---|
| `GET /api/health` | 200 | Not tested | — |
| `GET /api/health/live` | 200 | **200** | Yes — process survived |
| `GET /api/health/ready` | 200 | **503** | Yes — Database failure detected |

Response payload post-fault:

```json
{"status":"not_ready","database":"unavailable","version":"0.1.0"}
```

---

## Investigation Procedures

```bash
docker compose ps
```

```text
assemblemonitor_api      Up (healthy)   0.0.0.0:8000->8000/tcp
assemblemonitor_adminer  Up             0.0.0.0:8080->8080/tcp
assemblemonitor_frontend Up             0.0.0.0:3000->80/tcp
# db: not listed — stopped
```

```bash
docker compose logs api --tail=5
```

```text
WARNING | app.routers.health | Database health probe failed: TimeoutError
INFO:    172.19.0.1:43114 - "GET /api/health/ready HTTP/1.1" 503 Service Unavailable
```

The API logged a `TimeoutError` on the downstream health probe and returned HTTP 503 on `/ready`, while `/live` continued returning HTTP 200 via uvicorn on the local loopback.

---

## Root Cause Analysis

The PostgreSQL container (`assemblemonitor_db`) was terminated. The FastAPI process remained active (uvicorn continued accepting connections) but the async database connection pool could not establish connections to the backend. The `/api/health/ready` endpoint executes a lightweight `SELECT 1` query on every invocation; with the database unreachable, this timed out and the handler correctly returned HTTP 503.

---

## Recovery Procedures

```bash
docker compose start db
sleep 15
curl -i http://localhost:8000/api/health/ready
```

Response payload post-recovery:

```json
{"status":"ready","database":"connected","version":"0.1.0"}
```

| Execution Step | Timestamp |
|---|---|
| `docker compose start db` executed | 19:43:22 IST |
| `/api/health/ready` restored to 200 | 19:43:37 IST |
| **Observed Recovery Duration** | **2 min 9 sec** |

---

## Architectural Validation

1. **Probe separation functionality**: Liveness and readiness are independent. A database failure does not terminate the process; it exclusively restricts traffic ingress via readiness failure.
2. **Kubernetes integration correctness**: Within an EKS environment, a 503 response from `/ready` instructs the kubelet to remove the pod from the Service endpoint slice, halting traffic ingress without a pod restart.
3. **Self-healing capacity**: Upon database container restoration, the API connection pool reconnected automatically; manual API restart was not required.

---

## Remediation / Follow-Up Actions

| Action Item | Owner | Status |
|---|---|---|
| N/A — controlled exercise, no production impact | — | Closed |
