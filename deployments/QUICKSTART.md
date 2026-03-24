# Cloud Run Deployment - Quick Start

## Prerequisites

You only need:
1. Docker image pushed to Docker Hub: `shreeharia/deltaed-app:latest`
2. `gcloud` CLI installed and authenticated on your Mac
3. Terraform installed
4. GCP project: `birmiu-agent-two26bir-4072`

## Setup (One Time)

```bash
# Authenticate gcloud on your Mac
gcloud auth login
gcloud config set project birmiu-agent-two26bir-4072
gcloud auth application-default login

# Initialize Terraform
cd deployments/
terraform init
```

## Deploy to Cloud Run

```bash
# View what will be created
terraform plan

# Deploy (this creates the Cloud Run service)
terraform apply
```

When done, you'll get the URL - copy it and visit it!

```bash
# View the URL
terraform output cloudrun_url
```

## View Logs

```bash
# Real-time logs
gcloud run logs read deltaed-app --region europe-west2 --follow
```

## Update Docker Image & Redeploy

```bash
# Push new image to Docker Hub
docker push shreeharia/deltaed-app:latest

# Update Terraform
cd deployments/
terraform apply
```

## Customize Settings

Edit `terraform.tfvars`:

```hcl
cloudrun_cpu = "1"              # Change CPU
cloudrun_memory = "1Gi"         # Change memory
cloudrun_max_instances = 20     # More replicas
enable_public_access = false    # Private access
```

Then:
```bash
terraform apply
```

## Clean Up

```bash
terraform destroy
```

That's it! Your gcloud credentials on your Mac and Docker credentials automatically handle all authentication.
