#!/bin/bash

# Build and Deploy Script for DeltaEd Application
# Builds Docker images for backend, frontend, and agent services
# Pushes them to Google Container Registry
# Applies Terraform configuration

set -e

PROJECT_ID="deltaed"
BACKEND_IMAGE="gcr.io/${PROJECT_ID}/deltaed-backend:latest"
FRONTEND_IMAGE="gcr.io/${PROJECT_ID}/deltaed-frontend:latest"
AGENT_IMAGE="gcr.io/${PROJECT_ID}/deltaed-agent:latest"

echo "========================================="
echo "DeltaEd Build & Deploy Script"
echo "========================================="
echo ""

# Change to project root
cd /Users/shreeharianbazhagan/Documents/UOB/Google-edu-hackathon

# Build Backend
echo "📦 Building Backend Docker image..."
docker build --platform linux/amd64 -f Dockerfile.backend -t "${BACKEND_IMAGE}" .
echo "✅ Backend image built: ${BACKEND_IMAGE}"
echo ""

# Build Frontend
echo "📦 Building Frontend Docker image..."
docker build --platform linux/amd64 -f Dockerfile.frontend -t "${FRONTEND_IMAGE}" .
echo "✅ Frontend image built: ${FRONTEND_IMAGE}"
echo ""

# Build Agent
echo "📦 Building Agent Docker image..."
docker build --platform linux/amd64 -f Dockerfile.agent -t "${AGENT_IMAGE}" .
echo "✅ Agent image built: ${AGENT_IMAGE}"
echo ""

# Configure gcloud Docker authentication
echo "🔐 Configuring Docker authentication..."
gcloud auth configure-docker gcr.io
echo "✅ Docker authentication configured"
echo ""

# Push Backend
echo "🚀 Pushing Backend image to registry..."
docker push "${BACKEND_IMAGE}"
echo "✅ Backend image pushed"
echo ""

# Push Frontend
echo "🚀 Pushing Frontend image to registry..."
docker push "${FRONTEND_IMAGE}"
echo "✅ Frontend image pushed"
echo ""

# Push Agent
echo "🚀 Pushing Agent image to registry..."
docker push "${AGENT_IMAGE}"
echo "✅ Agent image pushed"
echo ""

# Deploy with Terraform
echo "🌍 Deploying with Terraform..."
cd deployments
terraform apply -auto-approve
echo "✅ Terraform deployment complete"
echo ""

echo "========================================="
echo "✨ Deployment successful!"
echo "========================================="
