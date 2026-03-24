# TERRAFORM_CLOUDRUN_DEPLOYMENT.md

# Deploying DeltaEd to Google Cloud Run with Terraform

This guide walks you through deploying your DeltaEd application (Node.js + FastAPI + Agent API) to Google Cloud Run using Terraform.

## Prerequisites

1. **Google Cloud Project**: `birmiu-agent-two26bir-4072` (already configured in `provider.tf`)
2. **Docker Image**: `shreeharia/deltaed-app:latest` pushed to Docker Hub
3. **Terraform**: Installed locally (`terraform --version` to verify)
4. **gcloud CLI**: Installed and authenticated (`gcloud auth application-default login`)
5. **Required APIs Enabled** in GCP:
   - Cloud Run API
   - Cloud Build API
   - Secret Manager API (optional, if using secrets)
   - BigQuery API
   - Vertex AI API

## Enable Required APIs

Run this command to enable necessary GCP APIs:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com bigquery.googleapis.com aiplatform.googleapis.com logging.googleapis.com monitoring.googleapis.com
```

## Terraform Files Explanation

### 1. **provider.tf** (Already exists)
- Sets up GCP provider for project `birmiu-agent-two26bir-4072`
- Region: `europe-west2` (London)

### 2. **cloud_run.tf** (New - Main deployment config)
Contains:
- **Service Account**: `deltaed_cloudrun` with minimal required permissions
- **IAM Roles**:
  - `BigQuery User` & `BigQuery Data Editor` (for APIs and Teacher Agent)
  - `Vertex AI User` (for AI model access)
  - `Cloud Logging & Monitoring` (for observability)
- **Cloud Run Service**:
  - Deployment of `shreeharia/deltaed-app:latest`
  - Auto-scaling: 1-10 replicas
  - CPU: 2 vCPU, Memory: 2GB
  - Health checks for reliability
  - Public access enabled (configurable)

### 3. **secrets.tf** (Optional - For sensitive data)
Contains:
- Secret Manager configuration (commented out, ready to uncomment)
- Cloud Logging sink for centralized log collection
- Cloud Trace IAM role for performance monitoring

### 4. **main.tf** (Already exists)
BigQuery tables for:
- Authentication credentials
- Student data (personal details, scores, progress)
- Educational resources (chapters, subjects)

## Deployment Steps

### Step 1: Initialize Terraform

```bash
cd deployments/
terraform init
```

This downloads necessary providers and initializes the Terraform state.

### Step 2: Review the Plan

```bash
terraform plan
```

This shows you exactly what resources will be created. Review carefully before applying.

### Step 3: Apply Terraform Configuration

```bash
terraform apply
```

When prompted, type `yes` to confirm. Terraform will:
1. Create the service account
2. Assign IAM roles
3. Deploy Cloud Run service
4. Output the Cloud Run URL

**Expected Output:**
```
cloudrun_url = "https://deltaed-app-xxxxxx-nw.a.run.app"
cloudrun_service_account = "deltaed-cloudrun-sa@birmiu-agent-two26bir-4072.iam.gserviceaccount.com"
```

### Step 4: Test Your Deployment

Once deployment completes, visit the Cloud Run URL in your browser:

```bash
# Get the URL from terraform output
terraform output cloudrun_url

# Or test with curl
curl https://deltaed-app-xxxxxx-nw.a.run.app
```

## Important Configuration Notes

### 1. **Docker Image Updates**

When you push a new version to Docker Hub, update `cloud_run.tf`:

```hcl
image = "docker.io/shreeharia/deltaed-app:latest"
```

Or use a specific tag:
```hcl
image = "docker.io/shreeharia/deltaed-app:v1.0.0"
```

Then run:
```bash
terraform apply
```

### 2. **Environment Variables**

Currently, the start script in your Dockerfile uses `src/.env`. For production:

**Option A: Keep using .env (Not recommended for production)**
- You'll need to pass environment variables during Docker build

**Option B: Use Secret Manager (Recommended)**
Uncomment and customize `secrets.tf`:

```hcl
resource "google_secret_manager_secret" "app_env" {
  secret_id = "deltaed-app-env"
}

resource "google_secret_manager_secret_version" "app_env" {
  secret      = google_secret_manager_secret.app_env.id
  secret_data = file("${path.module}/../src/.env")
}
```

Then update `cloud_run.tf` to reference the secret.

### 3. **Resource Scaling**

Modify min/max replicas in `cloud_run.tf`:

```hcl
metadata {
  annotations = {
    "autoscaling.knative.dev/minScale" = "1"  # Minimum instances
    "autoscaling.knative.dev/maxScale" = "10" # Maximum instances
  }
}
```

### 4. **CPU & Memory Allocation**

Adjust in `cloud_run.tf`:

```hcl
resources {
  limits = {
    cpu    = "2"   # 2 vCPU (change to 1, 2, or 4)
    memory = "2Gi" # 2GB (change to 512Mi, 1Gi, 2Gi, 4Gi, 8Gi)
  }
}
```

## Monitoring & Logging

### View Real-Time Logs

```bash
# Using gcloud CLI
gcloud run logs read deltaed-app --region europe-west2 --limit 50 --follow

# Or in Cloud Console
# https://console.cloud.google.com/run/detail/europe-west2/deltaed-app/logs
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Image not found" | Ensure Docker Hub image exists and is public, or configure Docker authentication |
| "Permission denied" | Verify IAM roles are assigned to service account |
| "Service crashes after startup" | Check logs with `gcloud run logs read deltaed-app` |
| "FastAPI/Agent API unreachable" | Services run on ports 8000/8001 but Cloud Run only exposes 8080 (Node.js frontend handles proxying) |
| "BigQuery connection fails" | Verify service account has BigQuery roles assigned |

## Destroying Resources (Clean Up)

To remove all resources created by Terraform:

```bash
terraform destroy
```

When prompted, type `yes` to confirm. This will:
- Delete the Cloud Run service
- Delete the service account
- Remove all IAM bindings

## Advanced Configurations

### Custom Domain

Add to `cloud_run.tf`:

```hcl
resource "google_cloud_run_domain_mapping" "deltaed_domain" {
  location = "europe-west2"
  name     = "deltaed.yourdomain.com"

  spec {
    route_name = google_cloud_run_service.deltaed_app.name
  }
}
```

### HTTPS & SSL Certificate

Cloud Run automatically provides HTTPS with a managed certificate. No configuration needed!

### VPC Connector (For Private Database Access)

```hcl
resource "google_vpc_access_connector" "deltaed_connector" {
  name          = "deltaed-connector"
  region        = "europe-west2"
  ip_cidr_range = "10.8.0.0/28"
}
```

Then in Cloud Run:
```hcl
vpc_access_connector = google_vpc_access_connector.deltaed_connector.id
```

## Next Steps

1. **Enable monitoring alerts** in Google Cloud Console
2. **Set up CI/CD pipeline** to auto-deploy on Docker Hub push
3. **Configure custom domain** if needed
4. **Set up database backups** for BigQuery tables
5. **Implement API authentication** for better security

## Support & Resources

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Terraform Google Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloud_run_service)
- [Your GCP Console](https://console.cloud.google.com/run)
