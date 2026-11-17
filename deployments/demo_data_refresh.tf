# demo_data_refresh.tf
# Daily BigQuery scheduled query that keeps the static demo dataset current
# (see sql/shift_demo_dates.sql). Runs as the Cloud Run service account, which
# already has BigQuery data-editor + job-user access.
#
# Note: on first creation DTS starts a run immediately, before the token-creator
# grant below has propagated, so that one run shows FAILED. Harmless: deploy.sh
# runs the same shift right after terraform, and the daily runs succeed.

data "google_project" "current" {
  project_id = var.project_id
}

# Let the BigQuery Data Transfer service agent run the query as cloud-run-sa
resource "google_service_account_iam_member" "dts_token_creator" {
  service_account_id = google_service_account.cloud_run_sa.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-bigquerydatatransfer.iam.gserviceaccount.com"
}

resource "google_bigquery_data_transfer_config" "shift_demo_dates" {
  display_name         = "deltaed-shift-demo-dates"
  location             = "EU"
  data_source_id       = "scheduled_query"
  schedule             = "every day 00:05"
  service_account_name = google_service_account.cloud_run_sa.email

  params = {
    query = file("${path.module}/sql/shift_demo_dates.sql")
  }

  depends_on = [
    google_service_account_iam_member.dts_token_creator,
    google_project_iam_member.cloud_run_sa_bigquery,
    google_project_iam_member.cloud_run_sa_bigquery_user,
    google_bigquery_table.student_scores,
    google_bigquery_table.student_progress,
  ]
}
