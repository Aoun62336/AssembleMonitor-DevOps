# DevSecOps GitOps Pipeline

## Pipeline Purpose

The Jenkins pipeline (`Jenkinsfile-gitops`) automates the build, security auditing, and continuous integration of the AssembleMonitor application.

In this enterprise GitOps architecture, **Jenkins does not directly deploy to the Kubernetes cluster.** Instead, Jenkins acts as the CI (Continuous Integration) engine. After successfully building and securing the Docker images, Jenkins pushes a commit to the GitHub repository. **ArgoCD**, acting as the CD (Continuous Deployment) engine inside the Amazon EKS cluster, detects this commit and securely synchronizes the cluster state.

The pipeline strictly enforces **DevSecOps** principles by introducing Quality Gates and Vulnerability Scans that block insecure code from reaching the production repository.

## Infrastructure

- **Jenkins Server**: Orchestrates the CI pipeline. Uses Trivy for container scanning and Git for updating the Helm repository.
- **SonarQube Server**: Runs SonarQube v10 (Community Edition) with an embedded Elasticsearch database to perform static code analysis.
- **GitHub Repository**: The primary Source of Truth for the Kubernetes cluster state, storing the Helm charts (`k8s/helm-chart/`).
- **ArgoCD (inside EKS)**: The GitOps controller that continuously monitors GitHub and applies zero-downtime rollouts.

## DevSecOps Pipeline Stages

1. **Checkout**: Pulls the latest application source code from the GitHub repository.
2. **Show Build Info**: Displays current image tags, branch, and workspace debug information.
3. **Docker Check**: Verifies the Jenkins server has Docker engine running and accessible.
4. **Trivy FS Scan — Backend**: Scans the backend source code filesystem for `HIGH` and `CRITICAL` CVEs before building.
5. **SonarQube Analysis — Backend**: Uploads backend source code to SonarQube for static analysis (Security Hotspots, Code Smells, Bugs).
6. **Trivy FS Scan — Frontend**: Scans the frontend source code filesystem for `HIGH` and `CRITICAL` CVEs before building.
7. **SonarQube Analysis — Frontend**: Uploads frontend source code to SonarQube for static analysis.
8. **Quality Gate**: Pauses the pipeline to wait for SonarQube to finish processing. **If the code fails the Quality Gate, Jenkins aborts the pipeline.**
9. **Backend Build Validation**: Performs a dry-run import of the FastAPI application to catch syntax errors before building the final image.
10. **Frontend Build Validation**: Validates the frontend build configuration before building the final image.
11. **Build Final Images**: Builds production Docker images for both backend and frontend, tagging them with `${BUILD_NUMBER}` and `latest`.
12. **Trivy Image Scan — Backend**: Scans the compiled backend Docker image for `HIGH` and `CRITICAL` CVEs.
13. **Trivy Image Scan — Frontend**: Scans the compiled frontend Docker image for `HIGH` and `CRITICAL` CVEs.
14. **Docker Hub Login**: Authenticates with Docker Hub using Jenkins credentials binding.
15. **Push Images**: Pushes the scanned, secure images to the Docker Hub registry.
16. **Approve EKS GitOps Deploy**: A manual intervention step (10-minute timeout) asking: *"Update Helm Chart and Trigger ArgoCD Sync to EKS Production?"*
17. **GitOps: Update Helm Values**: Jenkins updates `k8s/helm-chart/values/app.yaml`, changing the image `tag:` to `${BUILD_NUMBER}`, then commits and pushes to GitHub using a Personal Access Token. ArgoCD detects the change and triggers a rolling update.

## Credentials Used

| Credential ID     | Purpose                                                                     |
| ----------------- | --------------------------------------------------------------------------- |
| `dockerhub-creds` | Docker Hub username and password/token for pushing images                   |
| `github-creds`    | GitHub Username and Personal Access Token (PAT) for committing Helm updates |
| `SonarQubeServer` | Jenkins Global Configuration credential containing the SonarQube User Token |

## Deployment Flow (Enterprise GitOps Architecture)

![CI/CD and GitOps Pipeline](../architecture/05-cicd-gitops-pipeline.jpeg)

> End-to-end pipeline from source code to production. A developer push to GitHub triggers Jenkins, which runs the full CI pipeline: Trivy filesystem scan → SonarQube static analysis → quality gate → Docker image build → Trivy image scan → Docker Hub publish. The pipeline then branches: the **Primary GitOps Path** commits the updated Helm image tag to GitHub, ArgoCD detects the change and performs a zero-downtime rolling deployment to EKS Production; the **Secondary SSH Path** deploys directly to the K3s staging cluster via SSH and `kubectl apply` after manual approval.
