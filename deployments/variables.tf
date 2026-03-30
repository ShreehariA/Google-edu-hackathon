# variables.tf
# Simple variable declarations for Cloud Run deployment

variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "deltaed"
}

variable "region" {
  description = "GCP Region for Cloud Run deployment"
  type        = string
  default     = "europe-west2"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "deltaed-app"
}

variable "docker_image" {
  description = "Docker image URL (deprecated - use frontend_docker_image and backend_docker_image)"
  type        = string
  default     = "gcr.io/deltaed/deltaed-app:latest"
}

variable "frontend_docker_image" {
  description = "Docker image for frontend (Node.js)"
  type        = string
  default     = "gcr.io/deltaed/deltaed-frontend:latest"
}

variable "backend_docker_image" {
  description = "Docker image for backend (FastAPI)"
  type        = string
  default     = "gcr.io/deltaed/deltaed-backend:latest"
}

variable "agent_docker_image" {
  description = "Docker image for agent (RAG Teacher Agent)"
  type        = string
  default     = "gcr.io/deltaed/deltaed-agent:latest"
}

variable "cloudrun_min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 1
}

variable "cloudrun_max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

variable "cloudrun_cpu" {
  description = "CPU allocation (1, 2, or 4)"
  type        = string
  default     = "2"
}

variable "cloudrun_memory" {
  description = "Memory allocation (512Mi, 1Gi, 2Gi, 4Gi, 8Gi)"
  type        = string
  default     = "2Gi"
}

variable "cloudrun_timeout" {
  description = "Request timeout in seconds"
  type        = number
  default     = 3600
}

variable "container_concurrency" {
  description = "Maximum concurrent requests per container"
  type        = number
  default     = 80
}

variable "enable_public_access" {
  description = "Enable public access to Cloud Run service"
  type        = bool
  default     = true
}

variable "environment_variables" {
  description = "Environment variables to pass to the container"
  type        = map(string)
  default     = {}
}
