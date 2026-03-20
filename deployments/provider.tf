# provider.tf

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0" # Ensures you use a modern version of the GCP provider
    }
  }
}

provider "google" {
  project = "birmiu-agent-two26bir-4072"
  region  = "europe-west2" # London region
  zone    = "europe-west2-a"
}