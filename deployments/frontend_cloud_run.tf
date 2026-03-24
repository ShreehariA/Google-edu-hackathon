# frontend_cloud_run.tf
# Cloud Run Service for Next.js/Node.js Frontend
# Serves static files and proxies API calls to backend

resource "google_cloud_run_service" "deltaed_frontend" {
  name     = "deltaed-frontend"
  location = var.region

  template {
    spec {
      containers {
        image = var.frontend_docker_image

        # Environment variables for frontend
        dynamic "env" {
          for_each = {
            NODE_ENV             = "production"
            BACKEND_URL          = google_cloud_run_service.deltaed_backend.status[0].url
            AGENT_URL            = google_cloud_run_service.deltaed_agent.status[0].url
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
            cpu    = "1"
            memory = "1Gi"
          }
        }

        # Startup probe
        startup_probe {
          timeout_seconds   = 3
          period_seconds    = 10
          failure_threshold = 60
          http_get {
            path = "/health"
            port = 8080
          }
        }

        # Liveness probe
        liveness_probe {
          timeout_seconds   = 3
          period_seconds    = 10
          failure_threshold = 3
          http_get {
            path = "/health"
            port = 8080
          }
        }
      }

      service_account_name = google_service_account.cloud_run_sa.email

      timeout_seconds = 3600
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale" = "100"
        "autoscaling.knative.dev/minScale" = "1"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  depends_on = [google_cloud_run_service.deltaed_backend, google_cloud_run_service.deltaed_agent]
}

# ── IAM: Allow public access to frontend ──────────────────────────────────
resource "google_cloud_run_service_iam_member" "frontend_public" {
  service  = google_cloud_run_service.deltaed_frontend.name
  location = google_cloud_run_service.deltaed_frontend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Output: Frontend URL (public entry point) ────────────────────────────
output "frontend_url" {
  value       = google_cloud_run_service.deltaed_frontend.status[0].url
  description = "Public URL of the frontend application"
}
