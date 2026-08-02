# 🐳 Option 1: Local Docker Development (The Foundation)

> [!TIP]
> This is the foundational deployment strategy used for rapid prototyping, local development, and testing. It simulates the production environment locally using Docker Compose without requiring any AWS infrastructure.

**Best For:** Development, Local Testing, Code Review
**Complexity:** Low
**Tech Stack:** Docker, Docker Compose

## 📋 Prerequisites

- Docker Engine & Docker Compose installed
- Git

## 🚀 Step-by-Step Instructions

1. **Clone the Repository**

   ```bash
   git clone <repository_url>
   cd AssembleMonitor
   ```

2. **Spin Up the Containers**
   This command reads the `docker-compose.yml` file in the root directory to build the frontend, backend, and a local PostgreSQL database container.

   ```bash
   docker compose up --build -d
   ```

3. **Run Database Migrations**
   Initialize the database schema using Alembic:

   ```bash
   docker compose exec api alembic upgrade head
   ```

4. **Seed the Admin User**
   Create the initial admin user to log into the application:
   ```bash
   docker compose exec api python seed_admin.py
   ```

## 🌐 Accessing the Application

- **Frontend App**: `http://localhost:3000`
- **Backend API Swagger**: `http://localhost:8000/api/docs`
- **Adminer DB UI**: `http://localhost:8080`

## 🛑 Stopping the Environment

When you are done testing, cleanly shut down the containers and preserve data:

```bash
docker compose down
```

_(To wipe the database entirely, add the `-v` flag to delete the associated volumes)._
