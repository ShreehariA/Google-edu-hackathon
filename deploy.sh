#!/usr/bin/env bash
# =============================================================================
# deploy.sh — DeltaEd full deploy: build → push → terraform → seed
# Usage: ./deploy.sh [--skip-seed] [--skip-agent]
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[deploy]${NC} $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}   $*"; }
error()   { echo -e "${RED}[error]${NC}  $*"; exit 1; }
divider() { echo -e "\n${GREEN}────────────────────────────────────────────${NC}"; }

# ── Flags ─────────────────────────────────────────────────────────────────────
SKIP_SEED=false
SKIP_AGENT=false
for arg in "$@"; do
  case $arg in
    --skip-seed)  SKIP_SEED=true  ;;
    --skip-agent) SKIP_AGENT=true ;;
    --help|-h)
      echo "Usage: ./deploy.sh [--skip-seed] [--skip-agent]"
      echo "  --skip-seed   Skip the BigQuery seed step"
      echo "  --skip-agent  Skip building/pushing the agent image"
      exit 0 ;;
    *) error "Unknown flag: $arg" ;;
  esac
done

# ── Config ───────────────────────────────────────────────────────────────────
REPO_ROOT="/Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon"
PROJECT_ID="deltaed"
REGION="europe-west2"
REGISTRY="gcr.io/${PROJECT_ID}"

SERVICES=("backend" "frontend")
$SKIP_AGENT || SERVICES+=("agent")

START_TIME=$(date +%s)

# ── Pre-flight checks ─────────────────────────────────────────────────────────
divider
info "Pre-flight checks..."

command -v docker     >/dev/null 2>&1 || error "docker not found"
command -v gcloud     >/dev/null 2>&1 || error "gcloud not found"
command -v terraform  >/dev/null 2>&1 || error "terraform not found"
command -v uv         >/dev/null 2>&1 || error "uv not found (needed for seed.py)"

[[ -d "$REPO_ROOT" ]]              || error "Repo root not found: $REPO_ROOT"
[[ -f "$REPO_ROOT/src/.env" ]]     || warn  "src/.env not found — seed may fail"

ACTIVE_PROJECT=$(gcloud config get-value project 2>/dev/null)
[[ "$ACTIVE_PROJECT" == "$PROJECT_ID" ]] \
  || warn "Active gcloud project is '$ACTIVE_PROJECT', expected '$PROJECT_ID'. Proceeding anyway."

info "All checks passed."

# ── 1. Build Docker images ────────────────────────────────────────────────────
divider
info "Step 1/4 — Building Docker images (linux/amd64)..."

cd "$REPO_ROOT"

for svc in "${SERVICES[@]}"; do
  info "  Building ${svc}..."
  docker build \
    --platform linux/amd64 \
    -f "Dockerfile.${svc}" \
    -t "${REGISTRY}/deltaed-${svc}:latest" \
    . \
    || error "Docker build failed for ${svc}"
  info "  ✓ ${svc} image built"
done

# ── 2. Push images ────────────────────────────────────────────────────────────
divider
info "Step 2/4 — Pushing images to GCR..."

for svc in "${SERVICES[@]}"; do
  info "  Pushing ${svc}..."
  docker push "${REGISTRY}/deltaed-${svc}:latest" \
    || error "Docker push failed for ${svc}"
  info "  ✓ ${svc} pushed"
done

# ── 3. Terraform apply ────────────────────────────────────────────────────────
divider
info "Step 3/4 — Running terraform apply..."

cd "${REPO_ROOT}/deployments"
terraform apply -auto-approve \
  || error "Terraform apply failed"
info "✓ Terraform apply complete"

# ── 4. Seed BigQuery ──────────────────────────────────────────────────────────
divider
if $SKIP_SEED; then
  warn "Step 4/4 — Skipping seed (--skip-seed flag set)"
else
  info "Step 4/4 — Seeding BigQuery..."
  cd "${REPO_ROOT}/src"
  uv run python seed.py \
    || error "seed.py failed — check src/.env and ADC credentials"
  info "✓ BigQuery seeded"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
divider
ELAPSED=$(( $(date +%s) - START_TIME ))
info "🚀 Deploy complete in ${ELAPSED}s"
echo
echo -e "  Frontend → ${GREEN}https://deltaed-frontend-wzlqkvs7dq-nw.a.run.app${NC}"
echo -e "  Backend  → ${GREEN}https://deltaed-backend-wzlqkvs7dq-nw.a.run.app${NC}"
echo -e "  Agent    → ${GREEN}https://deltaed-agent-wzlqkvs7dq-nw.a.run.app${NC}"
echo