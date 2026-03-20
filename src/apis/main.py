from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from google.cloud import bigquery
import hashlib
import datetime

import os
from dotenv import load_dotenv

load_dotenv()  # reads src/.env

PROJECT_ID = os.environ["GCP_PROJECT_ID"]
client = bigquery.Client(project=PROJECT_ID)

app = FastAPI(title="Edu Hackathon API")

# Allow frontend HTML files (file://) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── BigQuery table references ─────────────────────────────────────────────────

AUTH_TABLE   = f"{PROJECT_ID}.auth_creds.user_creds_db"
SCORES_TABLE = f"{PROJECT_ID}.student_db.student_scores"
NAMES_TABLE  = f"{PROJECT_ID}.student_db.student_personal_details"

# ── Simple daily in-memory cache ──────────────────────────────────────────────

_leaderboard_cache: dict = {"date": None, "data": None}

def _get_cached_leaderboard():
    today = datetime.date.today()
    if _leaderboard_cache["date"] == today:
        return _leaderboard_cache["data"]
    return None

def _set_cached_leaderboard(data):
    _leaderboard_cache["date"] = datetime.date.today()
    _leaderboard_cache["data"] = data


# BigQuery config — matches deployments/main.tf
DATASET_ID = "auth_creds"
TABLE_ID   = "user_creds_db"
TABLE_REF  = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"

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
            detail=f"User already exists: {user.email}",
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


# ── Leaderboard ───────────────────────────────────────────────────────────────

@app.get("/leaderboard")
def leaderboard():
    """
    Return the top 5 students with the biggest improvement in assessment accuracy
    between the two most recent 7-day windows.

    Week A (baseline):  today-14d → today-8d
    Week B (recent):    today-7d  → today-1d

    Eligibility: ≥ 10 questions attempted in EACH window.
    Ranked by: growth DESC, avg_week_b DESC, student_id ASC.
    Result is cached daily.
    """
    cached = _get_cached_leaderboard()
    if cached is not None:
        return cached

    query = f"""
        WITH
          week_a AS (
            SELECT student_id,
                   AVG(correct) AS avg_score,
                   COUNT(*)     AS q_count
            FROM   `{SCORES_TABLE}`
            WHERE  DATE(timestamp) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                                       AND DATE_SUB(CURRENT_DATE(), INTERVAL 8 DAY)
            GROUP  BY student_id
            HAVING COUNT(*) >= 10
          ),
          week_b AS (
            SELECT student_id,
                   AVG(correct) AS avg_score,
                   COUNT(*)     AS q_count
            FROM   `{SCORES_TABLE}`
            WHERE  DATE(timestamp) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
                                       AND DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
            GROUP  BY student_id
            HAVING COUNT(*) >= 10
          ),
          ranked AS (
            SELECT
              RANK() OVER (
                ORDER BY (b.avg_score - a.avg_score) DESC,
                          b.avg_score DESC,
                          a.student_id ASC
              )                                   AS rank,
              a.student_id,
              ROUND(b.avg_score, 2)               AS avg_score_prev_week,
              ROUND(a.avg_score, 2)               AS avg_score_week_before,
              ROUND(b.avg_score - a.avg_score, 2) AS growth,
              b.q_count                           AS questions_prev_week,
              a.q_count                           AS questions_week_before
            FROM week_a a
            JOIN week_b b USING (student_id)
          )
        SELECT
          r.rank,
          r.student_id,
          COALESCE(p.name, r.student_id) AS name,
          r.avg_score_prev_week,
          r.avg_score_week_before,
          r.growth,
          r.questions_prev_week,
          r.questions_week_before
        FROM ranked r
        LEFT JOIN `{NAMES_TABLE}` p USING (student_id)
        WHERE r.rank <= 5
        ORDER BY r.rank
    """

    rows = list(client.query(query).result())
    result = {
        "last_updated": datetime.date.today().isoformat(),
        "leaderboard": [dict(row) for row in rows],
    }
    _set_cached_leaderboard(result)
    return result
