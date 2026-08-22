# INC-002 — FastAPI Container Outage

> **Classification:** Controlled local reliability exercise
> **Environment:** Local Docker Compose (development)

---

## Incident Metadata

| Field | Value |
|---|---|
| **Incident ID** | INC-002 |
| **Execution Date** | 2026-08-20 |
| **Start Time** | 19:50:08 IST (UTC+05:30) |
| **End Time** | 19:52:43 IST (UTC+05:30) |
| **Duration** | 2 minutes 35 seconds |
| **Severity** | Simulated — Sev1 equivalent (full API unavailability) |
| **Conducted by** | Aoun |

---

## Exercise Objective

Validate the system response when the FastAPI (`api`) container is abruptly terminated:
- The Nginx frontend proxy must return an explicit `502 Bad Gateway` (mitigating silent connection hangs).
- The direct API port (8000) must refuse connections immediately.
- Both signals must provide sufficient telemetry to trigger upstream monitoring alerts.

---

## Fault Injection Trigger

```bash
docker compose stop api
```

---

## Observed Telemetry (Symptoms)

| Endpoint | Pre-Fault Status | Post-Fault Status | Meets Expectation |
|---|---|---|---|
| `GET localhost:3000/api/health` (via Nginx) | 200 | **502 Bad Gateway** | Yes — explicit failure |
| `GET localhost:8000/api/health` (direct) | 200 | **Connection refused** | Yes — port closed |

Nginx response payload (port 3000) post-fault:

```html
<h1>502 Bad Gateway</h1>
<center>nginx/1.31.4</center>
```

Direct curl response (port 8000) post-fault:

```text
curl: (7) Failed to connect to localhost port 8000 after 2266 ms: Could not connect to server
```

---

## Investigation Procedures

```bash
docker compose ps
```

```text
assemblemonitor_adminer    Up  0.0.0.0:8080->8080/tcp
assemblemonitor_db         Up (healthy) 0.0.0.0:5432->5432/tcp
assemblemonitor_frontend   Up  0.0.0.0:3000->80/tcp
# api: not listed — stopped
```

```bash
docker compose logs frontend --tail=3
```

```text
2026/08/20 14:20:51 [error] 33#33: *4 connect() failed (113: Host is unreachable)
  while connecting to upstream, client: 172.19.0.1,
  upstream: "http://172.19.0.4:8000/api/health"
172.19.0.1 - "GET /api/health HTTP/1.1" 502 157
```

Nginx attempted to proxy the request to the API container's IP (`172.19.0.4:8000`) but the upstream was unreachable (`Host is unreachable — errno 113`). Nginx immediately returned HTTP 502 rather than timing out silently.

---

## Root Cause Analysis

The FastAPI container (`assemblemonitor_api`) was terminated. The Nginx reverse proxy (`assemblemonitor_frontend`) lacked a live upstream target. Nginx's proxy module detected the TCP connection failure immediately (`ENOHOST`, errno 113) and correctly returned `HTTP 502 Bad Gateway`. Connection hanging was prevented; failure manifestation was explicit and immediate.

---

## Recovery Procedures

```bash
docker compose start api
sleep 10
curl -i http://localhost:3000/api/health
```

Response payload post-recovery (via Nginx):

```json
{"status":"ok","database":"connected","version":"0.1.0"}
```

| Execution Step | Timestamp |
|---|---|
| `docker compose start api` executed | 19:52:33 IST |
| Port 3000 returned 200 via Nginx | 19:52:43 IST |
| **Mean Time to Recovery (MTTR)** | **2 min 35 sec** |

---

## Architectural Validation

1. **Nginx 502 Failure Mode**: Clients receive an immediate error response rather than a hanging connection, enabling rapid frontend error handling and retry logic.
2. **Component Isolation**: Terminating the API container did not impact the stability of the PostgreSQL or Nginx containers.
3. **EKS Equivalence**: In a Kubernetes environment, a crashed pod would be detected via liveness probe failure, restarted by the kubelet, and isolated from ingress traffic during the restart window via the readiness probe. This drill accurately simulates the state during that restart window.

---

## Remediation / Follow-Up Actions

| Action Item | Owner | Status |
|---|---|---|
| N/A — controlled exercise, no production impact | — | Closed |
