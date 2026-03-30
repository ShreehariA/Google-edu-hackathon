# agent_cloud_run.tf
# Cloud Run Service for RAG Teacher Agent API
# Provides agent endpoints at https://deltaed-agent-REGION.run.app

resource "google_cloud_run_service" "deltaed_agent" {
  name     = "deltaed-agent"
  location = var.region

  template {
    spec {
      containers {
        image = var.agent_docker_image

        # Environment variables for agent
        dynamic "env" {
          for_each = {
            GOOGLE_CLOUD_PROJECT        = var.project_id
            GCP_PROJECT_ID              = var.project_id
            GOOGLE_CLOUD_LOCATION       = var.region
            GOOGLE_GENAI_USE_VERTEXAI   = "true"
            BIGQUERY_SCORES_DATASET_ID  = "student_db"
            BIGQUERY_CHAPTER_DATASET_ID = "educational_resources_db"
            GOOGLE_RAG_CORPUS           = "projects/${var.project_id}/locations/${var.region}/ragCorpora/6917529027641081856"
            ENVIRONMENT                 = "production"
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

        # Resource limits (Agent may use more resources)
        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
        }

        # Startup probe - longer timeout for agent initialization
        startup_probe {
          timeout_seconds   = 5
          period_seconds    = 10
          failure_threshold = 60
          http_get {
            path = "/"
            port = 8080
          }
        }

        # Liveness probe
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

      service_account_name = google_service_account.cloud_run_sa.email
      timeout_seconds      = 3600
    }

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

  depends_on = [google_service_account.cloud_run_sa]
}

# ── IAM: Allow the frontend proxy (and any caller) to invoke agent ────────────
# The frontend Node process proxies requests without an identity token.
resource "google_cloud_run_service_iam_member" "agent_public" {
  service  = google_cloud_run_service.deltaed_agent.name
  location = google_cloud_run_service.deltaed_agent.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Output: Agent URL for frontend configuration ────────────────────────────
output "agent_url" {
  value       = google_cloud_run_service.deltaed_agent.status[0].url
  description = "URL of the RAG Agent service"
}
