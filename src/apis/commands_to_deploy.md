# DeltaEd — Deployment Commands Reference

---

## First-Time Setup (Run Once)

```bash
# Authenticate with Google Cloud
gcloud auth login
# Why: Links your local machine to your GCP account so all subsequent commands are authorised.

# Set the default project so you don't have to pass --project every time
gcloud config set project birmiu-agent-two26bir-4072

# Set the default region (London)
gcloud config set run/region europe-west2

# Enable the GCP APIs our app depends on
gcloud services enable \
  run.googleapis.com \
  bigquery.googleapis.com \
  aiplatform.googleapis.com \
  containerregistry.googleapis.com
# Why: Cloud Run (hosting), BigQuery (database), Vertex AI (Gemini agent),
#       Container Registry (storing Docker images) must all be switched on.

# Allow Docker to push images to Google Container Registry
gcloud auth configure-docker gcr.io
# Why: Without this, `docker push gcr.io/...` will fail with an auth error.

# Initialise Terraform (downloads the Google provider plugin)
cd deployments && terraform init
# Why: Terraform needs the google provider binary before it can create any resources.
```

---

## Full Deploy (All 3 Services)

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon

# ── 1. Build Docker images ──────────────────────────────────────────
# --platform linux/amd64  → Cloud Run only runs x86 containers.
#                            Without this flag, macOS Apple Silicon builds arm64
#                            images that crash on Cloud Run.
# -f Dockerfile.xxx       → Tells Docker which Dockerfile to use (we have 3).
# -t gcr.io/PROJECT/NAME  → Tags the image with its registry path so `docker push` knows where to send it.
# .                       → Build context is the repo root (so COPY commands can reach all files).

docker build --platform linux/amd64 -f Dockerfile.backend  -t gcr.io/birmiu-agent-two26bir-4072/deltaed-backend:latest .
docker build --platform linux/amd64 -f Dockerfile.frontend -t gcr.io/birmiu-agent-two26bir-4072/deltaed-frontend:latest .
docker build --platform linux/amd64 -f Dockerfile.agent    -t gcr.io/birmiu-agent-two26bir-4072/deltaed-agent:latest .

# ── 2. Push images to Google Container Registry ─────────────────────
# Why: Cloud Run pulls images from GCR. The image must exist there before deploying.

docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-backend:latest
docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-frontend:latest
docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-agent:latest

# ── 3. Deploy infrastructure + services via Terraform ────────────────
# Why: Terraform creates/updates the Cloud Run services, service account, IAM
#       bindings, and BigQuery datasets in one command.
# -auto-approve skips the "Do you want to apply?" prompt.

cd deployments
terraform apply -auto-approve
```

---

## Deploy Only One Service (Faster)

Use these when you've only changed code in one service and don't want to rebuild everything.

### Frontend only (UI / HTML / CSS / JS changes)

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon

docker build --platform linux/amd64 -f Dockerfile.frontend -t gcr.io/birmiu-agent-two26bir-4072/deltaed-frontend:latest .
docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-frontend:latest

# gcloud run deploy forces Cloud Run to pull the new :latest image and create a new revision.
gcloud run deploy deltaed-frontend \
  --image gcr.io/birmiu-agent-two26bir-4072/deltaed-frontend:latest \
  --region europe-west2 \
  --project birmiu-agent-two26bir-4072 \
  --quiet
```

### Backend only (Python API / BigQuery changes)

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon

docker build --platform linux/amd64 -f Dockerfile.backend -t gcr.io/birmiu-agent-two26bir-4072/deltaed-backend:latest .
docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-backend:latest

gcloud run deploy deltaed-backend \
  --image gcr.io/birmiu-agent-two26bir-4072/deltaed-backend:latest \
  --region europe-west2 \
  --project birmiu-agent-two26bir-4072 \
  --quiet
```

### Agent only (RAG pipeline / AI changes)

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon

docker build --platform linux/amd64 -f Dockerfile.agent -t gcr.io/birmiu-agent-two26bir-4072/deltaed-agent:latest .
docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-agent:latest

gcloud run deploy deltaed-agent \
  --image gcr.io/birmiu-agent-two26bir-4072/deltaed-agent:latest \
  --region europe-west2 \
  --project birmiu-agent-two26bir-4072 \
  --quiet
```

---

## Debugging Commands

```bash
# ── Check if all 3 services are running ──────────────────────────────
gcloud run services list --region europe-west2
# Shows service name, URL, last deployed time, and whether it's healthy.

# ── Read recent logs for a service ───────────────────────────────────
# Replace the service name as needed: deltaed-frontend / deltaed-backend / deltaed-agent
gcloud logging read 'resource.labels.service_name="deltaed-backend"' \
  --project birmiu-agent-two26bir-4072 --limit 20
# Why: When a service returns 500 errors, the actual Python/Node traceback is in the logs.

# ── Read only ERROR-level logs ───────────────────────────────────────
gcloud logging read 'resource.labels.service_name="deltaed-agent" AND severity>=ERROR' \
  --project birmiu-agent-two26bir-4072 --limit 10

# ── See what environment variables a service has ─────────────────────
gcloud run services describe deltaed-agent --region europe-west2 \
  --format="yaml(spec.template.spec.containers[0].env)"
# Why: Useful to verify GOOGLE_GENAI_USE_VERTEXAI=true is actually set.

# ── See which image revision is live ─────────────────────────────────
gcloud run revisions list --service deltaed-frontend --region europe-west2
# Why: Confirms your latest push actually became the active revision.

# ── Health check endpoints ───────────────────────────────────────────
curl https://deltaed-frontend-i67acn6mvq-nw.a.run.app/health
curl https://deltaed-backend-i67acn6mvq-nw.a.run.app/
curl https://deltaed-agent-i67acn6mvq-nw.a.run.app/health
# Why: Quick way to check if a service is alive without opening a browser.

# ── Test login via curl ──────────────────────────────────────────────
curl -X POST https://deltaed-frontend-i67acn6mvq-nw.a.run.app/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}'

# ── Full service YAML dump ───────────────────────────────────────────
gcloud run services describe deltaed-backend --region europe-west2 --format=yaml
# Why: Shows everything — CPU, memory, env vars, IAM, service account, concurrency, etc.
```

---

## Terraform Commands

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon/deployments

# Preview what Terraform will change (dry run — no changes applied)
terraform plan

# Apply all changes
terraform apply -auto-approve

# Apply only one specific resource (e.g., just the frontend service)
terraform apply -auto-approve -target=google_cloud_run_service.deltaed_frontend
# Why: Much faster when you only changed one .tf file.

# List everything Terraform is managing
terraform state list

# If you manually deployed via gcloud and Terraform complains the resource exists:
terraform import google_cloud_run_service.deltaed_frontend \
  locations/europe-west2/namespaces/birmiu-agent-two26bir-4072/services/deltaed-frontend
# Why: Brings an existing Cloud Run service under Terraform's control without destroying it.
```

---

## Local Development

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon

# ── Backend (port 8000) ─────────────────────────────────────────────
source .venv/bin/activate
export GCP_PROJECT_ID=birmiu-agent-two26bir-4072
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
uvicorn src.apis.main:app --host 0.0.0.0 --port 8000 --reload
# --reload watches for file changes and restarts automatically.

# ── Agent (port 8001) ───────────────────────────────────────────────
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT=birmiu-agent-two26bir-4072
export GOOGLE_CLOUD_LOCATION=europe-west2
uvicorn RAG_Pipeline.teacher_agent.server:app --host 0.0.0.0 --port 8001 --reload

# ── Frontend (port 8080) ────────────────────────────────────────────
export BACKEND_URL=http://localhost:8000
export AGENT_URL=http://localhost:8001
npm start
# Opens at http://localhost:8080 — proxies API calls to the local backend & agent.
```

---

## Quick Reference

| What | Command |
|------|---------|
| Build all 3 images | `docker build --platform linux/amd64 -f Dockerfile.{backend,frontend,agent} -t gcr.io/birmiu-agent-two26bir-4072/deltaed-{backend,frontend,agent}:latest .` (run separately for each) |
| Push all images | `docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-backend:latest && docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-frontend:latest && docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-agent:latest` |
| Deploy via Terraform | `cd deployments && terraform apply -auto-approve` |
| Deploy one service fast | `gcloud run deploy SERVICE_NAME --image IMAGE --region europe-west2 --quiet` |
| Check service health | `curl https://SERVICE_URL/health` |
| Read error logs | `gcloud logging read 'resource.labels.service_name="SERVICE" AND severity>=ERROR' --limit 10` |
