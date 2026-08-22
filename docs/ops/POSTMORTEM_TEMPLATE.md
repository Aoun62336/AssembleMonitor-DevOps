# Incident Postmortem Template

> **Classification:** Controlled local reliability exercise
> **Environment:** Local Docker Compose (development)

---

## Incident Metadata

| Field | Value |
|---|---|
| **Incident ID** | INC-XXX |
| **Execution Date** | YYYY-MM-DD |
| **Start Time** | HH:MM:SS IST (UTC+05:30) |
| **End Time** | HH:MM:SS IST (UTC+05:30) |
| **Duration** | X minutes Y seconds |
| **Severity** | Simulated — Sev2 equivalent (service degraded, not down) |
| **Conducted by** | Aoun |

---

## Exercise Objective

_Define the specific failure mode and architectural resilience mechanism being validated._

---

## Fault Injection Trigger

_Document the exact command sequence utilized to inject the fault:_

```bash
# Insert execution commands
```

---

## Observed Telemetry (Symptoms)

_Record the immediate response of health probes following fault injection._

| Endpoint | Pre-Fault Status | Post-Fault Status | Meets Expectation |
|---|---|---|---|
| `GET /api/health` | 200 | ? | |
| `GET /api/health/live` | 200 | ? | |
| `GET /api/health/ready` | 200 | ? | |

---

## Investigation Procedures

_Document the diagnostic commands executed and their respective outputs:_

```bash
# Insert diagnostic commands and output
docker compose ps
docker compose logs api --tail=20
```

---

## Root Cause Analysis

_Provide a concise technical explanation of the observed system degradation._

---

## Recovery Procedures

_Document the remediation commands and timeline:_

```bash
# Insert recovery commands
```

| Execution Step | Timestamp | Result |
|---|---|---|
| Remediation command executed | HH:MM:SS | |
| `/api/health/ready` restored to 200 | HH:MM:SS | |
| **Mean Time to Recovery (MTTR)** | — | X min Y sec |

---

## Architectural Validation

_Define the specific design principles proven by this exercise._

---

## Remediation / Follow-Up Actions

| Action Item | Owner | Status |
|---|---|---|
| N/A — controlled exercise, no production impact | — | Closed |
