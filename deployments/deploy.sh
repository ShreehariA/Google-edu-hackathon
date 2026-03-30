#!/bin/bash
# deploy.sh - Quick deployment script for Cloud Run

set -e

PROJECT_ID="deltaed"
REGION="europe-west2"

echo "🚀 DeltaEd Cloud Run Deployment Script"
echo "========================================"

# Step 1: Check prerequisites
echo "✓ Checking prerequisites..."

if ! command -v terraform &> /dev/null; then
    echo "❌ Terraform not found. Install from https://www.terraform.io/downloads"
    exit 1
fi

if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud CLI not found. Install from https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Step 2: Enable APIs
echo "✓ Enabling required GCP APIs..."
gcloud services enable run.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    bigquery.googleapis.com \
    aiplatform.googleapis.com \
    logging.googleapis.com \
    monitoring.googleapis.com \
    --project=$PROJECT_ID

# Step 3: Initialize Terraform
echo "✓ Initializing Terraform..."
cd deployments/
terraform init

# Step 4: Show plan
echo ""
echo "📋 Terraform Plan:"
echo "=================="
terraform plan -out=tfplan

# Step 5: Ask for confirmation
echo ""
read -p "Do you want to apply these changes? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Step 6: Apply configuration
echo "✓ Applying Terraform configuration..."
terraform apply tfplan

# Step 7: Get outputs
echo ""
echo "✅ Deployment Complete!"
echo "========================"
CLOUDRUN_URL=$(terraform output -raw cloudrun_url)
SERVICE_ACCOUNT=$(terraform output -raw cloudrun_service_account)

echo "🌐 Cloud Run URL: $CLOUDRUN_URL"
echo "🔐 Service Account: $SERVICE_ACCOUNT"
echo ""
echo "Next steps:"
echo "1. Visit your application: $CLOUDRUN_URL"
echo "2. View logs: gcloud run logs read deltaed-app --region $REGION --limit 50 --follow"
echo "3. Monitor in Console: https://console.cloud.google.com/run/detail/$REGION/deltaed-app"
