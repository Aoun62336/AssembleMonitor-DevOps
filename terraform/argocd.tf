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
  version    = "10.2.1"
  namespace  = kubernetes_namespace.argocd.metadata[0].name

  set {
    name  = "server.service.type"
    value = "LoadBalancer"
  }

  depends_on = [
    kubernetes_namespace.argocd,
    helm_release.external_secrets,
    helm_release.metrics_server,
    kubernetes_storage_class.gp3
  ]
}

resource "helm_release" "argocd_apps" {
  name       = "argocd-apps"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argocd-apps"
  namespace  = kubernetes_namespace.argocd.metadata[0].name

  values = [
    yamlencode({
      applications = {
        assemblemonitor-eks = {
          namespace = "argocd"
          project   = "default"
          source = {
            repoURL        = "https://github.com/Aoun62336/AssembleMonitor-DevOps.git"
            targetRevision = "HEAD"
            path           = "k8s/helm-chart"
            helm = {
              valueFiles = ["values/app.yaml", "values/observability.yaml"]
            }
          }
          destination = {
            server    = "https://kubernetes.default.svc"
            namespace = "assemblemonitor"
          }
          syncPolicy = {
            automated = {
              prune    = true
              selfHeal = true
            }
            syncOptions = [
              "CreateNamespace=true",
              "ServerSideApply=true"
            ]
          }
          ignoreDifferences = [
            {
              group        = "apps"
              kind         = "Deployment"
              jsonPointers = ["/status/terminatingReplicas"]
            },
            {
              group        = "apps"
              kind         = "DaemonSet"
              jsonPointers = ["/status/terminatingReplicas"]
            },
            {
              group        = "apps"
              kind         = "StatefulSet"
              jsonPointers = ["/status/terminatingReplicas"]
            }
          ]
        }
      }
    })
  ]

  depends_on = [
    helm_release.argocd
  ]
}
