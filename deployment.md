# deploy.sh — DeltaEd Deploy Script

A single script that builds all Docker images, pushes them to GCR, runs Terraform, and seeds BigQuery. One command to go from code to live.

---

## Prerequisites

Make sure these are installed and configured before running:

- **Docker** — running locally
- **gcloud CLI** — authenticated (`gcloud auth login`)
- **Terraform** — initialised (`cd deployments && terraform init`)
- **uv** — Python package runner (used by `seed.py`)
- **ADC credentials** — set via `gcloud auth application-default login --project deltaed`
- **`src/.env`** — must contain `GCP_PROJECT_ID=deltaed`

---

## Setup (one time)

```bash
# 1. Drop the script into your repo root
cp deploy.sh /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon/

# 2. Make it executable
chmod +x deploy.sh
```

---

## Usage

### Full deploy (all 3 services + seed)
```bash
./deploy.sh
```
Builds backend, frontend, and agent images → pushes to GCR → `terraform apply` → seeds BigQuery.

### Skip seeding (subsequent deploys)
```bash
./deploy.sh --skip-seed
```
Use this after the first deploy — re-seeding appends duplicate rows to BigQuery.

### Skip the agent (only changed backend/frontend)
```bash
./deploy.sh --skip-agent
```
Saves ~2 minutes by skipping the agent Docker build and push.

### Combine flags
```bash
./deploy.sh --skip-agent --skip-seed
```

---

## What it does, step by step

| Step | What happens |
|------|-------------|
| **Pre-flight** | Checks that docker, gcloud, terraform, and uv are all available |
| **Build** | `docker build --platform linux/amd64` for each service (linux/amd64 required — Cloud Run doesn't support arm64) |
| **Push** | Pushes each image to `gcr.io/deltaed/` |
| **Terraform** | Runs `terraform apply -auto-approve` from the `deployments/` folder |
| **Seed** | Runs `uv run python seed.py` from `src/` to load BigQuery tables |

---

## After it runs

The script prints the three live URLs on completion:

```
Frontend → https://deltaed-frontend-wzlqkvs7dq-nw.a.run.app
Backend  → https://deltaed-backend-wzlqkvs7dq-nw.a.run.app
Agent    → https://deltaed-agent-wzlqkvs7dq-nw.a.run.app
```

To verify everything is healthy:
```bash
curl https://deltaed-backend-wzlqkvs7dq-nw.a.run.app/
curl https://deltaed-agent-wzlqkvs7dq-nw.a.run.app/health
```

---

## Troubleshooting

**Script exits early with a red `[error]`** — read the message. It tells you exactly which step failed (e.g. Docker build, Terraform, seed).

**`seed.py` fails** — check that `src/.env` has `GCP_PROJECT_ID=deltaed` and that ADC is set: `gcloud auth application-default login --project deltaed`.

**Terraform errors** — run `cd deployments && terraform plan` manually to see what's wrong before retrying.

**Duplicate BigQuery rows** — if you accidentally ran seed twice, truncate first:
```bash
bq query --use_legacy_sql=false 'TRUNCATE TABLE student_db.student_scores'
```
Then re-run with `./deploy.sh --skip-agent` (no need to rebuild images just to reseed).