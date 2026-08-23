# AssembleMonitor — Backend API

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-%23005571?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?style=flat-square)](https://www.sqlalchemy.org/)

Async Python REST API for the AssembleMonitor platform. Compiled via FastAPI and SQLAlchemy 2.0, orchestrated within Amazon EKS featuring Prometheus telemetry and OpenTelemetry distributed tracing.

---

## Technology Stack

| Layer | Library | Version |
|---|---|---|
| Web Framework | FastAPI | 0.115 |
| ASGI Server | Uvicorn (websockets + httptools) | 0.34 |
| ORM | SQLAlchemy (async engine) | 2.0 |
| Async DB Driver | asyncpg | 0.31 |
| Sync DB Driver | psycopg2-binary | 2.9 |
| Migrations | Alembic | 1.15 |
| Authentication | python-jose + passlib/bcrypt | JWT HS256 |
| Configuration | pydantic-settings v2 | 2.9 |
| Validation | Pydantic | 2.13 |
| AWS Integration | boto3 | 1.36 |
| Metrics | prometheus-fastapi-instrumentator | unpinned |
| Tracing | opentelemetry-distro + OTLP exporter | 0.46b0 / 1.25 |

---

## Directory Structure

```text
backend/
├── app/
│   ├── core/
│   │   ├── config.py           # Configuration validation (pydantic-settings)
│   │   └── security.py         # JWT issuance and cryptographic hashing
│   ├── db/
│   │   ├── base.py             # SQLAlchemy DeclarativeBase metadata
│   │   └── session.py          # Async engine and AsyncSession factory
│   ├── models/                 # ORM entities
│   │   ├── user.py             # User authorization roles
│   │   ├── project.py          # Project topology
│   │   ├── phase.py            # Phase hierarchy
│   │   ├── task.py             # Task allocation
│   │   ├── material.py         # Material inventory
│   │   ├── attendance.py       # Labor tracking
│   │   ├── expense.py          # Financial ledger
│   │   ├── site_photo.py       # S3 object metadata
│   │   ├── notification.py     # System alerts
│   │   └── mixins.py           # Universal ORM mixins
│   ├── routers/                # FastAPI routing controllers (/api/v1/)
│   │   ├── health.py           # Infrastructure health probes
│   │   ├── auth.py             # Authentication endpoints
│   │   ├── users.py            # User management
│   │   ├── projects.py         # Project management
│   │   ├── phases.py           # Phase tracking
│   │   ├── tasks.py            # Task execution
│   │   ├── materials.py        # Inventory control
│   │   ├── attendance.py       # Labor management
│   │   ├── expenses.py         # Expense tracking
│   │   ├── site_photos.py      # S3 ingestion
│   │   ├── analytics.py        # Aggregated telemetry
│   │   ├── admin.py            # Administrative overrides
│   │   ├── notifications.py    # Alert delivery
│   │   └── __init__.py
│   ├── schemas/                # Pydantic serialization models
│   ├── utils/
│   │   ├── s3.py               # AWS S3 integration
│   │   ├── email.py            # SMTP transport
│   │   ├── logic.py            # Domain logic encapsulation
│   │   ├── pagination.py       # Result pagination
│   │   ├── notifications.py    # Alert dispatch
│   │   └── datetime_utils.py   # Temporal normalization
│   ├── dependencies.py         # Dependency injection definitions
│   └── main.py                 # ASGI application factory
├── alembic/
│   ├── env.py                  # Migration execution environment
│   ├── script.py.mako          # Migration templating
│   └── versions/               # Generated schema migrations
├── .env.example                # Environment variable schema
├── alembic.ini                 # Alembic execution configuration
├── Dockerfile                  # Multi-stage container definition
├── requirements.txt            # Dependency manifest
└── seed_admin.py               # Initial credential bootstrapping
```

---

## API Interfaces

Protected routes require `Bearer` token authorization issued by `POST /api/v1/auth/login`.

| Method | Path | Authorization |
|---|---|---|
| `GET` | `/api/health` | Public |
| `GET` | `/api/health/live` | Public |
| `GET` | `/api/health/ready` | Public |
| `POST` | `/api/v1/auth/login` | Public |
| `POST` | `/api/v1/auth/refresh` | Public |
| `GET/POST` | `/api/v1/users` | Admin |
| `GET/POST` | `/api/v1/projects` | Admin, PM |
| `GET/POST` | `/api/v1/phases` | Admin, PM |
| `GET/POST` | `/api/v1/tasks` | Admin, PM, SE |
| `GET/POST` | `/api/v1/materials` | Admin, PM, SE |
| `GET/POST` | `/api/v1/attendance` | Admin, PM, SE |
| `GET/POST` | `/api/v1/expenses` | Admin, PM |
| `GET/POST` | `/api/v1/site-photos` | Admin, PM, SE |
| `GET` | `/api/v1/analytics` | Admin, PM |
| `GET/POST` | `/api/v1/notifications` | All Authenticated |
| `GET/POST` | `/api/v1/admin` | Admin |

OpenAPI Specification: `GET /api/docs` (Swagger UI) · `GET /api/redoc`

### Infrastructure Probes

| Probe Endpoint | Evaluation Scope | Database Dependency | Expected Status | Target Failure Status |
|---|---|---|---|---|
| `GET /api/health` | Diagnostic baseline | Optional | 200 | 200 |
| `GET /api/health/live` | Liveness validation | None | 200 | N/A |
| `GET /api/health/ready` | Readiness validation | Required | 200 | 503 |

**Kubernetes Integration:**
- **Liveness:** Validated against `/api/health/live`. Triggers container restart on failure. Isolates API process health from downstream database stability.
- **Readiness:** Validated against `/api/health/ready`. Triggers endpoint isolation from ingress routing upon database connectivity failure without forcing container restart.
- **Legacy:** The `/api/health` endpoint serves legacy automation targets (Jenkins, Terraform) requiring guaranteed HTTP 200 responses.

---

## Configuration Variables

Target deployment environments necessitate the specification of the following key parameters:

| Variable | Definition | Example Format |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://user:pass@host:5432/db` |
| `SECRET_KEY` | Cryptographic signing key | `openssl rand -hex 32` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token Time-To-Live | `60` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token Time-To-Live | `7` |
| `CORS_ORIGINS` | Cross-Origin authorized domains | `http://localhost:3000` |
| `AWS_REGION` | Target AWS infrastructure region | `us-east-1` |
| `S3_BUCKET_NAME` | Target S3 bucket identifier | `assemblemonitor-uploads` |
| `SMTP_HOST` | Outbound email relay | `smtp.gmail.com` |
| `APP_ENV` | Execution profile | `development` / `production` |

> [!NOTE]
> Within the EKS architecture, application secrets are securely injected via the External Secrets Operator interacting with AWS Secrets Manager. File-based `.env` sourcing is strictly for localized execution.

---

## Telemetry & Observability

### Prometheus Telemetry

Application metrics are automatically exposed via `prometheus-fastapi-instrumentator` at the `/metrics` endpoint. This data is ingested by the cluster-internal OpenTelemetry DaemonSet and dispatched to Amazon Managed Prometheus (AMP).

### Distributed Tracing (OTLP)

Trace instrumentation is executed via `FastAPIInstrumentor`, exporting spans through OTLP gRPC protocol to the internal OpenTelemetry Collector:

```text
FastAPI → OTLP gRPC (4317) → otel-collector.assemblemonitor.svc.cluster.local → Tempo → S3 → Grafana
```

The OTLP endpoint is dynamically bound via the `OTEL_EXPORTER_OTLP_ENDPOINT` variable during Helm chart deployment.

---

## Multi-Stage Dockerfile Architecture

The backend implements a two-stage container build to minimize runtime attack surface:

```text
Stage 1 (Compilation): python:3.11-slim
    - Installs build-essential + libpq-dev
    - Provisions /opt/venv
    - Executes `pip install -r requirements.txt`
    - Executes `opentelemetry-bootstrap -a install`

Stage 2 (Runtime): python:3.11-slim
    - Imports /opt/venv (excluding build tools)
    - Executes as unprivileged user (appuser)
    - Implements HEALTHCHECK via `/api/health`
    - Executes via `opentelemetry-instrument uvicorn`
```

The OTEL wrapper provisions auto-instrumentation across SQLAlchemy, asyncpg, httpx, and FastAPI subsystems.

---

## Local Development Execution

### Option A — Bare Metal

**Prerequisites:** Python 3.11+, PostgreSQL 14+.

```bash
cd backend

# Initialize virtual environment
python -m venv .venv
source .venv/bin/activate

# Provision dependencies
pip install -r requirements.txt

# Execute schema migrations
alembic upgrade head

# Bootstrap root credentials
python seed_admin.py

# Execute ASGI server
uvicorn app.main:app --reload --port 8000
```

### Option B — Docker Compose Stack

Initialize the complete application stack from the repository root:

```bash
docker compose up --build -d

# Execute schema migrations
docker compose exec api alembic upgrade head

# Bootstrap root credentials
docker compose exec api python seed_admin.py
```

| Service | Local Endpoint |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api/docs |
| Adminer | http://localhost:8080 |

---

## Schema Migrations (Alembic)

```bash
# Generate revision
alembic revision --autogenerate -m "revision_description"

# Execute pending revisions
alembic upgrade head

# Rollback single revision
alembic downgrade -1
```

> [!NOTE]
> Alembic relies on the synchronous `psycopg2` driver (`SYNC_DATABASE_URL`), while the FastAPI runtime utilizes the asynchronous `asyncpg` driver.

---

## Interface Previews

Asset registry for backend-specific telemetry components:

| Asset Reference | Scope |
|---|---|
| _08-fastapi-swagger.png_ | Swagger UI route inventory |
| _44-health-endpoint.png_ | Successful infrastructure health probe |
| _45-rds-migration-success.png_ | Successful Alembic execution against RDS |
