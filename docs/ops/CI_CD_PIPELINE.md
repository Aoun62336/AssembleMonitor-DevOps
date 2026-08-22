# DevSecOps GitOps Pipeline

## Pipeline Purpose

The Jenkins pipeline (`Jenkinsfile-gitops`) automates the build, security auditing, and continuous integration of the AssembleMonitor application.

In this GitOps architecture, Jenkins operates strictly as the Continuous Integration (CI) engine. Jenkins does not execute deployments against the Kubernetes cluster. Upon successful build and security validation, Jenkins commits the updated image manifests to the GitHub repository. ArgoCD, operating as the Continuous Deployment (CD) controller within the Amazon EKS cluster, detects this state change and executes the synchronization.

The pipeline implements automated security controls, integrating SonarQube quality gates and Trivy container vulnerability scanning to block insecure artifacts prior to deployment.

## Infrastructure Components

- **Jenkins Server**: Orchestrates the CI pipeline. Executes Trivy for container scanning and manages the Git commit workflow for the Helm repository.
- **SonarQube Server**: Executes static code analysis (SAST) via SonarQube v10 (Community Edition) with an embedded Elasticsearch database.
- **GitHub Repository**: The declarative source of truth for the Kubernetes cluster state, hosting the Helm charts (`k8s/helm-chart/`).
- **ArgoCD (EKS In-Cluster)**: The GitOps controller that continuously reconciles the EKS cluster state against the GitHub repository.

## Pipeline Execution Stages

1. **Checkout**: Retrieves application source code from the repository.
2. **Show Build Info**: Outputs image tags, branch references, and workspace debugging telemetry.
3. **Docker Check**: Validates Docker engine availability on the Jenkins worker node.
4. **Trivy FS Scan (Backend)**: Scans backend source code filesystem for HIGH and CRITICAL CVEs.
5. **SonarQube Analysis (Backend)**: Transmits backend source code for SAST processing (Security Hotspots, Code Smells, Bugs).
6. **Trivy FS Scan (Frontend)**: Scans frontend source code filesystem for HIGH and CRITICAL CVEs.
7. **SonarQube Analysis (Frontend)**: Transmits frontend source code for SAST processing.
8. **Quality Gate**: Halts execution pending SonarQube analysis completion. The pipeline terminates if the configured Quality Gate fails.
9. **Backend Build Validation**: Executes a dry-run import of the FastAPI application to validate syntax prior to image construction.
10. **Frontend Build Validation**: Validates the Vite frontend build configuration.
11. **Build Final Images**: Constructs production container images for backend and frontend components, tagged with `${BUILD_NUMBER}` and `latest`.
12. **Trivy Image Scan (Backend)**: Scans the compiled backend container image for HIGH and CRITICAL CVEs.
13. **Trivy Image Scan (Frontend)**: Scans the compiled frontend container image for HIGH and CRITICAL CVEs.
14. **Docker Hub Login**: Authenticates via Jenkins credential binding.
15. **Push Images**: Transmits secure images to the remote container registry.
16. **Approve EKS GitOps Deploy**: Manual validation gate (10-minute timeout) for production synchronization.
17. **GitOps Configuration Update**: Jenkins patches `k8s/helm-chart/values/app.yaml` with the `${BUILD_NUMBER}` image tag and pushes the commit via Personal Access Token, triggering ArgoCD synchronization.

## Access Credentials

| Credential ID | Implementation |
|---|---|
| `dockerhub-creds` | Registry authentication for image publication |
| `github-creds` | Personal Access Token (PAT) authorizing programmatic repository commits |
| `SonarQubeServer` | Jenkins Global Configuration token for API authentication |

## Deployment Flow Architecture

![CI/CD and GitOps Pipeline](../architecture/05-cicd-gitops-pipeline.jpeg)

> Architecture flow: GitHub commit triggers the Jenkins CI pipeline (Trivy FS scan → SonarQube SAST → Quality Gate → Docker build → Trivy image scan → Docker Hub push). The Primary GitOps Path commits updated image tags to GitHub, which ArgoCD detects to execute a rolling deployment on the EKS production cluster. The Secondary SSH Path executes direct `kubectl apply` commands against the K3s staging cluster via SSH following manual approval.

---

## Pre-Merge Validation (GitHub Actions)

A GitHub Actions workflow (`.github/workflows/pr-validation.yml`) executes as a pre-merge gate on pull requests targeting `main`.

While Jenkins orchestrates the primary CI/CD and deployment pipeline, GitHub Actions provides rapid, stateless verification of code correctness without requiring the persistent Jenkins infrastructure:

| Job | Verification Scope |
|---|---|
| **Backend Test** | `pytest` unit test suite, Python syntax validation |
| **Frontend Build** | `npm ci` and Vite production build validation |
| **Terraform Validate** | Configuration formatting (`fmt -check`), native module unit tests (`terraform test`), and initialization validation |
| **Helm Validate** | Dependency resolution, `helm lint`, and template rendering validation |
| **Secret Scan** | Gitleaks historical credential scan (informational output) |

The `main-protection` branch ruleset enforces successful execution of the Backend, Frontend, Terraform, and Helm validation jobs prior to allowing a merge operation.
