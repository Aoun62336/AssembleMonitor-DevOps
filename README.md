# AssembleMonitor

AssembleMonitor is a smart construction site management platform designed to track projects, manage tasks, monitor inventory, oversee expenses, and capture site photos.

---

## Directory Structure

```text
AssembleMonitor/
├── backend/
├── frontend/
├── docs/
├── k8s/
├── terraform/
└── Jenkinsfile
```

* **`backend/`** — High-performance REST API built with FastAPI, SQLAlchemy, and PostgreSQL.
* **`frontend/`** — Modern and responsive user interface built with React and Vite.
* **`docs/`** — Project documentation and database schemas.
* **`k8s/`** — Kubernetes manifests for container orchestration.
* **`terraform/`** — Infrastructure as Code (IaC) for cloud resource provisioning.
* **`Jenkinsfile`** — CI/CD automation pipeline.

---

## Prerequisites

Ensure you have the following installed:
* **Docker & Docker Compose** (Recommended containerized setup)
* **Node.js (v18+) & npm** (Optional: for local frontend development outside containers)
* **Python (v3.11+) & PostgreSQL (v14+)** (Optional: for local backend development outside containers)

---

## Setup & Execution

### 1. Environment Configuration

* **Root Directory (`.env`):**
  Create a `.env` file at the project root for container runtime variables:
  ```env
  POSTGRES_USER=your_postgres_user
  POSTGRES_PASSWORD=your_secure_password
  POSTGRES_PASSWORD_ENCODED=your_secure_password_url_encoded
  POSTGRES_DB=your_database_name
  ```

* **Backend Directory (`backend/.env`):**
  Create the backend configuration file from the template:
  ```bash
  # Windows
  copy backend\.env.example backend\.env

  # macOS / Linux
  cp backend/.env.example backend/.env
  ```
  *(Open `backend/.env` and update credentials such as DB URL, S3 credentials, and JWT keys).*

---

### 2. Run with Docker Compose

Build, start, and initialize the stack in a single sequence of commands:

```bash
# 1. Start all containers in the background
docker compose up --build -d

# 2. Apply database migrations
docker exec -it assemblemonitor_api alembic upgrade head

# 3. Seed default admin credentials
docker exec -it assemblemonitor_api python seed_admin.py
```

---

## Service Endpoints

Once the services are active, the following endpoints are available:

| Service | Port | Endpoint URL |
| :--- | :--- | :--- |
| **Frontend UI** | `3000` | [http://localhost:3000](http://localhost:3000) |
| **Backend API** | `8000` | [http://localhost:8000](http://localhost:8000) |
| **API Documentation** | `8000` | [http://localhost:8000/api/docs](http://localhost:8000/api/docs) |
| **Adminer (Database GUI)** | `8080` | [http://localhost:8080](http://localhost:8080) |
| **PostgreSQL Database** | `5432` | `localhost:5432` |

---

## Management Operations

### Stopping Services
To stop running containers and preserve data:
```bash
docker compose down
```

### Resetting the Database
To purge all data, reset database schemas, and seed a clean instance:
```bash
# Stop containers and delete volumes
docker compose down -v

# Start services
docker compose up -d

# Run migrations and seed admin user
docker exec -it assemblemonitor_api alembic upgrade head
docker exec -it assemblemonitor_api python seed_admin.py
```

---

## Tech Stack

* **Backend:** FastAPI, SQLAlchemy 2.0, Alembic, python-jose, bcrypt
* **Frontend:** React 18, Vite, React Router v6, Chart.js, Vanilla CSS
* **DevOps:** Docker, Docker Compose, Kubernetes, Terraform, Jenkins

---

## License

All rights reserved. AssembleMonitor by The Great MD.
