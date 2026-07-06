# AssembleMonitor — DevOps Enabled Construction Site Management System

AssembleMonitor is a full-stack construction site management system built with a FastAPI backend, PostgreSQL database, AWS S3 file storage, and a Vite/React-based frontend. The project was enhanced with end-to-end DevOps practices including Docker, Docker Compose, AWS deployment, RDS, Nginx reverse proxy, Jenkins CI/CD, Terraform IaC, Kubernetes manifests, monitoring, security hardening, backup planning, and cost optimization.

## Project Objective

The goal of this project is to demonstrate practical DevOps implementation on a real full-stack application instead of a sample or dummy app. The system was containerized, deployed on a multi-server AWS architecture, connected to managed cloud services, automated through Jenkins, and documented for operational readiness.

## Application Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript, React/Vite for routing |
| Backend | Python FastAPI |
| Database | PostgreSQL |
| ORM/Migrations | SQLAlchemy, Alembic |
| Storage | AWS S3 |
| Authentication | JWT |
| Web Server / Proxy | Nginx |

## DevOps Tech Stack

| Area | Tools |
|---|---|
| Version Control | Git, GitHub |
| Containerization | Docker |
| Local Orchestration | Docker Compose |
| Image Registry | Docker Hub |
| Cloud Platform | AWS |
| Compute | AWS EC2 (Multiple c7i-flex.large servers) |
| Managed Database | AWS RDS PostgreSQL |
| Object Storage | AWS S3 |
| Reverse Proxy | Nginx |
| CI/CD | Jenkins |
| Infrastructure as Code | Terraform |
| Kubernetes | Kubernetes manifests |
| Monitoring | Prometheus, Grafana, Node Exporter, Docker logs, Nginx logs |
| Testing | k6 performance tests, CI quality gates |

## DevOps Implementation Summary

- Containerized FastAPI backend and Vite/React frontend using Docker.
- Created Docker Compose setup for local full-stack development.
- Pushed backend and frontend images to Docker Hub.
- Deployed a multi-server architecture on AWS EC2 (Jenkins Server, App/Monitoring Server, Kubernetes Server).
- Migrated PostgreSQL database from container to AWS RDS.
- Integrated AWS S3 for site photo/file storage.
- Configured Nginx reverse proxy for clean access through port 80.
- Created Jenkins CI/CD pipeline for Docker build, push, deployment, migration, and health checks on a dedicated CI/CD server.
- Prepared Terraform configuration for EC2 instances, RDS, S3, and security groups.
- Created Kubernetes manifests for frontend/backend deployments, services, ConfigMap, and Secrets.
- Added comprehensive monitoring with Prometheus, Grafana, and Node Exporter alongside logging, troubleshooting, backup, rollback, security, performance, and cost optimization documentation.

## Architecture

The cloud architecture is distributed across multiple AWS EC2 `c7i-flex.large` instances to separate concerns.

```text
User Browser
    |
    v
App Server EC2 Public IP / Nginx Reverse Proxy :80
    |
    ├── Frontend Container
    |
    ├── Backend FastAPI Container
    |       |
    |       ├── AWS RDS PostgreSQL
    |       └── AWS S3 Bucket
    |
    └── Native System Services (Prometheus, Grafana, Node Exporter)

Jenkins Server EC2
    └── CI/CD Automation (Build, Push, SSH Deploy to App Server)

Kubernetes Server EC2
    └── K8s Orchestration (Frontend/Backend Deployments, Services)
```

## Local Docker Setup

For local development, use Docker Compose:

```bash
docker compose up --build -d
```

- **Backend Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Adminer**: [http://localhost:8080](http://localhost:8080)

## AWS Deployment

The application is deployed on AWS using a multi-server approach:
- **App Server**: EC2 instance running Docker Compose for the Frontend, Backend, and Nginx. Prometheus, Grafana, and Node Exporter run as native systemd services on this server.
- **RDS**: Managed PostgreSQL database.
- **S3**: File storage for uploads.

Public access: `http://APP_SERVER_EC2_PUBLIC_IP`
Health check: `http://APP_SERVER_EC2_PUBLIC_IP/api/health`

## CI/CD Pipeline

Jenkins is hosted on its own dedicated EC2 server. The pipeline stages include:
- Checkout source code
- Backend compile check & Frontend build validation
- Docker image build
- Docker Hub login & Push backend/frontend images
- SSH deployment to the App Server EC2
- Alembic migration
- Post-deployment health check

## Infrastructure as Code

Terraform configuration provisions:
- Multiple EC2 instances
- Security groups
- RDS PostgreSQL
- S3 bucket

Terraform is validated using `terraform init`, `terraform fmt`, `terraform validate`, and `terraform plan`.

## Kubernetes Deployment

While the main app currently runs via Docker Compose on the App Server, it is also fully containerized for Kubernetes. The setup can be seamlessly launched on the dedicated K8s Server. Manifests are provided for Deployments, Services, ConfigMaps, and Secrets.

## Monitoring and Logging

The monitoring stack includes:
- **Prometheus** for metrics collection.
- **Grafana** for visualizations and dashboards.
- **Node Exporter** for server-level metrics.
- Logs are managed via Docker logs and Nginx access/error logs.

## Security Practices

Security is enforced through IAM restrictions, private RDS access, restricted EC2 security groups, Jenkins credential management, exclusion of secrets from Git, and S3 Block Public Access. Detailed in `docs/SECURITY_CHECKLIST.md`.

## Backup and Rollback

Rollbacks can be performed manually by changing image tags in `docker-compose.rds.yml` or via Jenkins by redeploying a previous build. Backups are managed using RDS snapshots and manual `pg_dump`. Detailed in `docs/BACKUP_RECOVERY.md` and `docs/ROLLBACK_PLAN.md`.

## Performance Testing

Performance and load testing are conducted using `k6` against key endpoints (Health, Frontend, Login). Details in `docs/PERFORMANCE_TESTING.md`.

## Cost Optimization

AWS costs are minimized by actively stopping idle EC2 instances, managing RDS snapshots, releasing unused Elastic IPs, and utilizing AWS Budget alerts. Details in `docs/COST_OPTIMIZATION.md`.

## Screenshots

Please see `docs/SCREENSHOTS.md` for a visual overview of the application, Jenkins pipelines, Kubernetes pods, AWS resources, and Grafana monitoring dashboards.

## Project Status

This project is built as a practical DevOps portfolio project for learning, college demonstration, and fresher Cloud/DevOps Engineer job preparation. It is fully operational and demo-ready.

## Resume Highlights

Please see `docs/RESUME_POINTS.md` for resume-ready bullet points highlighting the comprehensive DevOps achievements in this project.
