# main.tf

# ── Service Account for Cloud Run ───────────────────────────────────────────────

resource "google_service_account" "cloud_run_sa" {
  account_id   = "cloud-run-sa"
  display_name = "Service Account for Cloud Run Services"
}

# Grant necessary permissions to the service account
resource "google_project_iam_member" "cloud_run_sa_bigquery" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "cloud_run_sa_bigquery_user" {
  project = var.project_id
  role    = "roles/bigquery.user"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

resource "google_project_iam_member" "cloud_run_sa_aiplatform_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.cloud_run_sa.email}"
}

# ── Auth ───────────────────────────────────────────────────────────────────────

resource "google_bigquery_dataset" "auth_creds" {
  dataset_id    = "auth_creds"
  friendly_name = "Authentication Credentials"
  location      = "EU"
}

resource "google_bigquery_table" "user_creds" {
  dataset_id          = google_bigquery_dataset.auth_creds.dataset_id
  table_id            = "user_creds_db"
  deletion_protection = false

  schema = <<EOF
[
  { "name": "username",   "type": "STRING",    "mode": "NULLABLE" },
  { "name": "hashkey",    "type": "STRING",    "mode": "NULLABLE" },
  { "name": "login_time", "type": "TIMESTAMP", "mode": "REQUIRED" }
]
EOF
}

# ── Student DB ─────────────────────────────────────────────────────────────────

resource "google_bigquery_dataset" "student_db" {
  dataset_id    = "student_db"
  friendly_name = "Student Data"
  location      = "EU"
}

resource "google_bigquery_table" "student_personal_details" {
  dataset_id          = google_bigquery_dataset.student_db.dataset_id
  table_id            = "student_personal_details"
  deletion_protection = false

  schema = <<EOF
[
  { "name": "student_id",    "type": "STRING", "mode": "REQUIRED" },
  { "name": "name",          "type": "STRING", "mode": "NULLABLE" },
  { "name": "email_address", "type": "STRING", "mode": "NULLABLE" }
]
EOF
}

resource "google_bigquery_table" "student_scores" {
  dataset_id          = google_bigquery_dataset.student_db.dataset_id
  table_id            = "student_scores"
  deletion_protection = false

  schema = <<EOF
[
  { "name": "student_id",  "type": "STRING",    "mode": "REQUIRED" },
  { "name": "timestamp",   "type": "TIMESTAMP", "mode": "REQUIRED" },
  { "name": "question_id", "type": "STRING",    "mode": "NULLABLE" },
  { "name": "topic_id",    "type": "STRING",    "mode": "NULLABLE" },
  { "name": "correct",     "type": "INTEGER",   "mode": "REQUIRED" }
]
EOF
}

resource "google_bigquery_table" "student_progress" {
  dataset_id          = google_bigquery_dataset.student_db.dataset_id
  table_id            = "student_progress"
  deletion_protection = false

  schema = <<EOF
[
  { "name": "student_id",                  "type": "STRING",    "mode": "REQUIRED" },
  { "name": "timestamp",                   "type": "TIMESTAMP", "mode": "REQUIRED" },
  { "name": "chapter_id",                  "type": "STRING",    "mode": "NULLABLE" },
  { "name": "subject_cumulative_progress", "type": "FLOAT",     "mode": "NULLABLE" },
  { "name": "chapter_cumulative_progress", "type": "FLOAT",     "mode": "NULLABLE" }
]
EOF
}

# ── Educational Resources DB ───────────────────────────────────────────────────

resource "google_bigquery_dataset" "educational_resources_db" {
  dataset_id    = "educational_resources_db"
  friendly_name = "Educational Resources"
  location      = "EU"
}

resource "google_bigquery_table" "chapter_table" {
  dataset_id          = google_bigquery_dataset.educational_resources_db.dataset_id
  table_id            = "chapter_table"
  deletion_protection = false

  schema = <<EOF
[
  { "name": "chapter_id",   "type": "STRING", "mode": "REQUIRED" },
  { "name": "chapter_name", "type": "STRING", "mode": "NULLABLE" },
  { "name": "subject_name", "type": "STRING", "mode": "NULLABLE" },
  { "name": "subject_id",   "type": "STRING", "mode": "NULLABLE" }
]
EOF
}

resource "google_bigquery_table" "subject_table" {
  dataset_id          = google_bigquery_dataset.educational_resources_db.dataset_id
  table_id            = "subject_table"
  deletion_protection = false

  schema = <<EOF
[
  { "name": "subject_id",   "type": "STRING", "mode": "REQUIRED" },
  { "name": "subject_name", "type": "STRING", "mode": "NULLABLE" }
]
EOF
}
