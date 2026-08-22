# Lightweight Kubernetes Deployment (K3s)

> [!NOTE]
> This deployment strategy utilizes K3s, a lightweight, production-ready Kubernetes distribution. This architecture represents the intermediate transition state toward full DevSecOps automation, integrated directly with the Jenkins CI/CD pipeline via SSH deployment.

**Execution Scope:** Automated CI/CD, Lightweight Orchestration, Staging Environments
**Complexity:** High
**Architecture:** K3s, Native Kubernetes Manifests, Jenkins, Container Registry

## Architectural Overview

1. **K3s Control Plane/Worker Node**: A unified AWS EC2 instance executing the K3s server process.
2. **Kubernetes Resources**: Application topology is defined via static Kubernetes Deployments and Services (`k8s/` directory).
3. **CI/CD Integration**: The Jenkins pipeline (`Jenkinsfile-k3s`) executes container compilation, Trivy vulnerability scanning, registry publication, and subsequent remote Kubernetes rolling updates via SSH command execution.

## Deployment Procedure

### Automated Deployment Pipeline (Jenkins)

The primary mechanism for K3s deployment is the Jenkins pipeline execution.

1. Merge commits to the `main` branch.
2. Navigate to the Jenkins UI (Port 8080) and execute the `AssembleMonitor-Pipeline`.
3. Approve the deployment gate prompt to authorize `kubectl apply` execution on the remote K3s server.

### Manual Provisioning (Diagnostic Override)

For diagnostic or recovery scenarios requiring manual manifest application:

```bash
# Establish secure connection to K3s node
ssh -i key.pem ubuntu@<K3S_PUBLIC_IP>

# Synchronize manifest repository
cd ~/AssembleMonitor
git pull origin main

# Provision base configuration entities
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml

# Provision workloads and network services
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-nodeport-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
```

## Application Access Endpoints

Kubernetes services in this architecture utilize `NodePort` exposure, routing traffic directly through the EC2 instance's public IP address:

- **Frontend Application**: `http://<K3S_PUBLIC_IP>:30080`
- **Backend API Validation**: `http://<K3S_PUBLIC_IP>:30081/api/health`

> Note: Ensure AWS Security Group ingress rules permit TCP traffic on ports 30080 and 30081.
