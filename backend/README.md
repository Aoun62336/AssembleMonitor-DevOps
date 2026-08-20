# AssembleMonitor — Backend API

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-%23005571?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?style=flat-square)](https://www.sqlalchemy.org/)

Async Python REST API for the AssembleMonitor construction management platform. Built with FastAPI and SQLAlchemy 2.0, deployed inside an Amazon EKS cluster with full Prometheus metrics and OpenTelemetry distributed tracing.

---

## Tech Stack

| Layer                    | Library                               | Version       |
| ------------------------ | ------------------------------------- | ------------- |
| Web framework            | FastAPI                               | 0.115         |
| ASGI server              | Uvicorn (with websockets + httptools) | 0.34          |
| ORM                      | SQLAlchemy (async engine)             | 2.0           |
| Async DB driver          | asyncpg                               | 0.31          |
| Sync DB driver (Alembic) | psycopg2-binary                       | 2.9           |
| Migrations               | Alembic                               | 1.15          |
| Auth                     | python-jose + passlib/bcrypt          | JWT HS256     |
| Configuration            | pydantic-settings v2                  | 2.9           |
| Validation               | Pydantic                              | 2.13          |
| AWS SDK                  | boto3                                 | 1.36          |
| Metrics                  | prometheus-fastapi-instrumentator     | unpinned      |
| Tracing                  | opentelemetry-distro + OTLP exporter  | 0.46b0 / 1.25 |

---

## Project Structure

```
backend/
├── app/
│   ├── core/
│   │   ├── config.py           # pydantic-settings — loads .env, validates all settings
│   │   └── security.py         # JWT creation/verification, bcrypt password hashing
│   ├── db/
│   │   ├── base.py             # SQLAlchemy DeclarativeBase (shared metadata)
│   │   └── session.py          # Async engine + AsyncSession factory
│   ├── models/                 # ORM models (import-ordered to resolve FK dependencies)
│   │   ├── user.py             # User — roles: admin, pm, se, client
│   │   ├── project.py          # Project + ProjectAssignment (many-to-many)
│   │   ├── phase.py            # Phase — child of Project
│   │   ├── task.py             # Task — child of Phase, assigned to User
│   │   ├── material.py         # Material + MaterialStock + MaterialUsage
│   │   ├── attendance.py       # Attendance — engineer hours per project
│   │   ├── expense.py          # Expense — non-material project costs
│   │   ├── site_photo.py       # SitePhoto — S3-backed photo uploads
│   │   ├── notification.py     # Notification — per-user in-app alerts
│   │   └── mixins.py           # TimestampMixin, UUIDPrimaryKeyMixin
│   ├── routers/                # 14 FastAPI routers (registered under /api/v1/)
│   │   ├── health.py           # GET /api/health (public — ALB + probe target)
│   │   ├── auth.py             # POST /login, /refresh, /logout
│   │   ├── users.py            # User CRUD + role management
│   │   ├── projects.py         # Project CRUD + assignment
│   │   ├── phases.py           # Phase management per project
│   │   ├── tasks.py            # Task CRUD, assignment, status
│   │   ├── materials.py        # Inventory, stock, usage logs
│   │   ├── attendance.py       # Attendance records
│   │   ├── expenses.py         # Expense tracking
│   │   ├── site_photos.py      # S3 upload/download with IRSA Web Identity Token
│   │   ├── analytics.py        # Aggregated KPIs across projects and costs
│   │   ├── admin.py            # Admin-only system operations
│   │   ├── notifications.py    # Notification management
│   │   └── __init__.py
│   ├── schemas/                # Pydantic request/response models (one file per domain)
│   ├── utils/
│   │   ├── s3.py               # S3 upload/download helpers (boto3)
│   │   ├── email.py            # SMTP email sending (password reset)
│   │   ├── logic.py            # Business logic helpers
│   │   ├── pagination.py       # Cursor-based pagination utilities
│   │   ├── notifications.py    # Notification dispatch helpers
│   │   └── datetime_utils.py   # Timezone-aware datetime helpers
│   ├── dependencies.py         # FastAPI Depends() callables (auth, DB session)
│   └── main.py                 # App factory — CORS, routers, OTEL, Prometheus
├── alembic/
│   ├── env.py                  # Alembic config — async engine, autogenerate support
│   ├── script.py.mako          # Migration script template
│   └── versions/               # Generated migration files
├── .env.example                # All environment variables with descriptions
├── alembic.ini
├── Dockerfile                  # Multi-stage production build (see below)
├── requirements.txt
└── seed_admin.py               # Bootstrap script to create the initial admin user
```

---

## API Endpoints

All protected routes require a `Bearer` JWT token obtained from `POST /api/v1/auth/login`.

| Method     | Path                    | Access            |
| ---------- | ----------------------- | ----------------- |
| `GET`      | `/api/health`           | Public            |
| `GET`      | `/api/health/live`      | Public            |
| `GET`      | `/api/health/ready`     | Public            |
| `POST`     | `/api/v1/auth/login`    | Public            |
| `POST`     | `/api/v1/auth/refresh`  | Public            |
| `GET/POST` | `/api/v1/users`         | Admin             |
| `GET/POST` | `/api/v1/projects`      | Admin, PM         |
| `GET/POST` | `/api/v1/phases`        | Admin, PM         |
| `GET/POST` | `/api/v1/tasks`         | Admin, PM, SE     |
| `GET/POST` | `/api/v1/materials`     | Admin, PM, SE     |
| `GET/POST` | `/api/v1/attendance`    | Admin, PM, SE     |
| `GET/POST` | `/api/v1/expenses`      | Admin, PM         |
| `GET/POST` | `/api/v1/site-photos`   | Admin, PM, SE     |
| `GET`      | `/api/v1/analytics`     | Admin, PM         |
| `GET/POST` | `/api/v1/notifications` | All authenticated |
| `GET/POST` | `/api/v1/admin`         | Admin only        |

Interactive documentation: `GET /api/docs` (Swagger) · `GET /api/redoc`

### Health Endpoints

Three health endpoints are exposed under `/api/`:

| Endpoint | Purpose | DB dependency | Success | Failure |
| --- | --- | --- | --- | --- |
| `GET /api/health` | General diagnostic (backward compat) | Optional (non-fatal) | 200 | 200 (masked) |
| `GET /api/health/live` | Process liveness — is FastAPI alive? | ❌ None | 200 | N/A |
| `GET /api/health/ready` | Dependency readiness — is PostgreSQL reachable? | ✅ Required | 200 | **503** |

**Kubernetes probe semantics:**
- The **liveness probe** uses `/api/health/live`. Kubernetes restarts the container only when this fails. Because it has no DB dependency, a database outage will not incorrectly restart a healthy FastAPI process.
- The **readiness probe** uses `/api/health/ready`. Kubernetes removes the pod from load-balancer rotation when this returns 503, and restores it automatically once the database becomes available again.
- The **legacy** `/api/health` endpoint is preserved for backward compatibility (Jenkins, K6 tests, Terraform user data). It always returns HTTP 200 even when the database is unreachable.

---

## Environment Variables


Copy `.env.example` to `.env` and fill in all values. Key variables:

| Variable                      | Description                                 | Example                                       |
| ----------------------------- | ------------------------------------------- | --------------------------------------------- |
| `DATABASE_URL`                | Async PostgreSQL connection string          | `postgresql+asyncpg://user:pass@host:5432/db` |
| `SECRET_KEY`                  | JWT signing key — 32-byte random hex string | `openssl rand -hex 32`                        |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT access token TTL                        | `60`                                          |
| `REFRESH_TOKEN_EXPIRE_DAYS`   | JWT refresh token TTL                       | `7`                                           |
| `CORS_ORIGINS`                | Comma-separated allowed frontend origins    | `http://localhost:3000`                       |
| `AWS_REGION`                  | AWS region for S3 and Secrets Manager       | `us-east-1`                                   |
| `S3_BUCKET_NAME`              | S3 bucket for photo uploads                 | `assemblemonitor-uploads`                     |
| `SMTP_HOST`                   | SMTP host for password reset emails         | `smtp.gmail.com`                              |
| `APP_ENV`                     | Runtime environment                         | `development` / `production`                  |

> **Production note:** In the EKS deployment, secrets are injected via the External Secrets Operator from AWS Secrets Manager — the `.env` file is not used in-cluster.

---

## Observability

### Prometheus Metrics

The API exposes a `/metrics` endpoint automatically via `prometheus-fastapi-instrumentator`. This is scraped by the OpenTelemetry DaemonSet and remote-written to Amazon Managed Prometheus (AMP).

### Distributed Tracing (OpenTelemetry)

The app is instrumented with `FastAPIInstrumentor` and exports spans via OTLP gRPC to the OpenTelemetry Collector running in the cluster:

```
FastAPI app → OTLP gRPC (port 4317)
    → otel-collector.assemblemonitor.svc.cluster.local
        → Tempo → S3 → Grafana
```

The OTLP endpoint is configured via the `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable, injected by the Helm chart at deployment time.

---

## Dockerfile

The backend uses a **two-stage multi-stage build**:

```
Stage 1 (builder):  python:3.11-slim
    - Installs build-essential + libpq-dev
    - Creates /opt/venv
    - pip install -r requirements.txt
    - opentelemetry-bootstrap -a install (auto-installs OTEL instrumentors)

Stage 2 (runtime):  python:3.11-slim
    - Copies /opt/venv from builder (no build tools in final image)
    - Runs as non-root appuser:appgroup
    - HEALTHCHECK via urllib.request to /api/health
    - CMD: opentelemetry-instrument uvicorn app.main:app --workers 2
```

The `opentelemetry-instrument` wrapper activates auto-instrumentation for SQLAlchemy, asyncpg, and httpx in addition to FastAPI.

---

## Local Development

### Option A — Without Docker

**Prerequisites:** Python 3.11+, PostgreSQL 14+ running locally.

```bash
cd backend

# Create and activate virtualenv
python -m venv .venv
source .venv/bin/activate        # Linux/macOS
# .venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env             # then edit with your DB credentials and SECRET_KEY

# Run migrations
alembic upgrade head

# Seed the admin user
python seed_admin.py

# Start the development server
uvicorn app.main:app --reload --port 8000
```

- Swagger UI: http://localhost:8000/api/docs
- Health check: http://localhost:8000/api/health

### Option B — Docker Compose (full stack)

Run from the **repository root** to start the backend together with PostgreSQL, the frontend, and Adminer:

```bash
# From repository root
docker compose up --build -d

# Run migrations inside the running API container
docker compose exec api alembic upgrade head

# Seed admin user
docker compose exec api python seed_admin.py
```

| Service               | URL                            |
| --------------------- | ------------------------------ |
| Frontend              | http://localhost:3000          |
| Backend API + Swagger | http://localhost:8000/api/docs |
| Adminer (DB GUI)      | http://localhost:8080          |
| PostgreSQL            | localhost:5432                 |

---

## Database Migrations

```bash
# After adding or modifying a model, generate a migration:
alembic revision --autogenerate -m "add_column_to_projects"

# Apply all pending migrations:
alembic upgrade head

# Roll back the most recent migration:
alembic downgrade -1

# View migration history:
alembic history --verbose
```

> Alembic uses a **synchronous** psycopg2 connection (`SYNC_DATABASE_URL` property in `config.py`) for migration execution, while the application runtime uses asyncpg.

---

## Screenshots

> Add backend-specific screenshots to `../docs/screenshots/` and update the links below.

| Screenshot                       | Description                                       |
| -------------------------------- | ------------------------------------------------- |
| _(08-fastapi-swagger.png)_       | Swagger UI showing all API routes                 |
| _(44-health-endpoint.png)_       | `/api/health` response confirming service is live |
| _(45-rds-migration-success.png)_ | Alembic migration completed against RDS           |
