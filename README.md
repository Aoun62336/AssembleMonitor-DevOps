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
- **Container Orchestration**: Orchestrated the full-stack application natively on a highly available Amazon EKS (Elastic Kubernetes Service) cluster, leveraging Deployments, NodePort Services, ConfigMaps, Secrets, Liveness/Readiness probes, and Horizontal Pod Autoscalers (HPA).
- **Observability**: Deployed Kubernetes Metrics Server for auto-scaling, alongside AWS CloudWatch for centralized logging and infrastructure alarms.

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
- **Orchestration**: Amazon EKS (Elastic Kubernetes Service), Kubernetes Metrics Server, Horizontal Pod Autoscaler (HPA)
- **Observability**: AWS CloudWatch, Kubernetes Metrics Server
- **Performance Testing**: k6

## Architecture

The production-style cloud architecture is distributed across multiple AWS EC2 `c7i-flex.large` instances to separate concerns, isolate workloads, and maximize security.

```text
User Browser
    |
    | HTTP
    v
AWS Web Application Firewall (WAF) [Inspects & Filters]
    |
    v
AWS Application Load Balancer (ALB)
    |
    | (Routes traffic via port 30080)
    v
Amazon EKS Managed Node Group (c7i-flex.large EC2 instances)
    |
    |-- Nginx Service (NodePort)
    |       └── Frontend React Pods (Auto-scaled via HPA)
    |
    └── FastAPI Service (ClusterIP)
            └── Backend API Pods (Auto-scaled via HPA)
                    |
                    |--> AWS Secrets Manager (Credentials)
                    |--> AWS RDS PostgreSQL (Stateful Data)
                    |--> AWS S3 (Site Photos)

Jenkins Server EC2 (CI/CD Orchestrator)
    └── Builds Images -> Trivy Scan -> Pushes to Docker Hub -> Executes EKS Rollout

AWS CloudWatch
    └── Centralized Infrastructure Logging, WAF Metrics, and Alarms
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

## Deployment Architectures (Evolution)

This project evolved through multiple deployment architectures, demonstrating progressive mastery of Cloud and DevOps engineering. Each strategy is fully documented in the `docs/deployments/` directory.

| Architecture | Best For | Tech Stack | Complexity | Documentation |
|---|---|---|---|---|
| **Local Docker** | Rapid Prototyping / Development | Docker Compose | Low | [View Guide](docs/deployments/01-LOCAL-DOCKER.md) |
| **Manual EC2 (Legacy)** | Staging / Pre-Kubernetes | Docker, AWS EC2, ASG, ALB | Medium | [View Guide](docs/deployments/02-MANUAL-EC2.md) |
| **K3s Cluster** | Standalone Orchestration | Kubernetes (K3s), Jenkins | High | [View Guide](docs/deployments/03-K3S-CLUSTER.md) |
| **Amazon EKS (Prod)** | Enterprise Production | EKS, ALB, AWS WAF, HPA | Very High | [View Guide](docs/deployments/04-AWS-EKS-PROD.md) |

### Enterprise Production Infrastructure (Amazon EKS)
The primary, active production architecture utilizes a distributed, cloud-native AWS deployment strategy:
- **Amazon EKS**: A highly available managed Kubernetes control plane with a managed Node Group (EC2 `c7i-flex.large`) running the Frontend and Backend pods. Protected by an AWS WAF and exposed securely via an Application Load Balancer (ALB) attached directly to the EKS NodePorts.
- **Horizontal Pod Autoscaler (HPA)**: Dynamically scales the frontend and backend pods between 2 to 5 replicas based on CPU utilization provided by the Kubernetes Metrics Server.
- **Jenkins Server**: A dedicated EC2 node for CI/CD pipeline execution, Trivy vulnerability scanning, and container building.
- **RDS**: Managed PostgreSQL ensuring automated backups, high availability, and decoupled state management in private subnets.
- **S3**: Secure file storage for construction site photos.
- **Secrets Manager & CloudWatch**: Secure injection of database/JWT credentials to the EKS pods and centralized metrics/alarms.

## DevSecOps CI/CD Pipeline

A dedicated Jenkins server powers the automated CI/CD lifecycle. The pipeline (`Jenkinsfile-k3s`) executes:
1. **Source Code Checkout** from GitHub.
2. **SonarQube Static Analysis** and strict Quality Gate enforcement (pipeline aborts if code is insecure).
3. **Docker Image Build** for the frontend and backend.
4. **Trivy Container Scan** to detect HIGH and CRITICAL vulnerabilities in the built images.
5. **Docker Hub Push** to the centralized image registry.
6. **Kubernetes Rollout** to the EKS cluster via zero-downtime dynamic image tagging over the private AWS network.

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

## Kubernetes (Amazon EKS)

The application is natively orchestrated via Amazon EKS. Manifests provided in the `k8s/eks-advanced/` directory leverage advanced enterprise orchestration features:
- **Deployments & Services**: Managing the lifecycle of the FastAPI and React pods. The frontend is exposed via a robust NodePort service directly bound to an external AWS Application Load Balancer.
- **Auto-Scaling (HPA)**: Kubernetes Metrics Server feeds real-time CPU data to the Horizontal Pod Autoscaler, enabling the application to seamlessly absorb traffic spikes.
- **Self-Healing**: Configured `livenessProbe` and `readinessProbe` to automatically restart unhealthy containers and drop them from the ALB traffic pool.
- **Dynamic Configuration**: Nginx proxy configuration injected dynamically at runtime via `ConfigMaps` to ensure flawless backend routing without hardcoded images.
- **Secrets Injection**: Decoupled environment variables injected via Kubernetes `Secrets`.

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
