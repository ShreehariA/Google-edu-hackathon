# DeltaEd — Growth-Based Student Leaderboard & AI Coach

> **DeltaEd** ranks students by how much *they personally improve* — not by who was already the best. An AI Coach (RAG-powered) helps each student understand their gaps and guides them through targeted tutoring.

**Live URL:** `https://deltaed-frontend-i67acn6mvq-nw.a.run.app`

**Mock Dataset:** [Google Sheets — Student Mock Data](https://docs.google.com/spreadsheets/d/1aUmnma34xuWABBQDLeSJ5bi5Y_Aca14vCPoYXyA2WfI/edit?gid=246495887#gid=246495887)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Local Development](#local-development)
5. [Environment Variables](#environment-variables)
6. [Deploying to Google Cloud Run](#deploying-to-google-cloud-run)
7. [Terraform Infrastructure](#terraform-infrastructure)
8. [Common Operations](#common-operations)
9. [Troubleshooting](#troubleshooting)
10. [BigQuery Schema](#bigquery-schema)

---

## Architecture Overview

### Cloud Infrastructure

DeltaEd runs as **three microservices** on Google Cloud Run, deployed via Terraform with Docker containers.

![Cloud Infrastructure Architecture](infra%20architecture.png)

### System Architecture

End-to-end flow from UI pages through the backend and agent services to BigQuery and the vector store.

![System Architecture](system%20architecture.png)

### Multi-Agent System (Google ADK)

The AI Coach is a multi-agent system built on Google ADK. The **Learning Orchestrator** routes student queries to specialised sub-agents, each grounded in educational principles.

![Agent Architecture](Agent%20Architecture.png)

### Three Cloud Run Services

| Service | Image | Description |
|---------|-------|-------------|
| `deltaed-frontend` | `Dockerfile.frontend` | Express server serving static HTML/CSS/JS + reverse proxy to backend & agent |
| `deltaed-backend` | `Dockerfile.backend` | FastAPI API for auth, leaderboard, dashboard with BigQuery |
| `deltaed-agent` | `Dockerfile.agent` | FastAPI + Google ADK RAG teacher agent with Gemini 2.5 Flash |

---

## Project Structure

```
.
├── static/                     # Frontend HTML/CSS/JS (served by Express)
│   ├── index.html              # Login page
│   ├── leaderboard.html        # Growth leaderboard
│   ├── dashboard.html          # Student progress dashboard
│   ├── chat.html               # AI Coach chat interface
│   ├── script.js               # Main app logic (auth, leaderboard, dashboard, chat)
│   ├── config.js               # Runtime config (API_BASE)
│   ├── style.css               # Shared design system
│   ├── login.css               # Login page styles
│   ├── leaderboard.css         # Leaderboard styles
│   ├── dashboard.css           # Dashboard styles
│   └── chat.css                # Chat styles
│
├── server.js                   # Express proxy server (frontend entrypoint)
├── package.json                # Node.js dependencies
│
├── src/
│   └── apis/
│       └── main.py             # FastAPI backend (auth, leaderboard, dashboard)
│
├── RAG_Pipeline/
│   └── teacher_agent/
│       ├── server.py           # FastAPI agent server (/agent/init, /agent/run)
│       ├── agent.py            # Root ADK agent definition
│       ├── callbacks.py        # ADK callbacks
│       ├── sub_agents/         # Performance, Focus, Tutor, Explore, ScopeGate agents
│       ├── tools/              # BigQuery tools, RAG tools, orchestrator tools
│       └── explore_agent/      # Web search explore agent
│
├── Dockerfile.frontend         # Frontend Docker image
├── Dockerfile.backend          # Backend Docker image
├── Dockerfile.agent            # Agent Docker image
├── requirements.txt            # Python dependencies (backend + agent)
│
└── deployments/                # Terraform IaC
    ├── provider.tf             # GCP provider config
    ├── variables.tf            # Variable declarations
    ├── main.tf                 # Service account, IAM, BigQuery datasets/tables
    ├── frontend_cloud_run.tf   # Frontend Cloud Run service
    ├── backend_cloud_run.tf    # Backend Cloud Run service
    └── agent_cloud_run.tf      # Agent Cloud Run service
```

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Docker Desktop** | 4.x+ | Building & pushing container images |
| **Google Cloud SDK (`gcloud`)** | 561+ | Auth, container registry, Cloud Run deploys |
| **Terraform** | 1.14+ | Infrastructure as Code |
| **Node.js** | 20+ | Frontend local dev |
| **Python** | 3.11+ | Backend & agent local dev |

### One-Time GCP Setup

```bash
# Authenticate
gcloud auth login
gcloud config set project birmiu-agent-two26bir-4072
gcloud config set run/region europe-west2

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  bigquery.googleapis.com \
  aiplatform.googleapis.com \
  containerregistry.googleapis.com

# Configure Docker for GCR
gcloud auth configure-docker gcr.io
```

---

## Local Development

### Backend (FastAPI)

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set environment variables
export GCP_PROJECT_ID=birmiu-agent-two26bir-4072
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Run backend
uvicorn src.apis.main:app --host 0.0.0.0 --port 8000 --reload
```

### Agent (RAG Teacher)

```bash
# Same venv as backend
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT=birmiu-agent-two26bir-4072
export GOOGLE_CLOUD_LOCATION=europe-west2

# Run agent
uvicorn RAG_Pipeline.teacher_agent.server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend (Express Proxy)

```bash
npm install

# Point to local backends
export BACKEND_URL=http://localhost:8000
export AGENT_URL=http://localhost:8001

npm start
# → http://localhost:8080
```

---

## Environment Variables

### Frontend (`server.js`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Server port (Cloud Run sets this automatically — do NOT set in Terraform) |
| `BACKEND_URL` | `http://localhost:8000` | Backend API URL (set by Terraform in production) |
| `AGENT_URL` | `http://localhost:8001` | Agent API URL (set by Terraform in production) |
| `NODE_ENV` | `development` | Environment mode |

### Backend (`src/apis/main.py`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GCP_PROJECT_ID` | ✅ | Google Cloud project ID |

### Agent (`RAG_Pipeline/teacher_agent/server.py`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLOUD_PROJECT` | ✅ | Google Cloud project ID |
| `GOOGLE_CLOUD_LOCATION` | ✅ | GCP region (e.g. `europe-west2`) |
| `GOOGLE_GENAI_USE_VERTEXAI` | ✅ | Must be `true` — tells ADK to use Vertex AI, not Gemini API key |
| `BIGQUERY_SCORES_DATASET_ID` | ✅ | BigQuery dataset for scores (`student_db`) |
| `BIGQUERY_CHAPTER_DATASET_ID` | ✅ | BigQuery dataset for chapters (`educational_resources_db`) |
| `GOOGLE_RAG_CORPUS` | ✅ | Vertex AI RAG corpus resource path |

---

## Deploying to Google Cloud Run

### Quick Deploy (All Three Services)

```bash
cd /path/to/Google-edu-hackathon

# 1. Build all images (must use linux/amd64 for Cloud Run)
docker build --platform linux/amd64 -f Dockerfile.backend  -t gcr.io/birmiu-agent-two26bir-4072/deltaed-backend:latest .
docker build --platform linux/amd64 -f Dockerfile.frontend -t gcr.io/birmiu-agent-two26bir-4072/deltaed-frontend:latest .
docker build --platform linux/amd64 -f Dockerfile.agent    -t gcr.io/birmiu-agent-two26bir-4072/deltaed-agent:latest .

# 2. Push to Google Container Registry
docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-backend:latest
docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-frontend:latest
docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-agent:latest

# 3. Apply infrastructure + deploy
cd deployments
terraform init    # first time only
terraform apply -auto-approve
```

### Deploy Frontend Only (Fastest — UI changes)

```bash
docker build --platform linux/amd64 -f Dockerfile.frontend -t gcr.io/birmiu-agent-two26bir-4072/deltaed-frontend:latest .
docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-frontend:latest
gcloud run deploy deltaed-frontend \
  --image gcr.io/birmiu-agent-two26bir-4072/deltaed-frontend:latest \
  --region europe-west2 \
  --project birmiu-agent-two26bir-4072 \
  --quiet
```

### Deploy Backend Only (API changes)

```bash
docker build --platform linux/amd64 -f Dockerfile.backend -t gcr.io/birmiu-agent-two26bir-4072/deltaed-backend:latest .
docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-backend:latest
gcloud run deploy deltaed-backend \
  --image gcr.io/birmiu-agent-two26bir-4072/deltaed-backend:latest \
  --region europe-west2 \
  --project birmiu-agent-two26bir-4072 \
  --quiet
```

### Deploy Agent Only (RAG/AI changes)

```bash
docker build --platform linux/amd64 -f Dockerfile.agent -t gcr.io/birmiu-agent-two26bir-4072/deltaed-agent:latest .
docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-agent:latest
gcloud run deploy deltaed-agent \
  --image gcr.io/birmiu-agent-two26bir-4072/deltaed-agent:latest \
  --region europe-west2 \
  --project birmiu-agent-two26bir-4072 \
  --quiet
```

---

## Terraform Infrastructure

### What Terraform Manages

| Resource | File | Description |
|----------|------|-------------|
| Service Account | `main.tf` | `cloud-run-sa` with BigQuery + Vertex AI roles |
| BigQuery Datasets | `main.tf` | `auth_creds`, `student_db`, `educational_resources_db` (EU) |
| BigQuery Tables | `main.tf` | `user_creds_db`, `student_scores`, `student_progress`, `student_personal_details`, `chapter_table`, `subject_table` |
| Frontend Service | `frontend_cloud_run.tf` | Public, proxies to backend + agent |
| Backend Service | `backend_cloud_run.tf` | Public (called by frontend proxy) |
| Agent Service | `agent_cloud_run.tf` | Public (called by frontend proxy) |
| IAM Bindings | `*_cloud_run.tf` | `allUsers` invoker for all three services |

### Key Terraform Commands

```bash
cd deployments

# Preview changes
terraform plan

# Apply all changes
terraform apply -auto-approve

# Deploy only one service (e.g., frontend)
terraform apply -auto-approve -target=google_cloud_run_service.deltaed_frontend

# View current state
terraform state list

# Import an existing resource
terraform import google_cloud_run_service.deltaed_frontend \
  locations/europe-west2/namespaces/birmiu-agent-two26bir-4072/services/deltaed-frontend
```

---

## Common Operations

### Check Service Status

```bash
gcloud run services list --region europe-west2 --project birmiu-agent-two26bir-4072
```

### View Service Logs

```bash
# Frontend logs
gcloud logging read 'resource.labels.service_name="deltaed-frontend"' \
  --project birmiu-agent-two26bir-4072 --limit 20

# Backend error logs
gcloud logging read 'resource.labels.service_name="deltaed-backend" AND severity>=ERROR' \
  --project birmiu-agent-two26bir-4072 --limit 10

# Agent error logs
gcloud logging read 'resource.labels.service_name="deltaed-agent" AND severity>=ERROR' \
  --project birmiu-agent-two26bir-4072 --limit 10
```

### Check Service Environment Variables

```bash
gcloud run services describe deltaed-frontend --region europe-west2 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

### Test Endpoints Directly

```bash
# Health checks
curl https://deltaed-frontend-i67acn6mvq-nw.a.run.app/health
curl https://deltaed-backend-i67acn6mvq-nw.a.run.app/
curl https://deltaed-agent-i67acn6mvq-nw.a.run.app/health

# Register a user
curl -X POST https://deltaed-frontend-i67acn6mvq-nw.a.run.app/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}'

# Login
curl -X POST https://deltaed-frontend-i67acn6mvq-nw.a.run.app/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass123"}'

# Leaderboard
curl https://deltaed-frontend-i67acn6mvq-nw.a.run.app/leaderboard
```

---

## Troubleshooting

### Problem → Cause → Fix

| Symptom | Cause | Fix |
|---------|-------|-----|
| Login hangs / no response | `express.json()` consumes POST body before proxy forwards it | Remove `express.json()` from `server.js` |
| Backend returns `403 Forbidden` | Cloud Run IAM rejects unauthenticated calls | Add `allUsers` as `roles/run.invoker` on the backend service |
| Backend `500` — "Dataset not found in location US" | BigQuery client defaults to US but datasets are in EU | Set `bigquery.Client(project=..., location="EU")` in `main.py` |
| Agent `500` — "No API key was provided" | ADK tries Gemini API instead of Vertex AI | Add `GOOGLE_GENAI_USE_VERTEXAI=true` env var to agent service |
| Agent `500` — "Permission denied" on Vertex AI | Service account missing AI Platform role | Add `roles/aiplatform.user` IAM binding for the service account |
| Frontend shows blank page | Missing `config.js` referenced by HTML | Create `static/config.js` with `var CONFIG = { API_BASE: '' };` |
| Docker push fails with auth error | Docker not configured for GCR | Run `gcloud auth configure-docker gcr.io` |
| Terraform wants to recreate services | State drift from manual `gcloud run deploy` | Run `terraform apply` to reconcile, or `terraform import` the resource |
| `EADDRINUSE` on frontend | Duplicate `app.listen()` in `server.js` | Ensure only one `app.listen()` call exists |
| Cloud Run fails with "PORT is reserved" | `PORT` env var set in Terraform | Remove `PORT` from env block — Cloud Run injects it automatically |

### Useful Debug Commands

```bash
# Check what image a service is running
gcloud run revisions list --service deltaed-frontend --region europe-west2

# Force a new revision (same image)
gcloud run deploy deltaed-frontend \
  --image gcr.io/birmiu-agent-two26bir-4072/deltaed-frontend:latest \
  --region europe-west2

# Describe full service config
gcloud run services describe deltaed-backend --region europe-west2 --format=yaml
```

---

## BigQuery Schema

All datasets are in the **EU** region.

### `auth_creds.user_creds_db`

| Column | Type | Description |
|--------|------|-------------|
| `username` | STRING | User email |
| `hashkey` | STRING | SHA-256 hashed password |
| `login_time` | TIMESTAMP | Registration timestamp |

### `student_db.student_personal_details`

| Column | Type | Description |
|--------|------|-------------|
| `student_id` | STRING | Unique student identifier |
| `name` | STRING | Full name |
| `email_address` | STRING | Email (links to auth) |

### `student_db.student_scores`

| Column | Type | Description |
|--------|------|-------------|
| `student_id` | STRING | Student identifier |
| `subject` | STRING | Subject name |
| `chapter` | STRING | Chapter name |
| `correct` | FLOAT | Score (0.0–1.0) |
| `timestamp` | TIMESTAMP | When the score was recorded |

### `student_db.student_progress`

| Column | Type | Description |
|--------|------|-------------|
| `student_id` | STRING | Student identifier |
| `chapter_id` | STRING | Chapter identifier |
| `status` | STRING | Progress status |

### `educational_resources_db.chapter_table` / `subject_table`

Curriculum structure — chapters belonging to subjects.

---

## Service URLs

| Service | URL |
|---------|-----|
| Frontend (public) | https://deltaed-frontend-i67acn6mvq-nw.a.run.app |
| Backend (internal) | https://deltaed-backend-i67acn6mvq-nw.a.run.app |
| Agent (internal) | https://deltaed-agent-i67acn6mvq-nw.a.run.app |

---

## GCP Project Details

| Property | Value |
|----------|-------|
| Project ID | `birmiu-agent-two26bir-4072` |
| Region | `europe-west2` (London) |
| Service Account | `cloud-run-sa@birmiu-agent-two26bir-4072.iam.gserviceaccount.com` |
| Container Registry | `gcr.io/birmiu-agent-two26bir-4072/` |
| BigQuery Location | `EU` |

---

*Built for the Google Education Hackathon — University of Birmingham*