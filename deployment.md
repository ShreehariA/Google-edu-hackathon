# deploy.sh — DeltaEd Deploy Script

A single script that builds all Docker images, pushes them to GCR, runs Terraform, and prepares the demo data. One command to go from code to live — and safe to re-run.

---

## Prerequisites

Make sure these are installed and configured before running:

- **Docker** — running locally (the script checks)
- **gcloud CLI** — authenticated (`gcloud auth login`); provides `bq`
- **Terraform** — installed (the script runs `terraform init` itself)
- **uv** — Python package runner (used to run `seed.py` in an isolated env)
- **ADC credentials** — `gcloud auth application-default login` (any quota project is fine; the script bills API calls to `deltaed`)
- **`src/.env`** — must contain `GCP_PROJECT_ID=deltaed`

---

## Usage

### Full deploy (all 3 services + demo data)
```bash
./deploy.sh
```
Builds backend, frontend, and agent images → pushes to GCR → `terraform apply` with the pushed image digests → demo data. Safe to re-run: seeding is skipped when BigQuery already has data.

### Skip the demo-data step
```bash
./deploy.sh --skip-seed
```

### Skip the agent (only changed backend/frontend)
```bash
./deploy.sh --skip-agent
```
Saves ~2 minutes by skipping the agent Docker build and push (the deployed agent is kept).

### Combine flags
```bash
./deploy.sh --skip-agent --skip-seed
```

---

## What it does, step by step

| Step | What happens |
|------|-------------|
| **Pre-flight** | Checks docker (daemon running), gcloud, bq, terraform, uv; enables the required GCP APIs; configures Docker auth for `gcr.io` |
| **Build** | `docker build --platform linux/amd64` for each service (Cloud Run doesn't support arm64) |
| **Push** | Pushes each image to `gcr.io/deltaed/` |
| **Terraform** | `terraform init` + `terraform apply` with each service pinned to its pushed **image digest**, so changed images always roll out (a `:latest` tag alone never changes, so Terraform would see no diff) |
| **Demo data** | Runs `seed.py` only if `student_scores` is empty → shifts demo dates so the newest data is yesterday (`deployments/sql/shift_demo_dates.sql`) → registers the README test users via `/register` |

The date shift also runs **daily at 00:05 UTC** as a BigQuery scheduled query (`deployments/demo_data_refresh.tf`), because the leaderboard and dashboard only look at the last 14 days.

---

## After it runs

The script prints the three live URLs (from `terraform output`) on completion:

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

All three services keep one instance warm (`minScale = 1`), so they bill while idle. Tear down with `cd deployments && terraform destroy` when you're done.

---

## Troubleshooting

**Script exits early with a red `[error]`** — read the message. It tells you exactly which step failed (e.g. Docker build, Terraform, seed).

**`seed.py` fails** — check that `src/.env` has `GCP_PROJECT_ID=deltaed` and that ADC is set: `gcloud auth application-default login`.

**Terraform errors** — run `cd deployments && terraform plan` manually to see what's wrong before retrying.

**Leaderboard / dashboard empty** — the demo dates are stale. Run the shift manually:
```bash
bq --project_id=deltaed --location=EU query --use_legacy_sql=false < deployments/sql/shift_demo_dates.sql
```

**Re-seed from scratch** — truncate, then re-run (seeding only happens on empty tables):
```bash
for t in student_db.student_scores student_db.student_progress student_db.student_personal_details \
         educational_resources_db.chapter_table educational_resources_db.subject_table; do
  bq --project_id=deltaed query --use_legacy_sql=false "TRUNCATE TABLE $t"
done
./deploy.sh --skip-agent
```
