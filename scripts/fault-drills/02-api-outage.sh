#!/usr/bin/env bash
# =============================================================================
# scripts/fault-drills/02-api-outage.sh
#
# Drill: INC-002 — FastAPI container outage (Nginx 502).
# Conducted: 2026-08-20  |  MTTR: 2 min 35 sec
#
# Fault:    docker compose stop api
# Expected: GET localhost:3000/api/health (via Nginx) → 502 Bad Gateway
#           GET localhost:8000/api/health (direct)    → connection refused / 000
# Recovery: docker compose start api + 10s wait
# Evidence: docs/ops/incidents/INC-002-api-outage-nginx-502.md
#
# Usage (from repo root):
#   bash scripts/fault-drills/02-api-outage.sh
#
# SAFETY: Never run 'docker compose down -v' — it deletes the postgres volume.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass()  { echo -e "${GREEN}[PASS]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }
info()  { echo -e "${YELLOW}[INFO]${NC} $*"; }
step()  { echo -e "${CYAN}[STEP]${NC} $*"; }

http_status() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$1" 2>/dev/null || echo "000"
}

NGINX_HEALTH="http://localhost:3000/api/health"
API_DIRECT="http://localhost:8000/api/health"

# ---------------------------------------------------------------------------
# Step 0: Preflight
# ---------------------------------------------------------------------------
echo ""
info "=== INC-002: FastAPI Container Outage Drill (Nginx 502) ==="
echo ""

step "0/4  Running preflight check..."
bash "$(dirname "$0")/00-preflight.sh" || fail "Preflight failed — fix stack before injecting fault"

# ---------------------------------------------------------------------------
# Step 1: Inject fault
# ---------------------------------------------------------------------------
step "1/4  Injecting fault: docker compose stop api"
FAULT_TIME=$(date '+%H:%M:%S')
docker compose stop api
info "api container stopped at ${FAULT_TIME}"
sleep 2

# ---------------------------------------------------------------------------
# Step 2: Assert fault state
# ---------------------------------------------------------------------------
step "2/4  Asserting expected fault state..."

STATUS_NGINX=$(http_status "${NGINX_HEALTH}")
if [[ "${STATUS_NGINX}" == "502" ]]; then
  pass "Nginx (port 3000) returned ${STATUS_NGINX} Bad Gateway — fast failure, no hang ✓"
else
  fail "Nginx returned ${STATUS_NGINX} (expected 502 Bad Gateway)"
fi

STATUS_DIRECT=$(http_status "${API_DIRECT}")
if [[ "${STATUS_DIRECT}" == "000" ]]; then
  pass "Direct API port 8000 returned connection refused (000) — port correctly closed ✓"
else
  # Connection refused may appear as 000 or 7 (curl exit code) depending on OS
  info "Direct API port 8000 returned ${STATUS_DIRECT} (connection refused expected — may vary by OS)"
fi

echo ""
info "Nginx logs at time of fault:"
docker compose logs frontend --tail=5 2>/dev/null || true

# ---------------------------------------------------------------------------
# Step 3: Recover
# ---------------------------------------------------------------------------
step "3/4  Recovering: docker compose start api"
RECOVERY_TIME=$(date '+%H:%M:%S')
docker compose start api
info "Waiting 10 seconds for API container to start and pass healthcheck..."
sleep 10

# ---------------------------------------------------------------------------
# Step 4: Assert recovery
# ---------------------------------------------------------------------------
step "4/4  Asserting recovery state..."

STATUS_NGINX=$(http_status "${NGINX_HEALTH}")
if [[ "${STATUS_NGINX}" == "200" ]]; then
  pass "Nginx (port 3000) returned ${STATUS_NGINX} — traffic routing restored ✓"
else
  fail "Nginx returned ${STATUS_NGINX} after recovery (expected 200)"
fi

STATUS_DIRECT=$(http_status "${API_DIRECT}")
if [[ "${STATUS_DIRECT}" == "200" ]]; then
  pass "Direct API port 8000 returned ${STATUS_DIRECT} ✓"
else
  fail "Direct API returned ${STATUS_DIRECT} after recovery (expected 200)"
fi

echo ""
pass "=== INC-002 drill complete — Nginx 502 behaviour verified ==="
info "Recovery time measured in original exercise: 2 min 35 sec"
echo ""
