# Fault Drill Scripts — AssembleMonitor

Controlled reliability exercises against the local Docker Compose stack.
Each drill was conducted on 2026-08-20 and produced an INC postmortem.

---

## Prerequisites

The full stack must be running before executing any drill:

```bash
docker compose up -d
docker compose ps   # verify: api, db, frontend, adminer all Up
```

All scripts must be run from the **repository root**:

```bash
bash scripts/fault-drills/00-preflight.sh
```

---

## Scripts

| Script | Drill | Postmortem | MTTR |
|---|---|---|---|
| `00-preflight.sh` | Verify stack healthy before drills | — | — |
| `01-database-outage.sh` | Stop `db` container — API must stay live, readiness must return 503 | [`INC-001`](../docs/ops/incidents/INC-001-database-outage.md) | 2 min 9 sec |
| `02-api-outage.sh` | Stop `api` container — Nginx must return 502 immediately | [`INC-002`](../docs/ops/incidents/INC-002-api-outage-nginx-502.md) | 2 min 35 sec |
| `03-database-dns-failure.sh` | Inject bad `DATABASE_URL` hostname — readiness must return 503 without crashing | [`INC-003`](../docs/ops/incidents/INC-003-database-dns-failure.md) | 2 min 22 sec |
| `04-recovery-validation.sh` | Final health check — confirm all services healthy after drills | — | — |

---

## Running All Drills in Sequence

```bash
bash scripts/fault-drills/00-preflight.sh
bash scripts/fault-drills/01-database-outage.sh
bash scripts/fault-drills/02-api-outage.sh
bash scripts/fault-drills/03-database-dns-failure.sh
bash scripts/fault-drills/04-recovery-validation.sh
```

---

## Override Files

| File | Used by |
|---|---|
| `overrides/bad-db-host.yml` | `03-database-dns-failure.sh` — replaces `DATABASE_URL` hostname with `db-invalid` |

---

## Safety Rules

- **Never** run `docker compose down -v` — the `-v` flag deletes the PostgreSQL data volume.
- **Never** run drills against a shared or staging environment — these are local-only exercises.
- Always run `00-preflight.sh` first and confirm all checks pass before any fault injection.
- Always run `04-recovery-validation.sh` last to confirm the stack is healthy before leaving.
