# AssembleMonitor — Cloud-Native Construction Site Management System

## Overview

AssembleMonitor is a comprehensive, full-stack construction site management platform engineered to demonstrate enterprise-grade DevOps and Cloud practices. The project showcases the complete lifecycle of a modern application: from a containerized local development environment to a highly available, distributed cloud architecture deployed natively on Kubernetes. 

## DevOps Implementation

This project was built from the ground up with a focus on automation, scalability, and observability, implementing the following core DevOps practices:

- **Cloud Infrastructure**: Architected a distributed microservices environment across optimized AWS EC2 compute nodes (`c7i-flex.large`), utilizing Auto Scaling Groups (ASG) and Application Load Balancers (ALB) for high availability.
- **Security & Secrets**: Protected by an AWS Web Application Firewall (WAF) to mitigate common exploits. Secrets are securely managed via AWS Secrets Manager.
- **Database Decoupling**: Integrated a highly available AWS RDS PostgreSQL instance to decouple database state and ensure reliable data persistence.
- **Storage**: Implemented AWS S3 for secure, scalable object storage (e.g., site photos).
- **Continuous Integration / Continuous Deployment (CI/CD)**: Engineered an automated pipeline using a dedicated Jenkins build server. The pipeline automatically orchestrates zero-downtime rolling updates to the Kubernetes cluster.
- **DevSecOps**: Enforced static code analysis (SonarQube) with strict, blocking Quality Gates, and container vulnerability scanning (Trivy) in the CI pipeline to prevent insecure deployments.
- **Configuration Management**: Automated the provisioning and configuration of dedicated servers using Ansible playbooks for reproducible, idempotent setups.
- **Infrastructure as Code (IaC)**: Provisioned all AWS infrastructure (VPC, EC2, ASG, ALB, WAF, RDS, S3, Secrets Manager, CloudWatch) using Terraform.
- **Container Orchestration**: Orchestrated the full-stack application natively on a dedicated Kubernetes (K3s) cluster, leveraging Deployments, NodePort Services, ConfigMaps, Secrets, Liveness/Readiness probes, and resource limits for self-healing.
- **Observability**: Deployed Prometheus, Grafana, and Node Exporter for application metrics, alongside AWS CloudWatch for centralized logging and infrastructure alarms.

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
- **Web Server**: Nginx (Running inside the frontend Pod)

## DevOps Tech Stack

- **Containerization**: Docker, Docker Compose, Docker Hub
- **Cloud Provider**: AWS (EC2, VPC, ALB, ASG, WAF, RDS, S3, Secrets Manager, CloudWatch, IAM)
- **CI/CD Automation**: Jenkins, GitHub Webhooks
- **DevSecOps**: SonarQube, Trivy
- **Infrastructure as Code**: Terraform
- **Configuration Management**: Ansible
- **Orchestration**: Kubernetes (K3s)
- **Observability**: Prometheus, Grafana, Node Exporter
- **Performance Testing**: k6

## Architecture

The production-style cloud architecture is distributed across multiple AWS EC2 `c7i-flex.large` instances to separate concerns, isolate workloads, and maximize security.

```text
User Browser
    |
    | HTTP
    v
AWS Web Application Firewall (WAF)
    |
    v
AWS Application Load Balancer (ALB)
    |
    |-------------------------------------------------------|
    v                                                       v
Auto Scaling Group (App Servers in Private Subnets)     Kubernetes (K3s) Cluster EC2 (Staging)
    |                                                       |
    ├── Frontend Docker Container                           ├── Frontend Pods
    |                                                       |
    └── Backend FastAPI Docker Container                    └── Backend API Pods
            |                                                       |
            |-------------------------------------------------------|
            v
      AWS Secrets Manager (Credentials)
            |
            |---------------------------------|
            |                                 |
            v                                 v
      AWS RDS PostgreSQL                   AWS S3

Jenkins Server EC2 (CI/CD Orchestrator)
    └── Builds Images -> Trivy Scan -> Pushes to Docker Hub -> Executes K3s Rollout

SonarQube Server EC2
    └── Performs Static Code Analysis and enforces Quality Gates

Monitoring Server EC2
    └── Native Observability Stack (Prometheus, Grafana, Node Exporter)

AWS CloudWatch
    └── Centralized Infrastructure Logging and Alarms
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

The application utilizes a distributed, multi-node AWS deployment strategy:
- **Auto Scaling Group (ASG) & ALB**: The highly available production environment running the application natively via Docker on dynamically scaled EC2 instances in private subnets, protected by an AWS WAF.
- **Kubernetes (K3s) Server**: A dedicated EC2 node acting as the Staging cluster, running the primary Frontend and Backend pods via Kubernetes.
- **Jenkins Server**: A dedicated EC2 node for CI/CD pipeline execution, Trivy vulnerability scanning, and container building.
- **SonarQube Server**: A dedicated EC2 node running static code analysis via an embedded Elasticsearch database.
- **Monitoring / App Server**: A standalone EC2 node actively running Prometheus, Grafana, and Node Exporter to monitor the infrastructure.
- **RDS**: Managed PostgreSQL ensuring automated backups, high availability, and decoupled state management.
- **S3**: Secure file storage utilizing IAM roles and policies to govern upload access.
- **Secrets Manager & CloudWatch**: Secure injection of credentials to the ASG instances and centralized monitoring.

## DevSecOps CI/CD Pipeline

A dedicated Jenkins server powers the automated CI/CD lifecycle. The pipeline (`Jenkinsfile-k3s`) executes:
1. **Source Code Checkout** from GitHub.
2. **SonarQube Static Analysis** and strict Quality Gate enforcement (pipeline aborts if code is insecure).
3. **Docker Image Build** for the frontend and backend.
4. **Trivy Container Scan** to detect HIGH and CRITICAL vulnerabilities in the built images.
5. **Docker Hub Push** to the centralized image registry.
6. **Kubernetes Rollout** to the K3s server via zero-downtime dynamic image tagging over the private AWS network.

## Terraform IaC

Terraform is actively utilized to codify and automate the provisioning of the entire AWS environment, including:
- Custom VPC, Public/Private Subnets, and NAT Gateway
- Auto Scaling Groups (ASG) and Launch Templates using dynamic `user_data`
- Application Load Balancers (ALB) and Web Application Firewalls (WAF)
- Stateful and stateless EC2 instances (Jenkins, SonarQube, K3s, Monitoring)
- Strict Security Group rules
- The RDS PostgreSQL database
- The S3 Bucket
- AWS Secrets Manager and IAM Instance Profiles
- CloudWatch Log Groups and Metric Alarms

## Kubernetes

The application is natively orchestrated via Kubernetes (K3s). Manifests provided in the `k8s/` directory leverage advanced orchestration features:
- **Deployments & Services**: Managing the lifecycle of the FastAPI and React pods, exposed publicly via NodePorts.
- **Self-Healing**: Configured `livenessProbe` and `readinessProbe` to automatically restart unhealthy containers and drop them from the traffic pool.
- **Resource Management**: Implemented CPU/Memory requests and limits (`requests: 100m, limits: 500m`) to prevent node starvation.
- **Configuration Management**: Decoupled environment variables via ConfigMaps and Secrets.

## Monitoring and Operations

- **Prometheus**: Aggregates time-series metrics from both the application and the underlying infrastructure.
- **Grafana**: Provides centralized visual dashboards for real-time alerting and deep system introspection.
- **Node Exporter**: Exposes deep hardware and OS-level metrics.
- *Configuration files (`prometheus.yml`, `grafana.ini`, `systemd` services) are version-controlled in the `monitoring/` directory following Configuration as Code best practices.*

## Security and Cost Optimization

- **Security**: Enforced through DevSecOps vulnerability scanning, least-privilege IAM roles, private RDS network isolation, strictly scoped EC2 security groups, secure Jenkins credential injection, and S3 Block Public Access.
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
