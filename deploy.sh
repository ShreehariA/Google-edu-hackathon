#!/usr/bin/env bash
# =============================================================================
# deploy.sh — DeltaEd full deploy: build → push → terraform → demo data
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
      echo "  --skip-seed   Skip the demo-data step (seed, date refresh, test users)"
      echo "  --skip-agent  Skip building/pushing the agent image (keeps the deployed one)"
      exit 0 ;;
    *) error "Unknown flag: $arg" ;;
  esac
done

# ── Config ───────────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ID="deltaed"
REGION="europe-west2"
REGISTRY="gcr.io/${PROJECT_ID}"

# Bill API quota to this project even when the machine's ADC credentials carry a
# different quota project (Terraform and seed.py authenticate with ADC).
export GOOGLE_CLOUD_QUOTA_PROJECT="$PROJECT_ID"
export GOOGLE_BILLING_PROJECT="$PROJECT_ID"
export USER_PROJECT_OVERRIDE=true

# README test accounts, (re)registered through the backend's /register endpoint
TEST_USERS=(
  "mei.lin@example.com:meilin"
  "fatima.alhassan@example.com:fatimaalhassan"
  "wei.chen@example.com:weichen"
)

SERVICES=("backend" "frontend")
$SKIP_AGENT || SERVICES+=("agent")

START_TIME=$(date +%s)

# ── Pre-flight checks ─────────────────────────────────────────────────────────
divider
info "Pre-flight checks..."

command -v docker     >/dev/null 2>&1 || error "docker not found"
command -v gcloud     >/dev/null 2>&1 || error "gcloud not found"
command -v bq         >/dev/null 2>&1 || error "bq not found (ships with the gcloud SDK)"
command -v terraform  >/dev/null 2>&1 || error "terraform not found"
command -v uv         >/dev/null 2>&1 || error "uv not found (needed for seed.py)"
docker info           >/dev/null 2>&1 || error "Docker daemon not running — start Docker Desktop"

[[ -f "$REPO_ROOT/src/.env" ]] || warn "src/.env not found — seed may fail"

ACTIVE_PROJECT=$(gcloud config get-value project 2>/dev/null)
[[ "$ACTIVE_PROJECT" == "$PROJECT_ID" ]] \
  || warn "Active gcloud project is '$ACTIVE_PROJECT', expected '$PROJECT_ID'. Proceeding anyway."

info "Enabling required APIs (no-op if already enabled)..."
gcloud services enable --project "$PROJECT_ID" \
  run.googleapis.com artifactregistry.googleapis.com iam.googleapis.com \
  cloudresourcemanager.googleapis.com bigquery.googleapis.com \
  bigquerydatatransfer.googleapis.com aiplatform.googleapis.com \
  || error "Could not enable required APIs"
gcloud auth configure-docker gcr.io --quiet >/dev/null 2>&1 \
  || warn "Could not configure Docker auth for gcr.io"

info "All checks passed."

# ── 1. Build Docker images ────────────────────────────────────────────────────
divider
info "Step 1/4 — Building Docker images (linux/amd64)..."

cd "$REPO_ROOT"

for svc in "${SERVICES[@]}"; do
  info "  Building ${svc}..."
  # --provenance=false: build attestations embed timestamps, which would give an
  # unchanged image a new digest (and a needless Cloud Run rollout) on every run.
  docker build \
    --platform linux/amd64 \
    --provenance=false \
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
terraform init -input=false >/dev/null || error "terraform init failed"

# Deploy exact image digests. The ":latest" tag string never changes, so without
# this terraform sees no diff and Cloud Run keeps serving the old revision.
TF_VARS=()
for svc in backend frontend agent; do
  digest=$(gcloud container images describe "${REGISTRY}/deltaed-${svc}:latest" \
             --format='value(image_summary.digest)' 2>/dev/null) || digest=""
  [[ -n "$digest" ]] || error "No pushed image found for ${REGISTRY}/deltaed-${svc}:latest"
  TF_VARS+=(-var "${svc}_docker_image=${REGISTRY}/deltaed-${svc}@${digest}")
  info "  ${svc} → ${digest:0:19}…"
done

terraform apply -auto-approve -input=false "${TF_VARS[@]}" \
  || error "Terraform apply failed"
info "✓ Terraform apply complete"

# ── 4. Demo data ──────────────────────────────────────────────────────────────
divider
if $SKIP_SEED; then
  warn "Step 4/4 — Skipping demo data (--skip-seed flag set)"
else
  info "Step 4/4 — Demo data (seed, date refresh, test users)..."
  BQ=(bq --project_id="$PROJECT_ID" --location=EU)

  # seed.py appends rows, so only run it against empty tables
  ROWS=$("${BQ[@]}" query --use_legacy_sql=false --format=csv \
           'SELECT COUNT(*) FROM student_db.student_scores' 2>/dev/null | tail -n 1) || ROWS=""
  if [[ "$ROWS" =~ ^[0-9]+$ ]] && (( ROWS > 0 )); then
    info "  BigQuery already holds ${ROWS} score rows — skipping seed.py (it would duplicate them)"
  else
    # Isolated env: src/ is a member of a parent uv workspace on some machines,
    # so a plain `uv run` would resolve (and re-lock) that workspace instead.
    cd "${REPO_ROOT}/src"
    uv run --no-project --quiet \
      --with pandas --with openpyxl --with google-cloud-bigquery --with python-dotenv \
      python seed.py \
      || error "seed.py failed — check src/.env and ADC credentials"
    info "  ✓ BigQuery seeded"
  fi

  # Same query terraform schedules daily (demo_data_refresh.tf); run it now so the
  # leaderboard/dashboard are populated straight after a fresh seed.
  SHIFTED=$("${BQ[@]}" query --use_legacy_sql=false --format=csv \
              < "${REPO_ROOT}/deployments/sql/shift_demo_dates.sql" 2>/dev/null | tail -n 1) \
    || error "Refreshing demo dates failed"
  info "  ✓ Demo dates current (shifted ${SHIFTED:-0} days)"

  BACKEND_URL=$(cd "${REPO_ROOT}/deployments" && terraform output -raw backend_url)
  for pair in "${TEST_USERS[@]}"; do
    email="${pair%%:*}"; password="${pair#*:}"
    code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BACKEND_URL}/register" \
             -H 'Content-Type: application/json' \
             -d "{\"email\":\"${email}\",\"password\":\"${password}\"}") || code="000"
    case "$code" in
      201) info "  ✓ test user ${email} created" ;;
      409) info "  ✓ test user ${email} already exists" ;;
      *)   warn "  test user ${email}: unexpected HTTP ${code}" ;;
    esac
  done
fi

# ── Done ──────────────────────────────────────────────────────────────────────
divider
ELAPSED=$(( $(date +%s) - START_TIME ))
info "🚀 Deploy complete in ${ELAPSED}s"
cd "${REPO_ROOT}/deployments"
echo
echo -e "  Frontend → ${GREEN}$(terraform output -raw frontend_url)${NC}"
echo -e "  Backend  → ${GREEN}$(terraform output -raw backend_url)${NC}"
echo -e "  Agent    → ${GREEN}$(terraform output -raw agent_url)${NC}"
echo
