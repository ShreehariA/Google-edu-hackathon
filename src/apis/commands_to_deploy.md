# DeltaEd — Deployment Commands Reference

> Last verified: **30 March 2026** on project `deltaed`.

---

## Current Deployment

| Property | Value |
|----------|-------|
| **GCP Project ID** | `deltaed` |
| **Region** | `europe-west2` (London) |
| **Service Account** | `cloud-run-sa@deltaed.iam.gserviceaccount.com` |
| **Container Registry** | `gcr.io/deltaed/` |
| **BigQuery Location** | `EU` |
| **RAG Corpus** | `projects/deltaed/locations/europe-west2/ragCorpora/6917529027641081856` |

### Live URLs

| Service | URL |
|---------|-----|
| Frontend | https://deltaed-frontend-wzlqkvs7dq-nw.a.run.app |
| Backend | https://deltaed-backend-wzlqkvs7dq-nw.a.run.app |
| Agent | https://deltaed-agent-wzlqkvs7dq-nw.a.run.app |

### BigQuery Data (seeded)

| Table | Dataset | Rows |
|-------|---------|------|
| `student_personal_details` | `student_db` | 50 |
| `student_scores` | `student_db` | 9,422 |
| `student_progress` | `student_db` | 739 |
| `chapter_table` | `educational_resources_db` | 25 |
| `subject_table` | `educational_resources_db` | 1 |

---

## First-Time Setup (Run Once Per Machine)

```bash
# 1. Authenticate with Google Cloud
gcloud auth login

# 2. Set defaults so you don't have to pass --project / --region every time
gcloud config set project deltaed
gcloud config set run/region europe-west2

# 3. Enable the GCP APIs our app depends on
gcloud services enable \
  run.googleapis.com \
  bigquery.googleapis.com \
  aiplatform.googleapis.com \
  containerregistry.googleapis.com

# 4. Allow Docker to push images to Google Container Registry
gcloud auth configure-docker gcr.io

# 5. Set Application Default Credentials (needed for local seed.py / dev)
gcloud auth application-default login --project deltaed

# 6. Initialise Terraform (downloads the Google provider plugin)
cd deployments && terraform init
```

---

## Full Deploy (All 3 Services — Step by Step)

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon

# ── 1. Build Docker images ──────────────────────────────────────────
# --platform linux/amd64  → Cloud Run only runs x86 containers.
#                            Without this flag, macOS Apple Silicon builds arm64
#                            images that crash on Cloud Run.
# -f Dockerfile.xxx       → Which Dockerfile to use (we have 3).
# -t gcr.io/PROJECT/NAME  → Tags image with its registry path.
# .                       → Build context is repo root.

docker build --platform linux/amd64 -f Dockerfile.backend  -t gcr.io/deltaed/deltaed-backend:latest .
docker build --platform linux/amd64 -f Dockerfile.frontend -t gcr.io/deltaed/deltaed-frontend:latest .
docker build --platform linux/amd64 -f Dockerfile.agent    -t gcr.io/deltaed/deltaed-agent:latest .

# ── 2. Push images to Google Container Registry ─────────────────────
# Cloud Run pulls images from GCR. They must exist there before deploying.

docker push gcr.io/deltaed/deltaed-backend:latest
docker push gcr.io/deltaed/deltaed-frontend:latest
docker push gcr.io/deltaed/deltaed-agent:latest

# ── 3. Deploy infrastructure + services via Terraform ────────────────
# Creates/updates Cloud Run services, service account, IAM bindings,
# and BigQuery datasets in one command.

cd deployments
terraform apply -auto-approve

# ── 4. Seed BigQuery with mock data (first deploy only) ─────────────
cd ../src
uv run python seed.py
# Reads GoogleEd_hackathon.xlsx and loads rows into BigQuery tables.
# Requires GCP_PROJECT_ID=deltaed in src/.env
```

---

## Deploy All 3 Services (One-Liner)

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon && \
docker build --platform linux/amd64 -f Dockerfile.backend  -t gcr.io/deltaed/deltaed-backend:latest . && \
docker build --platform linux/amd64 -f Dockerfile.frontend -t gcr.io/deltaed/deltaed-frontend:latest . && \
docker build --platform linux/amd64 -f Dockerfile.agent    -t gcr.io/deltaed/deltaed-agent:latest . && \
docker push gcr.io/deltaed/deltaed-backend:latest && \
docker push gcr.io/deltaed/deltaed-frontend:latest && \
docker push gcr.io/deltaed/deltaed-agent:latest && \
cd deployments && \
terraform apply -auto-approve
```

> **When to use:** You changed code across all services, or want a full redeploy. Builds all 3 Docker images, pushes them, and runs Terraform to update Cloud Run.

---

## Deploy Backend + Frontend (No Agent Rebuild)

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon && \
docker build --platform linux/amd64 -f Dockerfile.backend -t gcr.io/deltaed/deltaed-backend:latest . && \
docker build --platform linux/amd64 -f Dockerfile.frontend -t gcr.io/deltaed/deltaed-frontend:latest . && \
docker push gcr.io/deltaed/deltaed-backend:latest && \
docker push gcr.io/deltaed/deltaed-frontend:latest && \
cd deployments && \
terraform apply -auto-approve
```

> **When to use:** Changed backend Python and/or frontend HTML/CSS/JS but did **not** touch `RAG_Pipeline/`. Saves ~2 min.

---

## Deploy Only One Service (Faster)

Use these when you've only changed code in one service and don't want to rebuild everything.

### Frontend only (UI / HTML / CSS / JS changes)

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon

docker build --platform linux/amd64 -f Dockerfile.frontend -t gcr.io/deltaed/deltaed-frontend:latest .
docker push gcr.io/deltaed/deltaed-frontend:latest

# gcloud run deploy forces Cloud Run to pull the new :latest image and create a new revision.
gcloud run deploy deltaed-frontend \
  --image gcr.io/deltaed/deltaed-frontend:latest \
  --region europe-west2 \
  --project deltaed \
  --quiet
```

### Backend only (Python API / BigQuery changes)

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon

docker build --platform linux/amd64 -f Dockerfile.backend -t gcr.io/deltaed/deltaed-backend:latest .
docker push gcr.io/deltaed/deltaed-backend:latest

gcloud run deploy deltaed-backend \
  --image gcr.io/deltaed/deltaed-backend:latest \
  --region europe-west2 \
  --project deltaed \
  --quiet
```

### Agent only (RAG pipeline / AI changes)

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon

docker build --platform linux/amd64 -f Dockerfile.agent -t gcr.io/deltaed/deltaed-agent:latest .
docker push gcr.io/deltaed/deltaed-agent:latest

gcloud run deploy deltaed-agent \
  --image gcr.io/deltaed/deltaed-agent:latest \
  --region europe-west2 \
  --project deltaed \
  --quiet
```

---

## Seed BigQuery (Mock Data)

The seed script reads `src/GoogleEd_hackathon.xlsx` and loads it into BigQuery.

### Prerequisites
- `src/.env` must contain `GCP_PROJECT_ID=deltaed`
- ADC must be logged in: `gcloud auth application-default login --project deltaed`
- BigQuery tables must already exist (created by `terraform apply`)

### Run

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon/src
uv run python seed.py
```

### What it loads

| Excel Sheet | → BigQuery Table | → Dataset |
|-------------|-----------------|-----------|
| `student_personal_details` | `student_personal_details` | `student_db` |
| `student_scores` | `student_scores` | `student_db` |
| `student_progress` | `student_progress` | `student_db` |
| `chapter_table` | `chapter_table` | `educational_resources_db` |
| `subject_table` | `subject_table` | `educational_resources_db` |

> **⚠️ Idempotency:** The script uses `WRITE_APPEND`, so running it twice duplicates rows. To re-seed cleanly, truncate first:
> ```bash
> bq query --use_legacy_sql=false 'TRUNCATE TABLE student_db.student_scores'
> ```

---

## Migrating to a New GCP Project

If the current GCP project expires or you need to move to a different one:

```bash
# 1. List your available projects
gcloud projects list

# 2. Set the new project
gcloud config set project NEW_PROJECT_ID

# 3. Find-and-replace the old project ID across all config files
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon

# Preview what will change:
grep -r "OLD_PROJECT_ID" --include='*.tf' --include='*.md' --include='*.env' --include='*.py' --include='*.js' --include='*.jsx' -l

# Do the replacement:
grep -rl "OLD_PROJECT_ID" --include='*.tf' --include='*.md' --include='*.env' --include='*.py' --include='*.js' --include='*.jsx' | \
  xargs sed -i '' 's/OLD_PROJECT_ID/NEW_PROJECT_ID/g'

# 4. Enable APIs on the new project
gcloud services enable \
  run.googleapis.com bigquery.googleapis.com \
  aiplatform.googleapis.com containerregistry.googleapis.com

# 5. Re-authenticate Docker + ADC
gcloud auth configure-docker gcr.io
gcloud auth application-default login --project NEW_PROJECT_ID

# 6. Clean old Terraform state and re-init
cd deployments
rm -f terraform.tfstate terraform.tfstate.backup
rm -rf .terraform .terraform.lock.hcl
terraform init

# 7. Build, push, and deploy (see "Full Deploy" section above)

# 8. Seed BigQuery
cd ../src
# Update src/.env → GCP_PROJECT_ID=NEW_PROJECT_ID
uv run python seed.py

# 9. Verify RAG corpus exists in the new project (see RAG section below)
```

### Files that contain the project ID (update all)

| File | What to change |
|------|----------------|
| `deployments/variables.tf` | `default = "PROJECT_ID"` |
| `deployments/provider.tf` | `project = "PROJECT_ID"` |
| `src/.env` | `GCP_PROJECT_ID=PROJECT_ID` |
| `src/apis/commands_to_deploy.md` | All commands + URLs |
| `README.md` | Live URLs + project details table |

---

## RAG Corpus Setup (Manual — Not Terraform)

The AI agent uses a **Vertex AI RAG corpus** to ground its responses in the NLP textbook.
This is set up **manually** via the GCP Console because the Google Terraform provider (v5.x)
does not have native resources for Vertex AI RAG Engine (corpus creation, file import, etc.).

### Current Corpus

| Property | Value |
|----------|-------|
| **Corpus ID** | `6917529027641081856` |
| **Full resource name** | `projects/deltaed/locations/europe-west2/ragCorpora/6917529027641081856` |
| **Embedding model** | `text-multilingual-embedding-002` |
| **Corpus name** | `NLP_Book_Corpus` |
| **Source PDF** | `Speech and Language Processing_ed3book_jan26.pdf` (Jurafsky & Martin, 3rd ed.) |
| **GCS bucket** | `gs://deltaed_nlp/` |

### How We Set It Up (Step by Step)

#### Step 1 — Create a GCS bucket and upload the book

1. Go to **Cloud Storage** → https://console.cloud.google.com/storage/browser?project=deltaed
2. Click **Create Bucket**
   - Name: `deltaed_nlp`
   - Location type: **Region** → `europe-west2`
   - Default storage class: **Standard**
   - Click **Create**
3. Upload the PDF:
   - Click **Upload Files** → select `Speech and Language Processing_ed3book_jan26.pdf`
   - Or via CLI:
     ```bash
     gsutil cp "Speech and Language Processing_ed3book_jan26.pdf" gs://deltaed_nlp/
     ```

#### Step 2 — Create a RAG corpus in Vertex AI

1. Go to **Vertex AI → RAG Engine** → https://console.cloud.google.com/vertex-ai/rag/corpora?project=deltaed
2. Click **Create Corpus**
   - Name: `NLP_Book_Corpus`
   - Region: `europe-west2`
   - Embedding model: `text-multilingual-embedding-002` (Google's multilingual embedding)
3. Click **Create** — note the numeric **Corpus ID** shown (e.g. `6917529027641081856`)

#### Step 3 — Import the PDF into the corpus

1. In the RAG Engine console, click into your newly created corpus
2. Click **Import Files**
   - Source: **Cloud Storage**
   - GCS path: `gs://deltaed_nlp/Speech and Language Processing_ed3book_jan26.pdf`
   - Chunk size: use defaults (512 tokens) or adjust as needed
3. Click **Import** — wait for the job to complete (may take a few minutes for large PDFs)

#### Step 4 — Update config and redeploy the agent

The corpus resource name follows this pattern:
```
projects/{PROJECT_ID}/locations/{REGION}/ragCorpora/{CORPUS_ID}
```

Update these files with the new corpus ID:

| File | What to update |
|------|----------------|
| `deployments/agent_cloud_run.tf` | `GOOGLE_RAG_CORPUS` env var (line ~23) |
| `src/.env` | `GOOGLE_RAG_CORPUS=projects/deltaed/locations/europe-west2/ragCorpora/{NEW_ID}` |
| `src/apis/commands_to_deploy.md` | This section + the "Current Deployment" table at the top |

Then redeploy the agent:
```bash
cd deployments && terraform apply -auto-approve -target=google_cloud_run_service.deltaed_agent
```

Or with `sed` for a bulk ID replace:
```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon
grep -rl 'OLD_CORPUS_ID' --include='*.tf' --include='*.env' --include='*.md' | \
  while IFS= read -r f; do sed -i '' 's/OLD_CORPUS_ID/NEW_CORPUS_ID/g' "$f"; done
```

### Why Not Terraform?

The `hashicorp/google` provider (v5.x) supports `google_vertex_ai_dataset`, `google_vertex_ai_index`,
etc., but does **not** have resources for:
- `google_vertex_ai_rag_corpus` (create a RAG corpus)
- `google_vertex_ai_rag_file` (import a file into a corpus)

There is also no `gcloud ai rag-corpora` CLI command. The only options are:
1. **GCP Console** (what we use — simplest)
2. **REST API** (`aiplatform.googleapis.com/v1beta1/...ragCorpora`)
3. **Python SDK** (`vertexai.preview.rag`)

Since the corpus only needs to be created once per project, the console approach is the easiest.

### To verify it's working

```bash
# Agent health check
curl https://deltaed-agent-wzlqkvs7dq-nw.a.run.app/health

# Check for RAG-related errors in agent logs
gcloud logging read 'resource.labels.service_name="deltaed-agent" AND severity>=ERROR' \
  --project deltaed --limit 10

# Verify the env var is set on the running service
gcloud run services describe deltaed-agent --region europe-west2 \
  --format="yaml(spec.template.spec.containers[0].env)" | grep RAG
```

---

## Debugging Commands

```bash
# ── Check if all 3 services are running ──────────────────────────────
gcloud run services list --region europe-west2 --project deltaed

# ── Read recent logs for a service ───────────────────────────────────
gcloud logging read 'resource.labels.service_name="deltaed-backend"' \
  --project deltaed --limit 20

# ── Read only ERROR-level logs ───────────────────────────────────────
gcloud logging read 'resource.labels.service_name="deltaed-agent" AND severity>=ERROR' \
  --project deltaed --limit 10

# ── See what environment variables a service has ─────────────────────
gcloud run services describe deltaed-agent --region europe-west2 \
  --format="yaml(spec.template.spec.containers[0].env)"

# ── See which image revision is live ─────────────────────────────────
gcloud run revisions list --service deltaed-frontend --region europe-west2

# ── Health check endpoints ───────────────────────────────────────────
curl https://deltaed-frontend-wzlqkvs7dq-nw.a.run.app/health
curl https://deltaed-backend-wzlqkvs7dq-nw.a.run.app/
curl https://deltaed-agent-wzlqkvs7dq-nw.a.run.app/health

# ── Test login via curl ──────────────────────────────────────────────
curl -X POST https://deltaed-frontend-wzlqkvs7dq-nw.a.run.app/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}'

# ── Full service YAML dump ───────────────────────────────────────────
gcloud run services describe deltaed-backend --region europe-west2 --format=yaml

# ── BigQuery — check row counts ──────────────────────────────────────
bq query --use_legacy_sql=false \
  'SELECT "student_scores" AS tbl, COUNT(*) AS rows FROM student_db.student_scores
   UNION ALL
   SELECT "student_progress", COUNT(*) FROM student_db.student_progress
   UNION ALL
   SELECT "student_personal_details", COUNT(*) FROM student_db.student_personal_details
   UNION ALL
   SELECT "chapter_table", COUNT(*) FROM educational_resources_db.chapter_table'
```

---

## Terraform Commands

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon/deployments

# Preview changes (dry run)
terraform plan

# Apply all changes
terraform apply -auto-approve

# Apply only one resource (faster)
terraform apply -auto-approve -target=google_cloud_run_service.deltaed_frontend

# List everything Terraform manages
terraform state list

# Import an existing resource into state
terraform import google_cloud_run_service.deltaed_frontend \
  locations/europe-west2/namespaces/deltaed/services/deltaed-frontend
```

---

## Local Development

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon

# ── Backend (port 8000) ─────────────────────────────────────────────
source .venv/bin/activate
export GCP_PROJECT_ID=deltaed
uvicorn src.apis.main:app --host 0.0.0.0 --port 8000 --reload

# ── Agent (port 8001) ───────────────────────────────────────────────
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT=deltaed
export GOOGLE_CLOUD_LOCATION=europe-west2
uvicorn RAG_Pipeline.teacher_agent.server:app --host 0.0.0.0 --port 8001 --reload

# ── Frontend (port 8080) ────────────────────────────────────────────
export BACKEND_URL=http://localhost:8000
export AGENT_URL=http://localhost:8001
npm start
```

---

## Quick Reference

| What | Command |
|------|---------|
| Build all images | Run each: `docker build --platform linux/amd64 -f Dockerfile.{backend,frontend,agent} -t gcr.io/deltaed/deltaed-{name}:latest .` |
| Push all images | `docker push gcr.io/deltaed/deltaed-backend:latest && docker push ...frontend... && ...agent...` |
| Deploy via Terraform | `cd deployments && terraform apply -auto-approve` |
| Deploy one service | `gcloud run deploy SERVICE --image IMAGE --region europe-west2 --quiet` |
| Seed BigQuery | `cd src && uv run python seed.py` |
| Check health | `curl https://SERVICE_URL/health` |
| Read error logs | `gcloud logging read 'resource.labels.service_name="SERVICE" AND severity>=ERROR' --limit 10` |
| Check BQ row counts | `bq query --use_legacy_sql=false 'SELECT COUNT(*) FROM student_db.student_scores'` |
