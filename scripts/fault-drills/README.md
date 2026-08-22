# Fault Injection Drills — AssembleMonitor

Controlled reliability exercises designed for the local Docker Compose environment. 

---

## Execution Prerequisites

The application stack must be fully initialized prior to execution:

```bash
docker compose up -d
docker compose ps
```

Drill scripts require execution from the repository root directory:

```bash
bash scripts/fault-drills/00-preflight.sh
```

---

## Drill Inventory

| Script | Failure Scenario | Postmortem Reference | MTTR |
|---|---|---|---|
| `00-preflight.sh` | Pre-execution health verification | — | — |
| `01-database-outage.sh` | PostgreSQL container termination. Validates API liveness preservation and readiness degradation. | [`INC-001`](../../docs/ops/incidents/INC-001-database-outage.md) | 2 min 9 sec |
| `02-api-outage.sh` | API container termination. Validates Nginx 502 Bad Gateway response handling. | [`INC-002`](../../docs/ops/incidents/INC-002-api-outage-nginx-502.md) | 2 min 35 sec |
| `03-database-dns-failure.sh` | Invalid `DATABASE_URL` hostname injection. Validates resilience against upstream DNS resolution failures. | [`INC-003`](../../docs/ops/incidents/INC-003-database-dns-failure.md) | 2 min 22 sec |
| `04-recovery-validation.sh` | Post-execution full stack health verification | — | — |

---

## Sequential Execution Procedure

```bash
bash scripts/fault-drills/00-preflight.sh
bash scripts/fault-drills/01-database-outage.sh
bash scripts/fault-drills/02-api-outage.sh
bash scripts/fault-drills/03-database-dns-failure.sh
bash scripts/fault-drills/04-recovery-validation.sh
```

---

## Configuration Overrides

| File | Associated Drill | Purpose |
|---|---|---|
| `overrides/bad-db-host.yml` | `03-database-dns-failure.sh` | Overrides `DATABASE_URL` hostname to `db-invalid` |

---

## Operational Constraints

- Execution of `docker compose down -v` is prohibited; the `-v` flag destroys persistent volume data.
- Drills are restricted to local development environments. Execution against shared or staging infrastructure is prohibited.
- `00-preflight.sh` validation is mandatory prior to fault injection.
- `04-recovery-validation.sh` validation is mandatory post-execution to certify environmental health.
