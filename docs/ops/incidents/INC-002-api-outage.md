# INC-002 — FastAPI Container Outage

> **Classification:** Controlled local reliability exercise — not a production incident.
> **Environment:** Local Docker Compose (development)

---

## Incident Metadata

| Field | Value |
|---|---|
| **Incident ID** | INC-002 |
| **Exercise Date** | 2026-08-20 |
| **Start Time** | 19:50:08 IST (UTC+05:30) |
| **End Time** | 19:52:43 IST (UTC+05:30) |
| **Duration** | 2 minutes 35 seconds |
| **Severity** | Simulated — Sev1 equivalent (full API unavailability) |
| **Conducted by** | Aoun |

---

## Exercise Objective

Validate that when the FastAPI (`api`) container stops:
- The Nginx frontend proxy returns a clear `502 Bad Gateway` (not a silent hang)
- The direct API port (8000) refuses connections immediately
- Both signals are sufficient to trigger an alert in a real monitoring setup

---

## Trigger

```bash
docker compose stop api
```

---

## Symptoms Observed

| Endpoint | Before Fault | After Fault | Correct? |
|---|---|---|---|
| `GET localhost:3000/api/health` (via Nginx) | 200 | **502 Bad Gateway** | ✅ Yes — fast failure |
| `GET localhost:8000/api/health` (direct) | 200 | **Connection refused** | ✅ Yes — port closed |

Response from Nginx (port 3000) after fault:

```html
<h1>502 Bad Gateway</h1>
<center>nginx/1.31.4</center>
```

Direct curl (port 8000) after fault:

```
curl: (7) Failed to connect to localhost port 8000 after 2266 ms: Could not connect to server
```

---

## Investigation

```
docker compose ps
```

```
assemblemonitor_adminer    Up  0.0.0.0:8080->8080/tcp
assemblemonitor_db         Up (healthy) 0.0.0.0:5432->5432/tcp
assemblemonitor_frontend   Up  0.0.0.0:3000->80/tcp
# api: not listed — stopped
```

```
docker compose logs frontend --tail=3
```

```
2026/08/20 14:20:51 [error] 33#33: *4 connect() failed (113: Host is unreachable)
  while connecting to upstream, client: 172.19.0.1,
  upstream: "http://172.19.0.4:8000/api/health"
172.19.0.1 - "GET /api/health HTTP/1.1" 502 157
```

Nginx attempted to proxy the request to the api container's IP (`172.19.0.4:8000`)
but the upstream was unreachable (`Host is unreachable — errno 113`). Nginx
immediately returned 502 with a body rather than timing out silently.

---

## Root Cause

The FastAPI container (`assemblemonitor_api`) was stopped. The Nginx reverse proxy
(`assemblemonitor_frontend`) had no live upstream to forward requests to. Nginx's
proxy module detected the TCP connection failure immediately (`ENOHOST`, errno 113)
and returned `HTTP 502 Bad Gateway`. No request hung; failure was fast and explicit.

---

## Recovery

```bash
docker compose start api
sleep 10
curl -i http://localhost:3000/api/health
```

Response after recovery (via Nginx):

```json
{"status":"ok","database":"connected","version":"0.1.0"}
```

| Step | Time |
|---|---|
| `docker compose start api` issued | 19:52:33 IST |
| Port 3000 returned 200 via Nginx | 19:52:43 IST |
| **Total recovery time (MTTR)** | **2 min 35 sec** |

---

## What This Proves

1. **Nginx 502 is explicit and fast**: clients receive an immediate error response
   rather than a hanging connection, enabling frontend error handling.
2. **DB and frontend survive independently**: stopping only the API had no effect on
   the PostgreSQL container or the Nginx container.
3. **In EKS equivalence**: a crashed pod would be detected by liveness probe failure,
   restarted by kubelet, and traffic would not route to it during restart (via
   readiness probe). This drill simulates the window between crash and restart.

---

## Follow-Up Actions

| Action | Owner | Status |
|---|---|---|
| N/A — controlled exercise, no production impact | — | Closed |
