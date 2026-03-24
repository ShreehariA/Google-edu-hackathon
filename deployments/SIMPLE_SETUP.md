# DeltaEd Cloud Run Deployment - Simplified Setup

## What You Get

A simple Terraform deployment for your Docker container on Google Cloud Run with:
- ✅ Auto-scaling (1-10 replicas)
- ✅ 2 vCPU + 2GB memory (customizable)
- ✅ Public HTTPS endpoint
- ✅ Automatic health checks
- ✅ Real-time logs via gcloud

## Files

| File | Purpose |
|------|---------|
| `provider.tf` | GCP provider config |
| `main.tf` | BigQuery tables |
| `cloud_run.tf` | Cloud Run service (simplified) |
| `secrets.tf` | Empty (using gcloud auth) |
| `variables.tf` | Configuration options |
| `terraform.tfvars.example` | Example values |
| `QUICKSTART.md` | 5-minute setup guide |

## Quick Deploy

```bash
cd deployments/

# First time only
terraform init

# Deploy
terraform apply

# Get URL
terraform output cloudrun_url
```

Your gcloud credentials automatically handle authentication on your Mac and in Docker.

## View Logs

```bash
gcloud run logs read deltaed-app --region europe-west2 --follow
```

## Redeploy (after Docker push)

```bash
cd deployments/
terraform apply
```

## No Complex Setup Needed

- ❌ No service account creation
- ❌ No IAM role configuration  
- ❌ No Secret Manager setup
- ✅ Just your gcloud auth on Mac
- ✅ Just Docker credentials in container

Done! See `QUICKSTART.md` for full details.
