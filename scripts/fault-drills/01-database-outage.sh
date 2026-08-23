#!/usr/bin/env bash
# =============================================================================
# scripts/fault-drills/01-database-outage.sh
#
# Drill: INC-001 — PostgreSQL container outage.
# Conducted: 2026-08-20  |  MTTR: 2 min 9 sec
#
# Fault:    docker compose stop db
# Expected: /api/health/live  → 200 (Python process survives)
#           /api/health/ready → 503 (DB dependency correctly detected as gone)
# Recovery: docker compose start db + 15s wait
# Evidence: docs/ops/incidents/INC-001-database-outage.md
#
# Usage (from repo root):
#   bash scripts/fault-drills/01-database-outage.sh
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

API_LIVE="http://localhost:8000/api/health/live"
API_READY="http://localhost:8000/api/health/ready"

# ---------------------------------------------------------------------------
# Step 0: Preflight
# ---------------------------------------------------------------------------
echo ""
info "=== INC-001: PostgreSQL Container Outage Drill ==="
echo ""

step "0/4  Running preflight check..."
bash "$(dirname "$0")/00-preflight.sh" || fail "Preflight failed — fix stack before injecting fault"

# ---------------------------------------------------------------------------
# Step 1: Inject fault
# ---------------------------------------------------------------------------
step "1/4  Injecting fault: docker compose stop db"
FAULT_TIME=$(date '+%H:%M:%S')
docker compose stop db
info "db container stopped at ${FAULT_TIME}"
sleep 2

# ---------------------------------------------------------------------------
# Step 2: Assert fault state
# ---------------------------------------------------------------------------
step "2/4  Asserting expected fault state..."

STATUS_LIVE=$(http_status "${API_LIVE}")
if [[ "${STATUS_LIVE}" == "200" ]]; then
  pass "/api/health/live returned ${STATUS_LIVE} — Python process survived ✓"
else
  fail "/api/health/live returned ${STATUS_LIVE} (expected 200)"
fi

STATUS_READY=$(http_status "${API_READY}")
if [[ "${STATUS_READY}" == "503" ]]; then
  pass "/api/health/ready returned ${STATUS_READY} — DB dependency correctly detected ✓"
else
  fail "/api/health/ready returned ${STATUS_READY} (expected 503)"
fi

echo ""
info "API logs at time of fault:"
docker compose logs api --tail=5 2>/dev/null || true

# ---------------------------------------------------------------------------
# Step 3: Recover
# ---------------------------------------------------------------------------
step "3/4  Recovering: docker compose start db"
RECOVERY_TIME=$(date '+%H:%M:%S')
docker compose start db
info "Waiting 15 seconds for PostgreSQL to initialise and pass healthcheck..."
sleep 15

# ---------------------------------------------------------------------------
# Step 4: Assert recovery
# ---------------------------------------------------------------------------
step "4/4  Asserting recovery state..."

STATUS_LIVE=$(http_status "${API_LIVE}")
STATUS_READY=$(http_status "${API_READY}")

if [[ "${STATUS_LIVE}" == "200" ]]; then
  pass "/api/health/live returned ${STATUS_LIVE}"
else
  fail "/api/health/live returned ${STATUS_LIVE} after recovery (expected 200)"
fi

if [[ "${STATUS_READY}" == "200" ]]; then
  pass "/api/health/ready returned ${STATUS_READY} — database reconnected automatically ✓"
else
  fail "/api/health/ready returned ${STATUS_READY} after recovery (expected 200)"
fi

echo ""
pass "=== INC-001 drill complete — liveness/readiness separation verified ==="
info "Recovery time measured in original exercise: 2 min 9 sec"
echo ""
