#!/usr/bin/env bash
# =============================================================================
# scripts/fault-drills/03-database-dns-failure.sh
#
# Drill: INC-003 — Database DNS resolution failure (bad DATABASE_URL hostname).
# Conducted: 2026-08-20  |  MTTR: 2 min 22 sec
#
# Fault:    Apply bad-db-host.yml override — replaces DATABASE_URL hostname
#           from 'db' (valid) to 'db-invalid' (does not exist in Docker network)
# Expected: /api/health/live  → 200 (Python process survives)
#           /api/health/ready → 503 (DNS failure detected by readiness probe)
# Recovery: docker compose up -d --force-recreate api (without override) + 15s wait
# Evidence: docs/ops/incidents/INC-003-database-dns-failure.md
#
# Usage (from repo root):
#   bash scripts/fault-drills/03-database-dns-failure.sh
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
OVERRIDE_FILE="scripts/fault-drills/overrides/bad-db-host.yml"

# ---------------------------------------------------------------------------
# Step 0: Preflight
# ---------------------------------------------------------------------------
echo ""
info "=== INC-003: Database DNS Resolution Failure Drill ==="
echo ""

step "0/4  Running preflight check..."
bash "$(dirname "$0")/00-preflight.sh" || fail "Preflight failed — fix stack before injecting fault"

# Confirm override file exists
if [[ ! -f "${OVERRIDE_FILE}" ]]; then
  fail "Override file not found: ${OVERRIDE_FILE} — run from repo root"
fi

# ---------------------------------------------------------------------------
# Step 1: Inject fault
# ---------------------------------------------------------------------------
step "1/4  Injecting fault: apply bad-db-host.yml override"
info "Replacing DATABASE_URL hostname 'db' → 'db-invalid' (non-existent in Docker network)"
FAULT_TIME=$(date '+%H:%M:%S')
docker compose \
  -f docker-compose.yml \
  -f "${OVERRIDE_FILE}" \
  up -d --force-recreate api
info "API container restarted with bad DATABASE_URL at ${FAULT_TIME}"
sleep 5

# ---------------------------------------------------------------------------
# Step 2: Assert fault state
# ---------------------------------------------------------------------------
step "2/4  Asserting expected fault state..."

STATUS_LIVE=$(http_status "${API_LIVE}")
if [[ "${STATUS_LIVE}" == "200" ]]; then
  pass "/api/health/live returned ${STATUS_LIVE} — Python process survived DNS failure ✓"
else
  fail "/api/health/live returned ${STATUS_LIVE} (expected 200)"
fi

STATUS_READY=$(http_status "${API_READY}")
if [[ "${STATUS_READY}" == "503" ]]; then
  pass "/api/health/ready returned ${STATUS_READY} — DNS failure detected by readiness probe ✓"
else
  fail "/api/health/ready returned ${STATUS_READY} (expected 503)"
fi

echo ""
info "API logs at time of fault (TimeoutError expected):"
docker compose logs api --tail=10 2>/dev/null || true

# ---------------------------------------------------------------------------
# Step 3: Recover
# ---------------------------------------------------------------------------
step "3/4  Recovering: restart api without override (restore correct DATABASE_URL)"
RECOVERY_TIME=$(date '+%H:%M:%S')
docker compose up -d --force-recreate api
info "Waiting 15 seconds for API to start and reconnect to database..."
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
  pass "/api/health/ready returned ${STATUS_READY} — database reconnected ✓"
else
  fail "/api/health/ready returned ${STATUS_READY} after recovery (expected 200)"
fi

echo ""
pass "=== INC-003 drill complete — config error detection via readiness probe verified ==="
info "Recovery time measured in original exercise: 2 min 22 sec"
echo ""
