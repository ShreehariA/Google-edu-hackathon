from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, EmailStr
from google.cloud import bigquery
import hashlib
import datetime

import os
from dotenv import load_dotenv

load_dotenv()  # reads src/.env

PROJECT_ID = os.environ["GCP_PROJECT_ID"]
client = bigquery.Client(project=PROJECT_ID)

app = FastAPI(title="Auth API")

# BigQuery config — matches deployments/main.tf
DATASET_ID = "auth_creds"
TABLE_ID = "user_creds"
TABLE_REF = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"

# ── Pydantic schemas ─────────────────────────────────────────────────────────

class UserRequest(BaseModel):
    email: EmailStr
    password: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Return the SHA-256 hex digest of the given password."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def get_user(email: str) -> dict | None:
    """Fetch a single user row from BigQuery by email (username). Returns None if not found."""
    query = f"""
        SELECT username, hashkey
        FROM `{TABLE_REF}`
        WHERE username = @email
        LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("email", "STRING", email),
        ]
    )
    results = client.query(query, job_config=job_config).result()
    rows = list(results)
    return dict(rows[0]) if rows else None


# ── Routes ───────────────────────────────────────────────────────────────────

@app.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserRequest):
    """
    Create a new user.
    - Checks that the email is not already registered.
    - Hashes the password with SHA-256.
    - Inserts a row into BigQuery: username, hashkey, login_time.
    """
    # Prevent duplicate registrations
    if get_user(user.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    row = {
        "username": user.email,
        "hashkey": hash_password(user.password),
        "login_time": datetime.datetime.utcnow().isoformat(),
    }

    errors = client.insert_rows_json(TABLE_REF, [row])
    if errors:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BigQuery insert failed: {errors}",
        )

    return {"message": "User created.", "email": user.email}


@app.post("/login")
def login(user: UserRequest):
    """
    Authenticate an existing user.
    - Fetches the stored SHA-256 hash from BigQuery.
    - Hashes the supplied password and compares the two.
    - Updates login_time on successful authentication.
    """
    existing = get_user(user.email)

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with that email.",
        )

    if existing["hashkey"] != hash_password(user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password.",
        )

    return {"message": "Successful login.", "email": user.email}
