# ---------------------------------------------------------
# ArgoCD Automated Installation
# ---------------------------------------------------------
resource "kubernetes_namespace" "argocd" {
  metadata {
    name = "argocd"
  }

  depends_on = [
    aws_eks_node_group.main,
    aws_eks_addon.ebs_csi_driver
  ]
}

resource "helm_release" "argocd" {
  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = "7.3.11"
  namespace  = kubernetes_namespace.argocd.metadata[0].name

  set {
    name  = "server.service.type"
    value = "ClusterIP"
  }

  depends_on = [
    kubernetes_namespace.argocd
  ]
}

# ---------------------------------------------------------
# ArgoCD GitOps Application Setup (Using local-exec to avoid CRD plan errors)
# ---------------------------------------------------------
resource "null_resource" "argocd_application_apply" {
  depends_on = [helm_release.argocd]

  provisioner "local-exec" {
    command = "aws eks update-kubeconfig --name ${aws_eks_cluster.main.name} --region ${var.aws_region} && kubectl apply -f ../k8s/argocd-application.yaml"
  }
}
