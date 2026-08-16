# AssembleMonitor Documentation

Welcome to the AssembleMonitor documentation directory. This repository contains enterprise-grade documentation covering architecture design, infrastructure, CI/CD, security, operations, and deployment guides.

---

## 📁 [architecture/](architecture/)

System design, component diagrams, and security principles.

| Document                                              | Purpose                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Architecture Overview](architecture/ARCHITECTURE.md) | Architectural evolution and 10-diagram set (Master Overview, System Context, Container, AWS Network, EKS, CI/CD, Secrets, Observability, Request Flow, Sequence) |
| [Security Posture & IAM](architecture/SECURITY.md)    | IRSA, WAF, ESO, IMDSv2, network isolation, and DevSecOps controls                                                                                             |

---

## 📁 [ops/](ops/)

Operational procedures, disaster recovery, cost management, and CI/CD.

| Document                                                          | Purpose                                                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [CI/CD Pipeline](ops/CI_CD_PIPELINE.md)                           | Jenkins → ArgoCD GitOps flow, stage-by-stage breakdown with Mermaid diagram                   |
| [Infrastructure Details](ops/INFRASTRUCTURE.md)                   | Terraform resource reference and execution workflow                                           |
| [Operational Runbook](ops/OPERATIONAL_RUNBOOK.md)                 | SOPs for provisioning, cluster access, Jenkins, K3s staging, and CloudWatch monitoring        |
| [Incident Response & Disaster Recovery](ops/INCIDENT_RESPONSE.md) | RTO/RPO targets, application rollback (Git revert + ArgoCD), and full infrastructure recovery |
| [FinOps & Cost Management](ops/FINOPS_COST_MANAGEMENT.md)         | Cost breakdown, HPA efficiency, and environment suspension strategies                         |

---

## 📁 [deployments/](deployments/)

Step-by-step guides for deploying AssembleMonitor across all environments.

| Guide                                                        | Complexity | Purpose                                        |
| ------------------------------------------------------------ | ---------- | ---------------------------------------------- |
| [01 — Local Docker Compose](deployments/01-LOCAL-DOCKER.md)  | Low        | Full stack locally for development and testing |
| [02 — K3s Cluster](deployments/02-K3S-CLUSTER.md)            | High       | Lightweight Kubernetes staging environment     |
| [03 — Amazon EKS Production](deployments/03-AWS-EKS-PROD.md) | Very High  | Primary GitOps production architecture         |

---

## 📁 [assets/](assets/)

Contains all screenshots and diagrams referenced in the documentation.

| Asset                                  | Purpose                                                           |
| -------------------------------------- | ----------------------------------------------------------------- |
| [Architecture Diagrams](architecture/) | 10 professional architecture diagrams (Master Overview → Sequence) |
| [Screenshots](assets/screenshots/)     | CI/CD, Observability, Infrastructure, and Application screenshots |
