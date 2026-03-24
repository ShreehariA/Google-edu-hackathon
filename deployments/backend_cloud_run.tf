# backend_cloud_run.tf
# Cloud Run Service for FastAPI Backend
# Provides API endpoints at https://deltaed-backend-REGION.run.app

resource "google_cloud_run_service" "deltaed_backend" {
  name     = "deltaed-backend"
  location = var.region

  template {
    spec {
      containers {
        image = var.backend_docker_image

        # Environment variables for backend
        dynamic "env" {
          for_each = {
            GOOGLE_CLOUD_PROJECT = var.project_id
            GCP_PROJECT_ID       = var.project_id
            ENVIRONMENT          = "production"
          }
          content {
            name  = env.key
            value = env.value
          }
        }

        # Listen on port 8080 (Cloud Run requirement)
        ports {
          container_port = 8080
          name           = "http1"
        }

        # Resource limits
        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
        }

        # Startup probe - wait up to 5 minutes for first request
        startup_probe {
          timeout_seconds   = 3
          period_seconds    = 10
          failure_threshold = 60
          http_get {
            path = "/"
            port = 8080
          }
        }

        # Liveness probe - ensure service stays alive
        liveness_probe {
          timeout_seconds   = 3
          period_seconds    = 10
          failure_threshold = 3
          http_get {
            path = "/"
            port = 8080
          }
        }
      }

      # Service account (uses default)
      service_account_name = google_service_account.cloud_run_sa.email

      # Timeout for requests
      timeout_seconds = 3600

      # Allow all traffic (we restrict at service level)
    }

    # Annotations for Cloud Run
    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale" = "50"
        "autoscaling.knative.dev/minScale" = "1"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  # Force update on image change
  depends_on = [google_service_account.cloud_run_sa]
}

# ── IAM: Allow the frontend proxy (and any caller) to invoke backend ──────────
# The frontend Node process proxies requests to the backend without an identity
# token, so the backend must accept unauthenticated invocations.
resource "google_cloud_run_service_iam_member" "backend_public" {
  service  = google_cloud_run_service.deltaed_backend.name
  location = google_cloud_run_service.deltaed_backend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Output: Backend URL for frontend configuration ──────────────────────────
output "backend_url" {
  value       = google_cloud_run_service.deltaed_backend.status[0].url
  description = "URL of the FastAPI backend service"
}

output "backend_service_account_email" {
  value = google_service_account.cloud_run_sa.email
}
