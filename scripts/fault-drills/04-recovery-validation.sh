#!/usr/bin/env bash
# =============================================================================
# scripts/fault-drills/04-recovery-validation.sh
#
# Post-drill recovery validation — confirms all services are healthy after
# the full drill sequence has been completed.
#
# Run this as the final step after all three drills. It checks:
#   1. All required services are running
#   2. /api/health/live  → 200
#   3. /api/health/ready → 200 (database connected)
#   4. Nginx proxy       → 200
#
# Usage (from repo root):
#   bash scripts/fault-drills/04-recovery-validation.sh
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass()  { echo -e "${GREEN}[PASS]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }
info()  { echo -e "${YELLOW}[INFO]${NC} $*"; }

http_status() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$1" 2>/dev/null || echo "000"
}

API_LIVE="http://localhost:8000/api/health/live"
API_READY="http://localhost:8000/api/health/ready"
NGINX_HEALTH="http://localhost:3000/api/health"

# ---------------------------------------------------------------------------
# Recovery validation
# ---------------------------------------------------------------------------
echo ""
info "=== Post-Drill Recovery Validation ==="
echo ""

# 1. Service state
info "Checking docker compose service status..."
RUNNING=$(docker compose ps --services --filter status=running 2>/dev/null | sort)
for svc in api db frontend; do
  if echo "${RUNNING}" | grep -q "^${svc}$"; then
    pass "Service '${svc}' is running"
  else
    fail "Service '${svc}' is NOT running — stack is not fully recovered"
  fi
done

# 2. Liveness
STATUS=$(http_status "${API_LIVE}")
if [[ "${STATUS}" == "200" ]]; then
  pass "/api/health/live returned ${STATUS}"
else
  fail "/api/health/live returned ${STATUS} (expected 200)"
fi

# 3. Readiness
STATUS=$(http_status "${API_READY}")
if [[ "${STATUS}" == "200" ]]; then
  pass "/api/health/ready returned ${STATUS} — database connected"
else
  fail "/api/health/ready returned ${STATUS} (expected 200) — database may not be ready yet"
fi

# 4. Nginx
STATUS=$(http_status "${NGINX_HEALTH}")
if [[ "${STATUS}" == "200" ]]; then
  pass "Nginx proxy returned ${STATUS}"
else
  fail "Nginx proxy returned ${STATUS} (expected 200)"
fi

echo ""
pass "=== Recovery validation complete — all services healthy after drills ==="
echo ""
info "Stack is clean. Safe to stop with: docker compose down"
info "(Do NOT use -v unless you want to delete the postgres volume)"
echo ""
