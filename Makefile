# =============================================================================
# AssembleMonitor — Developer Makefile
#
# Single entry point for all common developer tasks.
# Mirrors what GitHub Actions runs in CI so local == CI.
#
# Usage:
#   make          → show this help
#   make test     → run backend pytest suite
#   make ci-local → run everything CI runs (before pushing)
#
# Requirements: python, pip, helm, terraform, docker, docker compose
# =============================================================================

.PHONY: help test lint helm-lint tf-test stack-up stack-down ci-local

# Default target — prints all available targets with descriptions
help:
	@echo ""
	@echo "AssembleMonitor — available targets:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'
	@echo ""

# -----------------------------------------------------------------------------
# test — Backend pytest suite
# Runs all 23 tests against the in-memory SQLite mock (no real DB needed).
# Mirrors: GitHub Actions job "Backend — Compile & Test"
# -----------------------------------------------------------------------------
test: ## Run backend pytest suite (no database required)
	@echo "--- Running backend pytest suite ---"
	cd backend && python -m compileall app -q
	cd backend && python -m pytest tests/ -v
	@echo "--- pytest complete ---"

# -----------------------------------------------------------------------------
# lint — Python syntax + Terraform formatting
# Mirrors: GitHub Actions jobs "Backend — Compile & Test" + "Terraform — Validate"
# -----------------------------------------------------------------------------
lint: ## Python compileall + terraform fmt check
	@echo "--- Python compile check ---"
	python -m compileall backend/app -q
	@echo "--- Terraform fmt check ---"
	terraform -chdir=terraform fmt -check -recursive
	@echo "--- lint complete ---"

# -----------------------------------------------------------------------------
# helm-lint — Helm chart lint against all values files
# Mirrors: GitHub Actions job "Helm — Validate"
# NOTE: Requires helm repos to be registered:
#   helm repo add grafana https://grafana.github.io/helm-charts
#   helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
#   helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
#   helm repo update && helm dependency build k8s/helm-chart
# -----------------------------------------------------------------------------
helm-lint: ## Lint Helm chart against production + hardening values
	@echo "--- Helm lint ---"
	helm dependency build k8s/helm-chart
	helm lint k8s/helm-chart \
		-f k8s/helm-chart/values/app.yaml \
		-f k8s/helm-chart/values/observability.yaml \
		-f k8s/helm-chart/values/hardening-validation.yaml
	@echo "--- helm lint complete ---"

# -----------------------------------------------------------------------------
# tf-test — Terraform module unit tests
# Uses mock_provider — no AWS credentials required.
# Mirrors: GitHub Actions job "Terraform — Validate" step "terraform test"
# -----------------------------------------------------------------------------
tf-test: ## Run terraform test on the network module (no AWS creds needed)
	@echo "--- Terraform module unit tests ---"
	terraform -chdir=terraform/modules/network init -backend=false -no-color
	terraform -chdir=terraform/modules/network test -no-color
	@echo "--- terraform test complete ---"

# -----------------------------------------------------------------------------
# stack-up — Start local Docker Compose stack
# Starts the API, database, and frontend locally.
# IMPORTANT: Never use 'docker compose down -v' — it deletes the postgres volume.
# -----------------------------------------------------------------------------
stack-up: ## Start local Docker Compose stack (API + DB + frontend)
	@echo "--- Starting local stack ---"
	docker compose up -d --build
	@echo "--- Stack started. API: http://localhost:8000  Frontend: http://localhost:3000 ---"

# -----------------------------------------------------------------------------
# stack-down — Stop local Docker Compose stack (preserves volumes)
# Stops all containers but keeps the PostgreSQL data volume intact.
# -----------------------------------------------------------------------------
stack-down: ## Stop local Docker Compose stack (keeps data volumes)
	@echo "--- Stopping local stack ---"
	docker compose down
	@echo "--- Stack stopped. Data volume preserved. ---"

# -----------------------------------------------------------------------------
# ci-local — Run everything CI runs, locally, before pushing
# This is the recommended pre-push check.
# Equivalent to triggering all 5 GitHub Actions jobs on your machine.
# -----------------------------------------------------------------------------
ci-local: ## Run full local CI: pytest + lint + helm-lint + tf-test
	@echo "======================================================"
	@echo "  AssembleMonitor — Local CI Run"
	@echo "======================================================"
	$(MAKE) test
	$(MAKE) lint
	$(MAKE) helm-lint
	$(MAKE) tf-test
	@echo "======================================================"
	@echo "  All checks passed. Safe to push."
	@echo "======================================================"
