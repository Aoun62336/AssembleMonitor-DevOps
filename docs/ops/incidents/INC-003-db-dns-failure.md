# INC-003 — Database DNS Resolution Failure

> **Classification:** Controlled local reliability exercise — not a production incident.
> **Environment:** Local Docker Compose (development)

---

## Incident Metadata

| Field | Value |
|---|---|
| **Incident ID** | INC-003 |
| **Exercise Date** | 2026-08-20 |
| **Start Time** | 19:53:55 IST (UTC+05:30) |
| **End Time** | 19:56:17 IST (UTC+05:30) |
| **Duration** | 2 minutes 22 seconds |
| **Severity** | Simulated — Sev2 equivalent (API degraded, process alive) |
| **Conducted by** | Aoun |

---

## Exercise Objective

Validate that a misconfigured `DATABASE_URL` (pointing to a non-existent hostname)
is detected by the readiness probe without crashing the API process. This simulates
a real-world scenario: an incorrect secret injected at deployment time, a DNS record
deleted mid-run, or a wrong environment variable in a Helm values override.

The API process must stay alive (`/live → 200`) while readiness gates traffic
(`/ready → 503`). In Kubernetes, this would prevent the pod from receiving traffic
without triggering an unnecessary restart.

---

## Trigger

```bash
docker compose \
  -f docker-compose.yml \
  -f scripts/fault-drills/overrides/bad-db-host.yml \
  up -d --force-recreate api
```

The override file (`scripts/fault-drills/overrides/bad-db-host.yml`) replaces the
`DATABASE_URL` environment variable in the `api` service:

```
# Normal:  postgresql+asyncpg://assembleuser:...@db:5432/assemblemonitor
# Injected: postgresql+asyncpg://assembleuser:...@db-invalid:5432/assemblemonitor
```

The hostname `db-invalid` does not exist in the Docker Compose network.

---

## Symptoms Observed

| Endpoint | Before Fault | After Fault | Correct? |
|---|---|---|---|
| `GET /api/health/live` | 200 | **200** | ✅ Yes — process survived |
| `GET /api/health/ready` | 200 | **503** | ✅ Yes — DNS failure detected |

Response body after fault:

```json
{"status":"not_ready","database":"unavailable","version":"0.1.0"}
```

---

## Investigation

```
docker compose logs api --tail=10
```

```
INFO:     Application startup complete.
INFO:     172.19.0.1:60316 - "GET /api/health/live HTTP/1.1" 200 OK
WARNING | app.routers.health | Database health probe failed: TimeoutError
INFO:     172.19.0.1:46074 - "GET /api/health/ready HTTP/1.1" 503 Service Unavailable
```

The API started successfully and the Python process was alive. The `SELECT 1` health
probe to `db-invalid:5432` timed out (DNS resolution failure — host does not exist),
causing the health router to return 503.

---

## Root Cause

The `DATABASE_URL` was overridden at container start time via the Compose override
file to point to `db-invalid` — a hostname that does not exist in the
`assemblemonitor_net` Docker bridge network. On each readiness probe, the async
connection pool attempted to resolve `db-invalid` via Docker's embedded DNS.
Resolution failed, the TCP connection was never established, and the health probe
timed out. The FastAPI process itself was unaffected — uvicorn continued to serve
the liveness endpoint normally.

---

## Recovery

```bash
# Restart the api service using only the base docker-compose.yml (no override)
docker compose up -d --force-recreate api
sleep 15
curl -i http://localhost:8000/api/health/ready
```

Response after recovery:

```json
{"status":"ready","database":"connected","version":"0.1.0"}
```

| Step | Time |
|---|---|
| `docker compose up --force-recreate api` issued | 19:55:55 IST |
| `/api/health/ready` returned 200 | 19:56:17 IST |
| **Total recovery time (MTTR)** | **2 min 22 sec** |

---

## What This Proves

1. **Config errors are caught by readiness, not liveness**: a wrong `DATABASE_URL`
   does not crash the process — it degrades readiness only. In Kubernetes, this
   means the pod stays alive (no restart loop) while traffic is gated out.
2. **The override pattern is production-representative**: injecting a bad secret via
   a Compose override is equivalent to deploying with a wrong Kubernetes Secret or
   ConfigMap value.
3. **Recovery requires only a config fix + restart**: no data loss, no volume
   impact. The correct `DATABASE_URL` was restored by restarting without the override.

---

## Follow-Up Actions

| Action | Owner | Status |
|---|---|---|
| N/A — controlled exercise, no production impact | — | Closed |
