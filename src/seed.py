"""
seed.py — Load data from GoogleEd_hackathon.xlsx into BigQuery.

Each Excel sheet name matches a BigQuery table name.
Sheet → Dataset mapping:
    student_personal_details  →  student_db
    student_scores            →  student_db
    student_progress          →  student_db
    chapter_table             →  educational_resources_db

Run from the src/ directory:
    uv run python seed.py
"""

import os
import math
import pandas as pd
from dotenv import load_dotenv
from google.cloud import bigquery

load_dotenv()

PROJECT_ID = os.environ["GCP_PROJECT_ID"]
client     = bigquery.Client(project=PROJECT_ID)

XLSX_PATH  = os.path.join(os.path.dirname(__file__), "..", "GoogleEd_hackathon.xlsx")

# Sheet name → BigQuery dataset
DATASET_MAP = {
    "student_personal_details": "student_db",
    "student_scores":           "student_db",
    "student_progress":         "student_db",
    "chapter_table":            "educational_resources_db",
    "subject_table":            "educational_resources_db"
}


def clean_row(row: dict) -> dict:
    """Replace NaN / NaT with None so BigQuery accepts the row."""
    cleaned = {}
    for k, v in row.items():
        if pd.isna(v):
            cleaned[k] = None
        elif hasattr(v, "isoformat"):          # datetime / Timestamp
            cleaned[k] = v.isoformat()
        elif isinstance(v, (float, int)) or type(v).__name__.startswith(('float', 'int')):
            if v == int(v):
                cleaned[k] = int(v)
            else:
                cleaned[k] = float(v)
        else:
            cleaned[k] = v
    return cleaned


def insert_sheet(sheet_name: str, dataset_id: str):
    table_ref = f"{PROJECT_ID}.{dataset_id}.{sheet_name}"
    print(f"\n  Reading sheet '{sheet_name}'...")
    df = pd.read_excel(XLSX_PATH, sheet_name=sheet_name)
    
    # Drop rows that are completely empty or missing their primary ID (the first column)
    df.dropna(how='all', inplace=True)
    if not df.empty:
        df.dropna(subset=[df.columns[0]], inplace=True)
        
    rows = [clean_row(r) for r in df.to_dict(orient="records")]

    if not rows:
        print(f"  ⚠  Sheet '{sheet_name}' is empty — skipping.")
        return

    # Use a Load Job to bypass the streaming buffer completely
    job_config = bigquery.LoadJobConfig(
        source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        write_disposition=bigquery.WriteDisposition.WRITE_APPEND
    )
    
    try:
        job = client.load_table_from_json(rows, table_ref, job_config=job_config)
        job.result()  # Wait for the job to complete
        print(f"  ✓  {table_ref}: {len(rows)} rows inserted via Load Job")
    except Exception as e:
        print(f"  ✗  {table_ref} failed to load:")
        print(f"      {e}")
        if hasattr(job, 'errors') and job.errors:
            for err in job.errors:
                print(f"      {err}")


print(f"\nLoading from: {os.path.abspath(XLSX_PATH)}\n")

for sheet, dataset in DATASET_MAP.items():
    insert_sheet(sheet, dataset)

print("\n✅ Seed complete!")