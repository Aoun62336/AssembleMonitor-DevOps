#!/bin/bash

echo "Fetching LoadBalancer URLs from AWS..."
echo "If this returns empty, AWS is still provisioning the ELBs. Wait 2 minutes and run again."
echo "------------------------------------------------------"

ARGOCD_URL=$(kubectl get svc argocd-server -n argocd -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
GRAFANA_URL=$(kubectl get svc grafana -n assemblemonitor -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo -e "ArgoCD UI:  \033[1;32mhttps://$ARGOCD_URL\033[0m"
echo -e "Grafana UI: \033[1;34mhttp://$GRAFANA_URL\033[0m"
echo "------------------------------------------------------"
