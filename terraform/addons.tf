# ---------------------------------------------------------
# Automated Add-on Installations (Helm)
# ---------------------------------------------------------

# Namespace for External Secrets
resource "kubernetes_namespace" "external_secrets" {
  metadata {
    name = "external-secrets"
  }
}

# External Secrets Operator
resource "helm_release" "external_secrets" {
  name       = "external-secrets"
  repository = "https://charts.external-secrets.io"
  chart      = "external-secrets"
  version    = "0.9.11"
  namespace  = kubernetes_namespace.external_secrets.metadata[0].name
  wait       = true

  set {
    name  = "installCRDs"
    value = "true"
  }

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = aws_iam_role.eso_role.arn
  }
}

# Metrics Server (Required for HPA)
resource "helm_release" "metrics_server" {
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  version    = "3.12.1"
  namespace  = "kube-system"
  wait       = true

  set {
    name  = "args[0]"
    value = "--kubelet-insecure-tls"
  }
}
