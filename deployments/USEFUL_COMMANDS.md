# USEFUL_COMMANDS.md

# Useful Terraform & gcloud Commands for DeltaEd Cloud Run

## Terraform Commands

### Initialize Terraform Workspace
```bash
cd deployments/
terraform init
```

### Validate Terraform Configuration
```bash
terraform validate
```

### Format Terraform Files
```bash
terraform fmt -recursive
```

### Plan Deployment (review changes without applying)
```bash
terraform plan
terraform plan -out=tfplan
```

### Apply Deployment
```bash
terraform apply
terraform apply tfplan
```

### Destroy Resources (cleanup)
```bash
terraform destroy
```

### View Terraform State
```bash
terraform state list
terraform state show google_cloud_run_service.deltaed_app
```

### Refresh State (sync with actual resources)
```bash
terraform refresh
```

### Get Terraform Outputs
```bash
terraform output cloudrun_url
terraform output cloudrun_service_account
terraform output -json
```

### Import Existing Resources into Terraform
```bash
# If you have existing Cloud Run service or other resources
terraform import google_cloud_run_service.deltaed_app /projects/deltaed/locations/europe-west2/services/deltaed-app
```

---

## Google Cloud CLI Commands

### Authentication
```bash
# Login to Google Cloud
gcloud auth login

# Set default project
gcloud config set project deltaed

# Authenticate for Application Default Credentials (needed by Terraform)
gcloud auth application-default login
```

### Enable Required APIs
```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com bigquery.googleapis.com aiplatform.googleapis.com logging.googleapis.com monitoring.googleapis.com
```

### Cloud Run Service Management
```bash
# Deploy a service (alternative to Terraform)
gcloud run deploy deltaed-app \
  --image docker.io/shreeharia/deltaed-app:latest \
  --region europe-west2 \
  --platform managed \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600

# List all Cloud Run services
gcloud run services list --region europe-west2

# Get service details
gcloud run services describe deltaed-app --region europe-west2

# Delete a service
gcloud run services delete deltaed-app --region europe-west2

# Update environment variables
gcloud run services update deltaed-app \
  --region europe-west2 \
  --set-env-vars PORT=8080,LOG_LEVEL=INFO
```

### Logs & Debugging
```bash
# View recent logs
gcloud run logs read deltaed-app --region europe-west2 --limit 50

# Follow logs in real-time
gcloud run logs read deltaed-app --region europe-west2 --follow

# Stream logs
gcloud logs read "resource.type=cloud_run_revision AND resource.labels.service_name=deltaed-app" \
  --limit 100 \
  --format json

# Tail logs with filtering
gcloud run logs read deltaed-app --region europe-west2 --limit 100 | grep ERROR
```

### IAM & Permissions
```bash
# Get IAM bindings for a service
gcloud run services get-iam-policy deltaed-app --region europe-west2

# Make service public
gcloud run services add-iam-policy-binding deltaed-app \
  --region europe-west2 \
  --member=allUsers \
  --role=roles/run.invoker

# Restrict to specific user/service account
gcloud run services add-iam-policy-binding deltaed-app \
  --region europe-west2 \
  --member=user:your-email@example.com \
  --role=roles/run.invoker

# Remove public access
gcloud run services remove-iam-policy-binding deltaed-app \
  --region europe-west2 \
  --member=allUsers \
  --role=roles/run.invoker
```

### BigQuery Commands
```bash
# List datasets
gcloud bq ls

# List tables in a dataset
gcloud bq ls --dataset_id=student_db

# Query a table
gcloud bq query --use_legacy_sql=false \
  'SELECT * FROM `deltaed.student_db.student_personal_details` LIMIT 10'

# View table schema
gcloud bq show --schema deltaed:student_db.student_personal_details
```

### Vertex AI Commands
```bash
# List available models
gcloud ai models list --region europe-west2

# Deploy a model
gcloud ai models deploy MODEL_ID \
  --region europe-west2 \
  --display-name "Model Name"
```

### Service Account Management
```bash
# List service accounts
gcloud iam service-accounts list

# Get service account details
gcloud iam service-accounts describe deltaed-cloudrun-sa@deltaed.iam.gserviceaccount.com

# Create service account key
gcloud iam service-accounts keys create key.json \
  --iam-account=deltaed-cloudrun-sa@deltaed.iam.gserviceaccount.com

# List service account keys
gcloud iam service-accounts keys list \
  --iam-account=deltaed-cloudrun-sa@deltaed.iam.gserviceaccount.com

# Delete a service account key
gcloud iam service-accounts keys delete KEY_ID \
  --iam-account=deltaed-cloudrun-sa@deltaed.iam.gserviceaccount.com
```

### Secret Manager Commands
```bash
# Create a secret
gcloud secrets create deltaed-env \
  --replication-policy="automatic"

# Add a secret version from file
gcloud secrets versions add deltaed-env --data-file=src/.env

# Get secret value
gcloud secrets versions access latest --secret="deltaed-env"

# List secrets
gcloud secrets list

# Delete a secret
gcloud secrets delete deltaed-env
```

### Monitoring & Metrics
```bash
# Get metrics for Cloud Run service
gcloud monitoring time-series list \
  --filter 'resource.type="cloud_run_revision"'

# Create an uptime check
gcloud monitoring uptime-check create \
  --display-name="DeltaEd Uptime Check" \
  --http-check=url="https://YOUR_CLOUDRUN_URL" \
  --period=60
```

---

## Docker Hub Commands

### Login to Docker Hub
```bash
docker login
```

### Build and Tag Docker Image
```bash
docker build -t shreeharia/deltaed-app:latest .
docker tag shreeharia/deltaed-app:latest shreeharia/deltaed-app:v1.0.0
```

### Push to Docker Hub
```bash
docker push shreeharia/deltaed-app:latest
docker push shreeharia/deltaed-app:v1.0.0
```

### Pull from Docker Hub
```bash
docker pull shreeharia/deltaed-app:latest
```

### List Docker Images
```bash
docker images
```

---

## Combined Deployment Workflows

### Complete Fresh Deployment
```bash
# 1. Initialize Terraform
cd deployments/
terraform init

# 2. Enable APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com bigquery.googleapis.com aiplatform.googleapis.com

# 3. Plan deployment
terraform plan

# 4. Apply deployment
terraform apply

# 5. Get the URL
CLOUDRUN_URL=$(terraform output -raw cloudrun_url)
echo "Your app is at: $CLOUDRUN_URL"

# 6. View logs
gcloud run logs read deltaed-app --region europe-west2 --follow
```

### Update Docker Image and Redeploy
```bash
# 1. Build new image
docker build -t shreeharia/deltaed-app:v1.0.1 .

# 2. Push to Docker Hub
docker push shreeharia/deltaed-app:v1.0.1

# 3. Update Terraform (edit cloud_run.tf)
# Change: docker_image = "docker.io/shreeharia/deltaed-app:v1.0.1"

# 4. Redeploy
cd deployments/
terraform apply

# 5. Verify
gcloud run services describe deltaed-app --region europe-west2
```

### Scale Up/Down
```bash
# Edit variables.tf or create terraform.tfvars with new values:
# cloudrun_max_instances = 50

# Apply changes
terraform apply
```

### Add Environment Variable
```bash
# Edit terraform.tfvars:
environment_variables = {
  PORT = "8080"
  NEW_VAR = "new_value"
}

# Apply
terraform apply
```

---

## Troubleshooting Commands

### Check if Cloud Run service is running
```bash
gcloud run services describe deltaed-app --region europe-west2
```

### View recent revisions
```bash
gcloud run revisions list --service deltaed-app --region europe-west2
```

### Get detailed error logs
```bash
gcloud run logs read deltaed-app --region europe-west2 --limit 200 | tail -n 50
```

### Check service account permissions
```bash
gcloud projects get-iam-policy deltaed \
  --flatten="bindings[].members" \
  --filter="bindings.members:deltaed-cloudrun-sa*"
```

### Validate gcloud configuration
```bash
gcloud config list
gcloud auth list
```

### Test BigQuery connection from local machine
```bash
gcloud bq query --use_legacy_sql=false \
  'SELECT CURRENT_TIMESTAMP() as current_time'
```

---

## Performance Tuning

### View metrics in Cloud Console
```
https://console.cloud.google.com/monitoring/dashboards/custom/deltaed-metrics?project=deltaed
```

### Create uptime monitoring alert
```bash
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="DeltaEd Downtime Alert" \
  --condition-display-name="Service Down"
```

### View Cloud Run pricing estimate
```bash
# Use Google Cloud Pricing Calculator:
# https://cloud.google.com/products/calculator
```
