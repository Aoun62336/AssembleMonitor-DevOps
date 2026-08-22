# Local Development Deployment Strategy

> [!TIP]
> This deployment strategy simulates the production architecture locally using Docker Compose, bypassing AWS infrastructure dependencies for rapid development and pre-commit validation.

**Execution Scope:** Development, Unit/Integration Testing, Code Review
**Architecture:** Containerized via Docker Compose

## Prerequisites

- Docker Engine & Docker Compose (`>= 2.20.0`)
- Git

## Provisioning Procedure

1. **Clone Repository**

   ```bash
   git clone <repository_url>
   cd AssembleMonitor
   ```

2. **Initialize Container Stack**
   
   Execute the initialization from the repository root to build and deploy the frontend, backend, and PostgreSQL containers.

   ```bash
   docker compose up --build -d
   ```

3. **Execute Database Migrations**
   
   Apply Alembic schema migrations to initialize the database structure.

   ```bash
   docker compose exec api alembic upgrade head
   ```

4. **Initialize Administrative Identity**
   
   Provision the default administrative user record.

   ```bash
   docker compose exec api python seed_admin.py
   ```

## Application Endpoints

- **Frontend Application**: `http://localhost:3000`
- **Backend API OpenAPI Specification**: `http://localhost:8000/api/docs`
- **Adminer Database UI**: `http://localhost:8080`

## Teardown Procedure

To cleanly terminate the environment while preserving persistent volume data:

```bash
docker compose down
```

> Note: To perform a destructive teardown (destroying the database volume), append the `-v` flag.

---

## Health Probe Architecture

The backend API exposes separated health probes to align with Kubernetes deployment contracts:

| Endpoint | Function | Target State |
|---|---|---|
| `GET /api/health` | Aggregated system status | `{"status":"ok","database":"connected"}` |
| `GET /api/health/live` | Liveness validation | HTTP 200 OK |
| `GET /api/health/ready` | Readiness validation | HTTP 200 OK (HTTP 503 on database failure) |

```bash
curl http://localhost:8000/api/health/live
curl http://localhost:8000/api/health/ready
```

**Kubernetes Integration:** Liveness probe failure induces pod restart. Readiness probe failure isolates the pod from the ingress load balancer without forcing a restart.

---

## Fault Injection Exercises

The local Docker Compose environment supports controlled reliability testing via provisioned fault injection scripts:

```bash
# Validate baseline health prior to execution
bash scripts/fault-drills/00-preflight.sh

# Execute localized failure scenarios
bash scripts/fault-drills/01-database-outage.sh      # Terminate db → live=200, ready=503
bash scripts/fault-drills/02-api-outage.sh            # Terminate api → Nginx 502
bash scripts/fault-drills/03-database-dns-failure.sh  # Inject invalid DATABASE_URL → live=200, ready=503

# Validate automated recovery mechanisms
bash scripts/fault-drills/04-recovery-validation.sh
```

Consult [`scripts/fault-drills/README.md`](../../scripts/fault-drills/README.md) for execution prerequisites and constraints.
