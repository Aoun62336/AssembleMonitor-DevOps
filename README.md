# AssembleMonitor — Cloud-Native Construction Site Management System

## Overview

AssembleMonitor is a comprehensive, full-stack construction site management platform engineered to demonstrate enterprise-grade DevOps and Cloud practices. The project showcases the complete lifecycle of a modern application: from a containerized local development environment to a highly available, distributed cloud architecture deployed on AWS. 

## DevOps Implementation

This project was built from the ground up with a focus on automation, scalability, and observability, implementing the following core DevOps practices:

- **Cloud Infrastructure**: Architected a distributed microservices environment across optimized AWS EC2 compute nodes (`c7i-flex.large`).
- **Database Decoupling**: Integrated a highly available AWS RDS PostgreSQL instance to decouple database state and ensure reliable data persistence.
- **Storage**: Implemented AWS S3 for secure, scalable object storage (e.g., site photos).
- **Traffic Routing**: Configured Nginx as an edge reverse proxy to route external traffic securely to backend containers.
- **Continuous Integration / Continuous Deployment (CI/CD)**: Engineered an automated pipeline using a dedicated Jenkins build server. The pipeline is auto-triggered via GitHub Webhooks to build, test, and deploy seamlessly.
- **DevSecOps**: Enforced static code analysis (SonarQube) with strict Quality Gates and container vulnerability scanning (Trivy) in the CI pipeline to prevent insecure deployments.
- **Configuration Management**: Automated the provisioning and configuration of dedicated servers using Ansible playbooks for reproducible, idempotent setups.
- **Infrastructure as Code (IaC)**: Provisioned all AWS infrastructure (EC2, Security Groups, RDS, S3) using Terraform.
- **Container Orchestration**: Orchestrated the full-stack application using Kubernetes, leveraging Deployments, Services, ConfigMaps, Secrets, Liveness/Readiness probes, and resource limits for self-healing.
- **Observability**: Deployed Prometheus, Grafana, and Node Exporter natively on the App Server to achieve deep, centralized system and application monitoring.

## Features

- **Role-Based Access Control (RBAC)**: Secure, distinct dashboards for Admins, Project Managers, Site Engineers, and Clients.
- **Phase & Task Management**: Break down construction projects into trackable phases and executable tasks.
- **Material Management**: Monitor inventory deliveries, stock levels, and daily resource consumption.
- **Site Photos**: Direct, secure upload of construction progress photos to AWS S3.
- **Attendance & Expenses**: Track engineer working hours and log non-material project expenses.

## Application Tech Stack

- **Frontend**: React, Vite, HTML, CSS, Vanilla JavaScript
- **Backend API**: Python FastAPI, SQLAlchemy, Alembic (Migrations)
- **Database**: PostgreSQL (AWS RDS)
- **Storage**: AWS S3
- **Authentication**: JWT (JSON Web Tokens)
- **Reverse Proxy**: Nginx

## DevOps Tech Stack

- **Containerization**: Docker, Docker Compose, Docker Hub
- **Cloud Provider**: AWS (EC2, RDS, S3, Security Groups, IAM)
- **CI/CD Automation**: Jenkins, GitHub Webhooks
- **DevSecOps**: SonarQube, Trivy
- **Infrastructure as Code**: Terraform
- **Configuration Management**: Ansible
- **Orchestration**: Kubernetes (K8s)
- **Observability**: Prometheus, Grafana, Node Exporter
- **Performance Testing**: k6

## Architecture

The production-style cloud architecture is distributed across multiple AWS EC2 `c7i-flex.large` instances to separate concerns, isolate workloads, and maximize security.

```text
User Browser
    |
    v
App Server EC2 Public IP / Nginx Reverse Proxy :80
    |
    ├── Frontend Container (React)
    |
    ├── Backend API Container (FastAPI)
    |       |
    |       ├── AWS RDS PostgreSQL (Managed Database)
    |       └── AWS S3 Bucket (Object Storage)
    |
    └── Native Observability Stack (Prometheus, Grafana, Node Exporter)

Jenkins Server EC2
    └── CI/CD Automation (Auto-triggered via Webhooks -> Build, Push, SSH Deploy)

Kubernetes Server EC2
    └── K8s Orchestration (Frontend/Backend Deployments, ConfigMaps, Secrets, Probes)
```

## Local Development Environment

For rapid local testing and development, the application utilizes a streamlined Docker Compose environment:

```bash
docker compose up --build -d
docker compose exec api alembic upgrade head
```

- **Frontend**: `http://localhost:3000`
- **Backend API Docs**: `http://localhost:8000/docs`
- **Adminer DB UI**: `http://localhost:8080`

## AWS Deployment

The application utilizes a multi-node AWS deployment strategy:
- **App Server**: A powerful EC2 node running the primary Frontend, Backend, and Nginx containers. To minimize overhead and maximize visibility, Prometheus, Grafana, and Node Exporter are installed natively as systemd services on this host.
- **RDS**: Managed PostgreSQL ensuring automated backups, high availability, and decoupled state management.
- **S3**: Secure file storage utilizing IAM roles and policies to govern upload access.

## CI/CD Pipeline

A dedicated Jenkins server powers the automated CI/CD lifecycle. Triggered by GitHub Webhooks on every push, the pipeline executes:
1. Source code checkout and validation.
2. Building Frontend assets and Backend Python environments.
3. Building immutable Docker images and pushing them to Docker Hub.
4. Secure SSH deployment to the live App Server.
5. Automated Alembic database schema migrations.
6. Post-deployment health checks to ensure service stability.

## Terraform IaC

Terraform is actively utilized to codify and automate the provisioning of the entire AWS environment, including:
- Stateful and stateless EC2 instances
- Strict Security Group rules
- The RDS PostgreSQL database
- The S3 Bucket

## Kubernetes

While the application can run in a streamlined Docker Compose setup, it is fully architected for Kubernetes. Manifests provided in the `k8s/` directory leverage advanced orchestration features:
- **Deployments & Services**: Managing the lifecycle of the FastAPI and React pods.
- **Self-Healing**: Configured `livenessProbe` and `readinessProbe` to automatically restart unhealthy containers and drop them from the traffic pool.
- **Resource Management**: Implemented CPU/Memory requests and limits (`requests: 100m, limits: 500m`) to prevent node starvation.
- **Configuration Management**: Decoupled environment variables via ConfigMaps and Secrets.

## Monitoring and Operations

- **Prometheus**: Aggregates time-series metrics from both the application and the underlying infrastructure.
- **Grafana**: Provides centralized visual dashboards for real-time alerting and deep system introspection.
- **Node Exporter**: Exposes deep hardware and OS-level metrics.
- *Configuration files (`prometheus.yml`, `grafana.ini`, `systemd` services) are version-controlled in the `monitoring/` directory following Configuration as Code best practices.*

## Security and Cost Optimization

- **Security**: Enforced through least-privilege IAM roles, private RDS network isolation, strictly scoped EC2 security groups, secure Jenkins credential injection, and S3 Block Public Access.
- **Cost**: Actively optimized by suspending idle EC2 instances, managing RDS snapshot retention, releasing unused Elastic IPs, and configuring granular AWS Budget alerts.

## Screenshots

Below is a highlight of the infrastructure and application. For the complete, comprehensive gallery covering all aspects (AWS, CI/CD, Kubernetes, Monitoring, Security), please see the full [Screenshots Checklist](docs/SCREENSHOTS.md) and the `docs/screenshots/` directory.

### Architecture
*(Add your architecture diagram here: `docs/screenshots/01-architecture-diagram.png`)*

### Application
*(Add your landing page or dashboard here: `docs/screenshots/02-landing-page.png`)*

### AWS Infrastructure
*(Add your EC2 instances or ALB screenshot here: `docs/screenshots/14-ec2-instances.png`)*

### CI/CD
*(Add your Jenkins pipeline success here: `docs/screenshots/27-jenkins-pipeline-success.png`)*

### Kubernetes
*(Add your cluster overview or pods here: `docs/screenshots/30-kubectl-get-pods.png`)*

### Monitoring
*(Add your Grafana dashboard here: `docs/screenshots/34-grafana-dashboard.png`)*

## Documentation

Extensive operational runbooks and architectural documentation can be found in the `docs/` folder:
- Architecture Design Details
- CI/CD Pipeline Flows
- Step-by-Step Deployment Guides
- Terraform & Kubernetes Initialization
- Security & Hardening Checklists
- Backup, Restore & Rollback Plans

## Resume Highlights

Please refer to `docs/RESUME_POINTS.md` for high-impact, quantifiable bullet points tailored for Cloud and DevOps Engineering resumes based on this infrastructure.
