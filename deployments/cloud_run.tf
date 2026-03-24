# cloud_run.tf
# Legacy Cloud Run Configuration (Deprecated - using separate frontend, backend, and agent services)
# Keeping for reference but commented out

# ── Cloud Run Service ──────────────────────────────────────────────────────────
# DEPRECATED: This monolithic service has been replaced by separate services:
# - frontend_cloud_run.tf: Frontend service
# - backend_cloud_run.tf: Backend service
# - agent_cloud_run.tf: Agent service
#
# resource "google_cloud_run_service" "deltaed_app" {
#   name     = var.app_name
#   location = var.region
#
#   template {
#     spec {
#       containers {
#         image = var.docker_image
#
#         dynamic "env" {
#           for_each = merge(var.environment_variables, {
#             GOOGLE_CLOUD_LOCATION = var.region
#             GOOGLE_CLOUD_PROJECT = var.project_id
#             GCP_PROJECT_ID = var.project_id
#           })
#           content {
#             name  = env.key
#             value = env.value
#           }
#         }
#
#         ports {
#           container_port = 8080
#           name           = "http1"
#         }
#
#         resources {
#           limits = {
#             cpu    = var.cloudrun_cpu
#             memory = var.cloudrun_memory
#           }
#         }
#
#         startup_probe {
#           timeout_seconds   = 3
#           period_seconds    = 10
#           failure_threshold = 60
#           http_get {
#             path = "/health"
#             port = 8080
#           }
#         }
#
#         liveness_probe {
#           timeout_seconds   = 3
#           period_seconds    = 10
#           failure_threshold = 3
#           http_get {
#             path = "/health"
#             port = 8080
#           }
#         }
#       }
#
#       timeout_seconds       = var.cloudrun_timeout
#       container_concurrency = var.container_concurrency
#     }
#
#     metadata {
#       annotations = {
#         "autoscaling.knative.dev/minScale" = tostring(var.cloudrun_min_instances)
#         "autoscaling.knative.dev/maxScale" = tostring(var.cloudrun_max_instances)
#       }
#     }
#   }
#
#   traffic {
#     percent         = 100
#     latest_revision = true
#   }
#
#   depends_on = []
# }

# ── Cloud Run IAM: Allow Public Access ────────────────────────────────────────
# DEPRECATED: See individual service configurations for IAM setup
#
# resource "google_cloud_run_service_iam_member" "cloudrun_public" {
#   count    = var.enable_public_access ? 1 : 0
#   service  = google_cloud_run_service.deltaed_app.name
#   location = google_cloud_run_service.deltaed_app.location
#   role     = "roles/run.invoker"
#   member   = "allUsers"
# }

# ── Outputs ────────────────────────────────────────────────────────────────────
# DEPRECATED: See frontend_cloud_run.tf, backend_cloud_run.tf, and agent_cloud_run.tf
#
# output "cloudrun_url" {
#   description = "The URL of the Cloud Run service"
#   value       = google_cloud_run_service.deltaed_app.status[0].url
# }
