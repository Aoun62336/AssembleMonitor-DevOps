# AssembleMonitor — DevOps Enabled Construction Site Management System

## Overview

AssembleMonitor is a full-stack construction site management system built with a FastAPI backend, PostgreSQL database, AWS S3 file storage, and a Vite/React-based frontend. The primary goal of this project is to demonstrate practical, end-to-end DevOps implementation on a real application, moving from local containers to a distributed, highly-available cloud architecture.

## DevOps Implementation

This project demonstrates end-to-end DevOps practices on a real full-stack application:

- Dockerized the FastAPI backend and Vite/React frontend.
- Created a Docker Compose setup for local development.
- Pushed Docker images to Docker Hub.
- Deployed containers across a multi-server AWS EC2 architecture (`c7i-flex.large`).
- Used AWS RDS PostgreSQL for a managed, scalable database.
- Used AWS S3 for secure object and file storage.
- Configured an Nginx reverse proxy.
- Implemented a Jenkins CI/CD pipeline for automated testing and deployment.
- Prepared Terraform IaC configuration for infrastructure provisioning.
- Created Kubernetes manifests for orchestration practice.
- Added comprehensive monitoring (Prometheus, Grafana, Node Exporter) natively on the App Server.
- Configured security, backup, rollback, performance testing, and cost optimization documentation.

## Features

- **Role-Based Access Control**: Separate dashboards for Admin, Project Manager, Site Engineer, and Client.
- **Phase & Task Management**: Break down construction projects into trackable phases and executable tasks.
- **Material Management**: Track inventory deliveries, stock levels, and daily usage.
- **Site Photos**: Direct upload of construction progress photos to AWS S3.
- **Attendance & Expenses**: Track engineer working hours and log non-material project expenses.

## Application Tech Stack

- **Frontend**: HTML, CSS, Vanilla JavaScript, React/Vite
- **Backend**: Python FastAPI, SQLAlchemy, Alembic
- **Database**: PostgreSQL (AWS RDS)
- **Storage**: AWS S3
- **Authentication**: JWT Auth
- **Reverse Proxy**: Nginx

## DevOps Tech Stack

- **Containerization**: Docker, Docker Compose, Docker Hub
- **Cloud Platform**: AWS (EC2, RDS, S3, Security Groups, IAM)
- **CI/CD**: Jenkins
- **Infrastructure as Code**: Terraform
- **Orchestration**: Kubernetes
- **Monitoring & Observability**: Prometheus, Grafana, Node Exporter
- **Performance Testing**: k6

## Architecture

The cloud architecture is distributed across multiple AWS EC2 `c7i-flex.large` instances to separate concerns safely.

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

## Local Setup

For local development, use the provided Docker Compose setup:

```bash
docker compose up --build -d
docker compose exec api alembic upgrade head
```

- **Frontend**: `http://localhost:3000`
- **Backend API Docs**: `http://localhost:8000/docs`
- **Adminer DB UI**: `http://localhost:8080`

## AWS Deployment

The application is deployed on AWS using a robust multi-server approach:
- **App Server**: An EC2 instance running Docker Compose for the Frontend, Backend, and Nginx. Prometheus, Grafana, and Node Exporter run as native systemd services on this server for performance.
- **RDS**: Managed PostgreSQL database allowing decoupled state management.
- **S3**: Secure file storage for uploads.

## CI/CD Pipeline

Jenkins is hosted on its own dedicated EC2 server. The pipeline automates:
1. Source code checkout
2. Code compilation and frontend build validation
3. Docker image building (Backend & Frontend)
4. Docker Hub authentication and image pushing
5. SSH deployment to the App Server EC2
6. Alembic database migration execution
7. Post-deployment health checks

## Terraform IaC

Terraform configuration is prepared to automate the provisioning of:
- Multiple EC2 instances
- Security groups
- RDS PostgreSQL
- S3 bucket

## Kubernetes

While the live app runs via Docker Compose on the App Server, it is also fully containerized for Kubernetes. Manifests (Deployments, Services, ConfigMaps, Secrets) are provided to seamlessly launch the stack on the dedicated K8s Server.

## Monitoring and Operations

- **Prometheus**: Metrics collection.
- **Grafana**: Visualizations and dashboards.
- **Node Exporter**: Server-level metrics.
- Monitoring services are installed natively on the EC2 instances. Configuration files are version-controlled in the `monitoring/` directory.

## Security and Cost Optimization

- **Security**: Enforced through IAM restrictions, private RDS access, restricted EC2 security groups, Jenkins credential management, and S3 Block Public Access.
- **Cost**: Optimized by actively stopping idle EC2 instances, managing RDS snapshots, releasing unused Elastic IPs, and utilizing AWS Budget alerts.

## Screenshots

Please see the `docs/screenshots/` directory and `docs/SCREENSHOTS.md` for visual proof of the application, CI/CD pipelines, Kubernetes pods, AWS resources, and Grafana monitoring dashboards.

## Documentation

Extensive operational documentation can be found in the `docs/` folder:
- Architecture Details
- CI/CD Pipelines
- Deployment Guides
- Terraform & Kubernetes setups
- Security Checklists
- Backup & Rollback plans

## Resume Highlights

Please see `docs/RESUME_POINTS.md` for strong, action-oriented bullet points tailored for a Cloud/DevOps Engineer resume based on this project.
