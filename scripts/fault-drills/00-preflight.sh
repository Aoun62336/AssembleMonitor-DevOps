#!/usr/bin/env bash
# =============================================================================
# scripts/fault-drills/00-preflight.sh
#
# Pre-drill health check — verifies the full Docker Compose stack is running
# and all expected endpoints are responding correctly before any fault is
# injected. Run this before every drill sequence.
#
# Usage (from repo root):
#   bash scripts/fault-drills/00-preflight.sh
#
# Expected: all checks PASS. Exit code 0 = stack ready for drills.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Colour

pass() { echo -e "${GREEN}[PASS]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }
info() { echo -e "${YELLOW}[INFO]${NC} $*"; }

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
API_LIVE="http://localhost:8000/api/health/live"
API_READY="http://localhost:8000/api/health/ready"
NGINX_HEALTH="http://localhost:3000/api/health"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
http_status() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$1" 2>/dev/null || echo "000"
}

# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------
echo ""
info "=== Preflight: verifying Docker Compose stack ==="
echo ""

# 1. Confirm required services are running
info "Checking docker compose service status..."
RUNNING=$(docker compose ps --services --filter status=running 2>/dev/null | sort)
for svc in api db frontend; do
  if echo "${RUNNING}" | grep -q "^${svc}$"; then
    pass "Service '${svc}' is running"
  else
    fail "Service '${svc}' is NOT running. Start the stack: docker compose up -d"
  fi
done

# 2. Liveness probe (direct API)
info "Checking /api/health/live (direct port 8000)..."
STATUS=$(http_status "${API_LIVE}")
if [[ "${STATUS}" == "200" ]]; then
  pass "/api/health/live returned ${STATUS}"
else
  fail "/api/health/live returned ${STATUS} (expected 200)"
fi

# 3. Readiness probe (direct API)
info "Checking /api/health/ready (direct port 8000)..."
STATUS=$(http_status "${API_READY}")
if [[ "${STATUS}" == "200" ]]; then
  pass "/api/health/ready returned ${STATUS}"
else
  fail "/api/health/ready returned ${STATUS} (expected 200) — is the database healthy?"
fi

# 4. Nginx proxy check
info "Checking /api/health via Nginx (port 3000)..."
STATUS=$(http_status "${NGINX_HEALTH}")
if [[ "${STATUS}" == "200" ]]; then
  pass "Nginx proxy returned ${STATUS}"
else
  fail "Nginx proxy returned ${STATUS} (expected 200)"
fi

echo ""
pass "=== All preflight checks passed — stack is healthy and ready for drills ==="
echo ""
