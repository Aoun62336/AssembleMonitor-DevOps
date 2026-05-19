# AssembleMonitor

AssembleMonitor is a smart construction site management platform designed to track projects, manage tasks, monitor inventory, oversee expenses, and capture site photos. 

The application is split into two main components:
- **`backend/`**: A high-performance REST API built with FastAPI, SQLAlchemy, and PostgreSQL.
- **`frontend/`**: A dynamic and responsive UI built with React and Vite.

---

## Project Structure

```text
AssembleMonitor/
├── backend/          # FastAPI application, database models, and API logic
├── frontend/         # React, Vite, components, pages, and static assets
├── docs/             # Project documentation and schema files
├── k8s/              # Kubernetes deployment manifests
├── terraform/        # Infrastructure as Code (IaC) for cloud provisioning
├── Jenkinsfile       # CI/CD pipeline configuration
└── README.md         # Project overview and setup instructions
```

---

## Prerequisites

To run this project locally, you will need:
- **Node.js** (v18+) and **npm** for the frontend.
- **Python** (3.11+) for the backend.
- **PostgreSQL** (v14+) running locally (or via Docker) for the database.
- **Docker** & **Docker Compose** (optional, but recommended for easy backend deployment).

---

## Quick Start: Backend

The backend provides the RESTful API and manages the database.

### Option 1: Using Docker Compose (Recommended)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Copy the environment variables example file:
   ```bash
   copy .env.example .env     # On Windows
   # cp .env.example .env     # On macOS/Linux
   ```
3. Open `.env` and fill in your desired `SECRET_KEY` and database credentials.
4. Spin up the API and PostgreSQL containers:
   ```bash
   docker compose up --build
   ```
5. The API will be available at `http://localhost:8000/api/docs`.

### Option 2: Local Setup (Without Docker)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate      # On Windows
   # source .venv/bin/activate # On macOS/Linux
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up your `.env` file from `.env.example` and configure your local PostgreSQL credentials.
5. Run the database migrations:
   ```bash
   alembic upgrade head
   ```
6. Start the server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

*(For more details, see the `backend/README.md` file.)*

---

## Quick Start: Frontend

The frontend is a Vite-powered React application. It uses a proxy to automatically route `/api` requests to the backend.

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the Node.js dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173`.

---

## Architecture & Tech Stack

**Backend:**
- **Framework**: FastAPI (Async)
- **Database**: PostgreSQL with SQLAlchemy 2.0 ORM
- **Migrations**: Alembic
- **Auth**: JWT via python-jose & bcrypt

**Frontend:**
- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Styling**: Custom CSS and Material Symbols
- **Charting**: Chart.js

**DevOps & Infrastructure:**
- **Containerization**: Docker & Docker Compose
- **Orchestration**: Kubernetes (k8s)
- **Infrastructure as Code**: Terraform
- **CI/CD**: Jenkins

---

## License
All rights reserved. AssembleMonitor.
