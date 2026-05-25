# AssembleMonitor — Backend API

Production-ready FastAPI backend for the AssembleMonitor construction
management platform.

## Tech Stack

| Layer | Library |
|---|---|
| Web framework | FastAPI 0.111 |
| Server | Uvicorn (async) |
| ORM | SQLAlchemy 2.0 (async) |
| DB driver | asyncpg (runtime) / psycopg2 (Alembic) |
| Database | PostgreSQL 16 |
| Migrations | Alembic |
| Auth | python-jose (JWT) + passlib/bcrypt |
| Config | pydantic-settings v2 |
| Validation | Pydantic v2 |

---

## Project Structure

```
backend/
├── app/
│   ├── core/
│   │   ├── config.py       ← Settings (pydantic-settings, .env)
│   │   └── security.py     ← JWT + bcrypt helpers
│   ├── db/
│   │   ├── base.py         ← SQLAlchemy DeclarativeBase
│   │   └── session.py      ← Async engine + session factory
│   ├── models/             ← ORM models (add here)
│   ├── schemas/            ← Pydantic request/response schemas
│   ├── routers/
│   │   ├── health.py       ← GET /api/health  ✅ implemented
│   │   ├── auth.py         ← ✅ implemented
│   │   ├── users.py        ← ✅ implemented
│   │   ├── projects.py     ← ✅ implemented
│   │   └── tasks.py        ← ✅ implemented
│   ├── utils/
│   │   ├── datetime_utils.py
│   │   └── pagination.py
│   ├── dependencies.py     ← FastAPI Depends() callables
│   └── main.py             ← App factory + CORS + router registration
├── alembic/
│   ├── env.py              ← Alembic migration environment
│   ├── script.py.mako      ← Migration script template
│   └── versions/           ← Generated migration files (empty initially)
├── .env.example            ← Copy to .env and fill in values
├── .gitignore
├── alembic.ini
├── Dockerfile              ← Multi-stage production build
├── docker-compose.yml      ← API + PostgreSQL + Adminer
└── requirements.txt
```

---

## Quick Start (Local — no Docker)

### 1. Prerequisites
- Python 3.11+
- PostgreSQL 14+ running locally

### 2. Clone & install
```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Configure environment
```bash
copy .env.example .env     # Windows
# cp .env.example .env      # macOS/Linux
# Edit .env with your DB credentials and secret key
```

### 4. Create the database
```sql
-- In psql or pgAdmin:
CREATE DATABASE assembledb;
CREATE USER assembleuser WITH PASSWORD 'assemblepass';
GRANT ALL PRIVILEGES ON DATABASE assembledb TO assembleuser;
```

### 5. Run migrations
```bash
alembic upgrade head
```

### 6. Start the server
```bash
uvicorn app.main:app --reload --port 8000
```

### 7. Verify
- API docs: http://localhost:8000/api/docs
- Health:   http://localhost:8000/api/health

---

## Quick Start (Docker Compose)

```bash
cd backend
copy .env.example .env     # then fill in SECRET_KEY
docker compose up --build
```

- API: http://localhost:8000/api/docs
- Health: http://localhost:8000/api/health
- Adminer (DB GUI): `docker compose --profile tools up` → http://localhost:8080

---

## Running Migrations

```bash
# After adding/modifying a model:
alembic revision --autogenerate -m "describe_the_change"
alembic upgrade head

# Roll back last migration:
alembic downgrade -1
```

---

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions.

Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:5432/dbname` |
| `SECRET_KEY` | Random 32-byte hex string — **never share** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT access token TTL (default 60) |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins |

---

## API Endpoints

| Method | Path | Status |
|---|---|---|
| GET | `/api/health` | ✅ Implemented |
| POST | `/api/v1/auth/login` | ✅ Implemented |
| POST | `/api/v1/auth/refresh` | ✅ Implemented |
| GET | `/api/v1/users` | ✅ Implemented |
| GET/POST | `/api/v1/projects` | ✅ Implemented |
| GET/POST | `/api/v1/tasks` | ✅ Implemented |
