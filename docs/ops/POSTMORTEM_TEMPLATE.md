# Incident Postmortem Template

> **Classification:** Controlled local reliability exercise — not a production incident.
> **Environment:** Local Docker Compose (development)

---

## Incident Metadata

| Field | Value |
|---|---|
| **Incident ID** | INC-XXX |
| **Exercise Date** | YYYY-MM-DD |
| **Start Time** | HH:MM:SS IST (UTC+05:30) |
| **End Time** | HH:MM:SS IST (UTC+05:30) |
| **Duration** | X minutes Y seconds |
| **Severity** | Simulated — Sev2 equivalent (service degraded, not down) |
| **Conducted by** | Aoun |

---

## Exercise Objective

_What failure mode was this drill designed to simulate and validate?_

---

## Trigger

The exact command(s) used to inject the fault:

```bash
# paste exact command(s) here
```

---

## Symptoms Observed

_What did each health endpoint return immediately after the fault was injected?_

| Endpoint | Before Fault | After Fault | Expected? |
|---|---|---|---|
| `GET /api/health` | 200 | ? | |
| `GET /api/health/live` | 200 | ? | |
| `GET /api/health/ready` | 200 | ? | |

---

## Investigation

Commands run to investigate the fault and their output:

```bash
# paste investigation commands + output here
docker compose ps
docker compose logs api --tail=20
```

---

## Root Cause

_One paragraph describing the technical cause of the observed symptoms._

---

## Recovery

The exact commands used to restore the service, with timing:

```bash
# paste recovery commands here
```

| Step | Time | Result |
|---|---|---|
| Recovery command issued | HH:MM:SS | |
| `/api/health/ready` back to 200 | HH:MM:SS | |
| **Total recovery time (MTTR)** | — | X min Y sec |

---

## What This Proves

_What this drill validates about the system's design._

---

## Follow-Up Actions

| Action | Owner | Status |
|---|---|---|
| N/A — controlled exercise, no production impact | — | Closed |
