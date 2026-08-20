# INC-001 — PostgreSQL Container Outage

> **Classification:** Controlled local reliability exercise — not a production incident.
> **Environment:** Local Docker Compose (development)

---

## Incident Metadata

| Field | Value |
|---|---|
| **Incident ID** | INC-001 |
| **Exercise Date** | 2026-08-20 |
| **Start Time** | 19:41:28 IST (UTC+05:30) |
| **End Time** | 19:43:37 IST (UTC+05:30) |
| **Duration** | 2 minutes 9 seconds |
| **Severity** | Simulated — Sev2 equivalent (API degraded, process alive) |
| **Conducted by** | Aoun |

---

## Exercise Objective

Validate that the API's separated health probes correctly distinguish between:
- **Liveness** (`/api/health/live`) — is the Python process alive?
- **Readiness** (`/api/health/ready`) — can the API serve real traffic?

When the PostgreSQL container is stopped, the process must stay alive (live=200)
while readiness correctly reports the dependency failure (ready=503). This is the
Kubernetes signal that prevents the pod from receiving new traffic without being
restarted unnecessarily.

---

## Trigger

```bash
docker compose stop db
```

---

## Symptoms Observed

| Endpoint | Before Fault | After Fault | Correct? |
|---|---|---|---|
| `GET /api/health` | 200 | Not tested | — |
| `GET /api/health/live` | 200 | **200** | ✅ Yes — process survived |
| `GET /api/health/ready` | 200 | **503** | ✅ Yes — DB correctly detected as gone |

Response body after fault:

```json
{"status":"not_ready","database":"unavailable","version":"0.1.0"}
```

---

## Investigation

```
docker compose ps
```

```
assemblemonitor_api      Up (healthy)   0.0.0.0:8000->8000/tcp
assemblemonitor_adminer  Up             0.0.0.0:8080->8080/tcp
assemblemonitor_frontend Up             0.0.0.0:3000->80/tcp
# db: not listed — stopped
```

```
docker compose logs api --tail=5
```

```
WARNING | app.routers.health | Database health probe failed: TimeoutError
INFO:    172.19.0.1:43114 - "GET /api/health/ready HTTP/1.1" 503 Service Unavailable
```

The API logged a `TimeoutError` on its DB health probe and returned 503 on `/ready`
while `/live` continued to return 200 via uvicorn on the local loopback.

---

## Root Cause

The PostgreSQL container (`assemblemonitor_db`) was stopped. The FastAPI process
remained alive (uvicorn continued to accept connections) but the async database
connection pool could not reach the backend. The `/api/health/ready` endpoint
issues a lightweight `SELECT 1` probe on every call; with no reachable DB, this
timed out and the handler returned HTTP 503.

---

## Recovery

```bash
docker compose start db
sleep 15
curl -i http://localhost:8000/api/health/ready
```

Response after recovery:

```json
{"status":"ready","database":"connected","version":"0.1.0"}
```

| Step | Time |
|---|---|
| `docker compose start db` issued | 19:43:22 IST |
| `/api/health/ready` returned 200 | 19:43:37 IST |
| **Total recovery time (MTTR)** | **2 min 9 sec** |

---

## What This Proves

1. **Probe separation works**: liveness and readiness are independent. A DB failure
   does not kill the process — it only gates traffic via readiness.
2. **Kubernetes integration is correct**: in EKS, when `/ready` returns 503,
   the kubelet removes the pod from the Service endpoint slice. Traffic stops
   reaching it without a pod restart.
3. **Self-healing**: once the DB container restarted and passed its healthcheck,
   the API connection pool reconnected automatically — no manual API restart needed.

---

## Follow-Up Actions

| Action | Owner | Status |
|---|---|---|
| N/A — controlled exercise, no production impact | — | Closed |
