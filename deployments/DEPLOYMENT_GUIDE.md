# DeltaEd Deployment Guide

## Overview

Your application is deployed on Google Cloud Run with:
- **Node.js Frontend** (React/Vite)
- **FastAPI Backend** (Python APIs)
- **Teacher Agent** (RAG Pipeline)
- **BigQuery** (Student data)
- **Vertex AI** (AI models)

**Project**: `birmiu-agent-two26bir-4072`  
**Region**: `europe-west2` (London)  
**Public**: ✅ Accessible worldwide

---

## Initial Deployment (Already Done ✅)

Your app is already deployed on Cloud Run and publicly accessible!

Get the URL:
```bash
cd deployments/
terraform output cloudrun_url
```

Visit it in your browser - works from anywhere in the world! 🌍

---

## Redeployment (When Code Changes)

### Step 1: Build & Push Docker Image

After making code changes in your project:

```bash
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon

# Build for amd64 platform (Cloud Run compatible)
docker build --platform linux/amd64 -t gcr.io/birmiu-agent-two26bir-4072/deltaed-app:latest .

# Push to Google Container Registry
docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-app:latest
```

### Step 2: Deploy to Cloud Run

```bash
cd deployments/

# Apply the new image
terraform apply
```

Terraform will detect the new image digest and update Cloud Run automatically.

### Step 3: Verify Deployment

```bash
# Check service status
gcloud run services describe deltaed-app --region europe-west2

# View live logs
gcloud run logs read deltaed-app --region europe-west2 --follow
```

---

## Accessing Your Application

### Public URL

```bash
# Get the URL
terraform output cloudrun_url

# Example output:
# https://deltaed-app-1024842889666.europe-west2.run.app
```

### From Browser
- Open the URL from any computer, phone, or device worldwide
- No VPN needed - it's public!

### From Terminal
```bash
# Test endpoint
curl https://deltaed-app-xxxx.europe-west2.run.app

# Test with specific path
curl https://deltaed-app-xxxx.europe-west2.run.app/api/health
```

### Test from Different Devices
- Desktop browser ✅
- Mobile phone browser ✅
- Linux/Mac terminal ✅
- Windows PowerShell ✅
- Remote server anywhere ✅

---

## Monitoring & Logs

### Real-Time Logs

```bash
# Follow logs as they happen
gcloud run logs read deltaed-app --region europe-west2 --follow

# Last 50 lines
gcloud run logs read deltaed-app --region europe-west2 --limit 50

# Filter errors only
gcloud run logs read deltaed-app --region europe-west2 --limit 100 | grep ERROR
```

### Service Metrics

```bash
# Get service details
gcloud run services describe deltaed-app --region europe-west2

# View in Cloud Console (requires browser)
# https://console.cloud.google.com/run/detail/europe-west2/deltaed-app
```

### Common Issues in Logs

| Error | Solution |
|-------|----------|
| `GOOGLE_CLOUD_LOCATION not found` | Environment variable missing in Terraform |
| `BigQuery connection failed` | Check gcloud auth in container |
| `Module not found` | Missing dependency in `requirements.txt` or `package.json` |
| `Port already in use` | Cloud Run handles this - no need to worry |

---

## Making Code Changes

### Example: Update Node.js Frontend

1. Edit code in `frontend/src/` or root files
2. Build Docker image:
   ```bash
   docker build --platform linux/amd64 -t gcr.io/birmiu-agent-two26bir-4072/deltaed-app:latest .
   ```
3. Push image:
   ```bash
   docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-app:latest
   ```
4. Deploy:
   ```bash
   cd deployments/
   terraform apply
   ```

### Example: Update Python Backend

1. Edit code in `src/apis/main.py` or `requirements.txt`
2. Same build & push process as above
3. `terraform apply`

### Example: Update Teacher Agent

1. Edit code in `RAG_Pipeline/teacher_agent/`
2. Same build & push process
3. `terraform apply`

---

## Scaling & Configuration

### View Current Settings

```bash
terraform output
```

Shows:
- Cloud Run URL
- Service configuration
- Scaling settings

### Change Resources

Edit `terraform.tfvars`:

```hcl
# CPU options: 1, 2, or 4
cloudrun_cpu = "4"

# Memory options: 512Mi, 1Gi, 2Gi, 4Gi, 8Gi
cloudrun_memory = "4Gi"

# Auto-scaling limits
cloudrun_min_instances = 1
cloudrun_max_instances = 20
```

Apply changes:
```bash
cd deployments/
terraform apply
```

### Add Environment Variables

Edit `terraform.tfvars`:

```hcl
environment_variables = {
  LOG_LEVEL = "DEBUG"
  NODE_ENV = "production"
}
```

Apply:
```bash
cd deployments/
terraform apply
```

---

## Rollback (If Something Breaks)

Cloud Run keeps previous revisions. Rollback instantly:

```bash
# List revisions
gcloud run revisions list --service=deltaed-app --region=europe-west2

# Rollback to previous revision
gcloud run services update-traffic deltaed-app \
  --to-revisions REVISION_NAME=100 \
  --region europe-west2
```

Or destroy and redeploy with previous image:
```bash
cd deployments/
terraform destroy -auto-approve
terraform apply
```

---

## Cleanup (Delete Everything)

If you want to stop paying for Cloud Run:

```bash
cd deployments/
terraform destroy
```

This removes:
- ❌ Cloud Run service
- ❌ All revisions
- ⚠️ **Keeps BigQuery tables** (you can delete them separately if needed)

---

## Quick Reference

| Task | Command |
|------|---------|
| Build image | `docker build --platform linux/amd64 -t gcr.io/birmiu-agent-two26bir-4072/deltaed-app:latest .` |
| Push image | `docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-app:latest` |
| Deploy | `cd deployments/ && terraform apply` |
| Get URL | `terraform output cloudrun_url` |
| View logs | `gcloud run logs read deltaed-app --region europe-west2 --follow` |
| Service details | `gcloud run services describe deltaed-app --region europe-west2` |
| Destroy | `cd deployments/ && terraform destroy` |

---

## Troubleshooting

### Image Still Shows Multi-Platform Error

Make sure you're using `--platform linux/amd64`:
```bash
docker build --platform linux/amd64 -t gcr.io/birmiu-agent-two26bir-4072/deltaed-app:latest .
```

### Can't Access from Browser

1. Check URL is correct from `terraform output cloudrun_url`
2. Check logs for startup errors: `gcloud run logs read deltaed-app --region europe-west2 --follow`
3. Ensure `enable_public_access = true` in `terraform.tfvars`

### Terraform Apply Stuck

```bash
# Cancel and try again
Ctrl+C

# Destroy and redeploy
terraform destroy -auto-approve
terraform apply
```

### BigQuery Connection Fails

Your gcloud credentials are passed via the Docker volume mount in the startup script. Make sure:
1. You authenticated locally: `gcloud auth application-default login`
2. You have correct gcloud config: `gcloud config set project birmiu-agent-two26bir-4072`

---

## Summary

**Deployment is easy:**
1. Make code changes
2. `docker build --platform linux/amd64 -t gcr.io/birmiu-agent-two26bir-4072/deltaed-app:latest .`
3. `docker push gcr.io/birmiu-agent-two26bir-4072/deltaed-app:latest`
4. `cd deployments/ && terraform apply`

Your app will be live within 1-2 minutes! 🚀

Need help? Check the logs: `gcloud run logs read deltaed-app --region europe-west2 --follow`
