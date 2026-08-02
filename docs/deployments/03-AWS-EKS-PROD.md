# 🚀 Option 4: Amazon EKS Production Architecture (Primary)

> [!IMPORTANT]
> This is the **primary, production-grade deployment strategy** for AssembleMonitor. It represents the culmination of all DevOps and Cloud engineering efforts. The application is orchestrated by an Amazon EKS cluster, utilizing highly secure and scalable AWS infrastructure.

**Best For:** Enterprise Production, High Availability, Auto-Scaling
**Complexity:** Very High
**Tech Stack:** Amazon EKS, Terraform, ArgoCD, Helm, AWS Application Load Balancer (ALB), AWS WAF, Horizontal Pod Autoscaler (HPA), Kubernetes Metrics Server

## 🏗️ Architecture Overview

Unlike the standalone K3s deployment, this architecture is fully integrated into the AWS ecosystem:

1. **Managed Control Plane**: AWS manages the Kubernetes control plane for maximum reliability.
2. **Managed Node Groups**: EC2 instances (`c7i-flex.large`) are dynamically provisioned into private subnets by EKS.
3. **ALB NodePort Integration**: To bypass strict AWS account limits on new LoadBalancers, a pre-existing, Terraform-managed Application Load Balancer routes traffic _directly_ to the Kubernetes `NodePort 30080` via an Auto Scaling Group attachment.
4. **AWS WAF**: The ALB is protected by an AWS WAFv2. The managed rule groups (CommonRuleSet, KnownBadInputs) run in **count/monitor mode** — they log SQLi and XSS payloads without blocking requests. The rate-limit rule actively **blocks** any single IP sending more than 2,000 requests within a 5-minute window.
5. **Horizontal Pod Autoscaling**: The Kubernetes Metrics Server monitors CPU load. If CPU spikes above 70%, the HPA automatically scales the frontend and backend pods from 2 up to 5 replicas.
6. **GitOps CD (ArgoCD)**: Instead of manual `kubectl` applies, ArgoCD runs inside the cluster and continuously synchronizes the deployment state with the Helm charts stored in the GitHub repository.

## 🚀 Deployment Instructions

### 1. Terraform Provisioning

The underlying infrastructure (EKS cluster, Nodes, ALB, WAF, Security Groups, RDS) must be provisioned via Terraform:

```bash
cd terraform
terraform apply -auto-approve
```

### 2. Connect to the EKS Cluster

Once Terraform completes, configure your local `kubectl` to communicate with the new EKS cluster:

```bash
aws eks update-kubeconfig --region us-east-1 --name assemblemonitor-advance-dev-eks
```

### 3. Verify GitOps Synchronization

Because Terraform natively installs the ArgoCD controller and provisions the `argocd-apps` configuration during the `apply` phase, there is **zero manual setup required**!

Simply verify that ArgoCD has automatically detected the Git repository and is booting your pods:

```bash
kubectl get pods -n assemblemonitor
```

### 4. Verify Autoscaling (HPA)

Ensure the Metrics Server is running and the HPA is successfully tracking CPU load:

```bash
kubectl get hpa -n assemblemonitor
```

## 🌐 Accessing the Application

### 1. Administrative UIs (GitOps & Observability)

Because this cluster is ephemeral, the AWS LoadBalancers for ArgoCD and Grafana are provisioned dynamically. To access them instantly without manual port-forwarding, run the included helper script:

```bash
./get-urls.sh
```

### 2. Public Frontend (Client UI)

The main construction management application is exposed securely via the AWS Application Load Balancer. You do not connect directly to the EC2 instances.

Get your Live URL by running:

```bash
terraform output alb_url
```

Navigate to the outputted URL (e.g., `http://<ALB_DNS_NAME>`) in your browser. Traffic is routed from the ALB to the EKS Nodes on Port 30080, and internally proxied to the Nginx and FastAPI pods.
