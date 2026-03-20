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
}


def clean_row(row: dict) -> dict:
    """Replace NaN / NaT with None so BigQuery accepts the row."""
    cleaned = {}
    for k, v in row.items():
        if v is None:
            cleaned[k] = None
        elif isinstance(v, float) and math.isnan(v):
            cleaned[k] = None
        elif hasattr(v, "isoformat"):          # datetime / Timestamp
            cleaned[k] = v.isoformat()
        else:
            cleaned[k] = v
    return cleaned


def insert_sheet(sheet_name: str, dataset_id: str):
    table_ref = f"{PROJECT_ID}.{dataset_id}.{sheet_name}"
    print(f"\n  Reading sheet '{sheet_name}'...")
    df = pd.read_excel(XLSX_PATH, sheet_name=sheet_name)
    rows = [clean_row(r) for r in df.to_dict(orient="records")]

    if not rows:
        print(f"  ⚠  Sheet '{sheet_name}' is empty — skipping.")
        return

    errors = client.insert_rows_json(table_ref, rows)
    if errors:
        print(f"  ✗  {table_ref}: {errors}")
    else:
        print(f"  ✓  {table_ref}: {len(rows)} rows inserted")


print(f"\nLoading from: {os.path.abspath(XLSX_PATH)}\n")

for sheet, dataset in DATASET_MAP.items():
    insert_sheet(sheet, dataset)

print("\n✅ Seed complete!")
