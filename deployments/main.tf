# main.tf

resource "google_bigquery_dataset" "app_logs" {
  dataset_id                  = "auth_creds"
  friendly_name               = "Authentication Logs"
  location                    = "EU" # BigQuery uses multi-region codes like EU or US
}

resource "google_bigquery_table" "login_table" {
  dataset_id = google_bigquery_dataset.app_logs.dataset_id
  table_id   = "user_creds"

  deletion_protection = false 

  schema = <<EOF
[
  {
    "name": "username",
    "type": "STRING",
    "mode": "NULLABLE"
  },
  {
    "name": "hashkey",
    "type": "STRING",
    "mode": "NULLABLE"
  },
  {
    "name": "login_time",
    "type": "TIMESTAMP",
    "mode": "REQUIRED"
  }
]
EOF
}