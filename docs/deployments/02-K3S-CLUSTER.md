# ☸️ Option 2: Lightweight Kubernetes (K3s)

> [!NOTE]
> This deployment strategy introduces Kubernetes orchestration using **K3s**, a lightweight, production-ready Kubernetes distribution. This phase marked the transition from manual EC2 configuration to true DevSecOps automation, integrating perfectly with the Jenkins CI/CD pipeline.

**Best For:** Automated CI/CD, Lightweight Orchestration, Staging Environments
**Complexity:** High
**Tech Stack:** K3s, Kubernetes Manifests, Jenkins, Docker Hub

## 🏗️ Architecture Overview

1. **K3s Server**: A standalone AWS EC2 instance running K3s.
2. **Kubernetes Resources**: The application is managed via native Kubernetes Deployments and Services (found in the `k8s/` directory).
3. **CI/CD Integration**: The Jenkins server (`Jenkinsfile-k3s`) automatically builds Docker images, scans them with Trivy, pushes them to Docker Hub, and executes a zero-downtime rolling update against the K3s cluster.

## 🚀 Deployment Instructions

### 1. Automated Deployment (Jenkins)

The primary method for deploying to the K3s cluster is via the Jenkins Pipeline.

1. Commit code to the `main` branch.
2. In the Jenkins UI (Port 8080), click **Build Now** on the `AssembleMonitor-Pipeline`.
3. Approve the final deployment prompt to trigger the `kubectl apply` commands on the K3s server.

### 2. Manual Deployment (For Debugging)

If you need to manually apply the manifests to the K3s server:

```bash
# SSH into the K3s server
ssh -i key.pem ubuntu@<K3S_PUBLIC_IP>

# Clone or pull the latest manifests
cd ~/AssembleMonitor
git pull origin main

# Apply the base configuration
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml

# Apply the Deployments and Services
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-nodeport-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
```

## 🌐 Accessing the Application

Kubernetes services in this architecture have been configured as `NodePort` types to expose the application directly to the public internet using the EC2 instance's IP address:

- **Frontend Website**: `http://<K3S_PUBLIC_IP>:30080`
- **Backend API**: `http://<K3S_PUBLIC_IP>:30081/api/health`

_(Note: Ensure your AWS Security Group allows inbound TCP traffic on ports 30080 and 30081)._
