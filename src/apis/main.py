"""
DeltaEd — FastAPI Backend
=========================
Endpoints:
  POST /register   { email, password }  → 201 or 409
  POST /login      { email, password }  → 200 or 401/404
  GET  /leaderboard                     → 200 with top 5 most improved

Key fixes vs original:
  - Uses SQL INSERT instead of streaming insert_rows_json
    (streaming buffer has ~90s delay before rows are queryable)
  - Fixed datetime import (removed bare `import datetime`,
    now uses `from datetime import datetime, date, timezone`)
  - Fixed login_time format (TIMESTAMP column needs proper ISO string)
  - Leaderboard cache uses date from `date` not `datetime.date`
"""

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from google.cloud import bigquery
from datetime import datetime, date, timezone
import hashlib
import os

from dotenv import load_dotenv
load_dotenv()  # reads .env from current directory

# ── Config ────────────────────────────────────────────────────────────────────

PROJECT_ID = os.environ["GCP_PROJECT_ID"]
client     = bigquery.Client(project=PROJECT_ID)

# ── Table references ──────────────────────────────────────────────────────────

AUTH_TABLE   = f"`{PROJECT_ID}.auth_creds.user_creds_db`"
SCORES_TABLE = f"`{PROJECT_ID}.student_db.student_scores`"
NAMES_TABLE  = f"`{PROJECT_ID}.student_db.student_personal_details`"
TABLE_REF    = f"`{PROJECT_ID}.auth_creds.user_creds_db`"

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="DeltaEd API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Daily leaderboard cache ───────────────────────────────────────────────────

_cache: dict = {"date": None, "data": None}

def _get_cached():
    if _cache["date"] == date.today():
        return _cache["data"]
    return None

def _set_cached(data):
    _cache["date"] = date.today()
    _cache["data"] = data

# ── Pydantic models ───────────────────────────────────────────────────────────

class UserRequest(BaseModel):
    email: EmailStr
    password: str

# ── Helpers ───────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """SHA-256 hash of the password."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def get_user(email: str) -> dict | None:
    """
    Look up a user by email in BigQuery.
    Uses a parameterised query to prevent SQL injection.
    Returns a dict with 'username' and 'hashkey', or None.
    """
    query = f"""
        SELECT username, hashkey
        FROM {TABLE_REF}
        WHERE username = @email
        LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("email", "STRING", email),
        ]
    )
    rows = list(client.query(query, job_config=job_config).result())
    return dict(rows[0]) if rows else None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    """Health check."""
    return {"status": "DeltaEd API is running ✅"}


@app.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserRequest):
    """
    Register a new user.

    Uses a SQL INSERT (not streaming insert_rows_json) so the row is
    immediately visible to subsequent SELECT queries — no buffer delay.
    """
    # Check for duplicates first
    if get_user(user.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # SQL INSERT — immediately queryable, no streaming buffer delay
    insert_query = f"""
        INSERT INTO {TABLE_REF} (username, hashkey, login_time)
        VALUES (@email, @hashkey, CURRENT_TIMESTAMP())
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("email",   "STRING", user.email),
            bigquery.ScalarQueryParameter("hashkey", "STRING", hash_password(user.password)),
        ]
    )

    try:
        client.query(insert_query, job_config=job_config).result()  # .result() waits for completion
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database insert failed: {str(e)}",
        )

    return {"message": "User created.", "email": user.email}


@app.post("/login")
def login(user: UserRequest):
    """
    Authenticate a user.

    Fetches the stored SHA-256 hash and compares it to the hash of
    the supplied password.
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
            detail="Incorrect password. Please try again.",
        )

    return {"message": "Successful login.", "email": user.email}


@app.get("/leaderboard")
def leaderboard():
    """
    Return the top 5 most improved students.

    Compares average quiz accuracy across two 7-day windows:
      Week A (baseline): today-14d → today-8d
      Week B (recent):   today-7d  → today-1d

    Eligibility: ≥ 10 attempts in EACH window.
    Ranked by: growth DESC, then avg_week_b DESC, then student_id ASC.

    Result is cached once per day in memory.
    """
    cached = _get_cached()
    if cached is not None:
        return cached

    query = f"""
        WITH
          week_a AS (
            SELECT
              student_id,
              AVG(correct) AS avg_score,
              COUNT(*)     AS q_count
            FROM {SCORES_TABLE}
            WHERE DATE(timestamp)
                  BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                      AND DATE_SUB(CURRENT_DATE(), INTERVAL 8 DAY)
            GROUP BY student_id
            HAVING COUNT(*) >= 10
          ),
          week_b AS (
            SELECT
              student_id,
              AVG(correct) AS avg_score,
              COUNT(*)     AS q_count
            FROM {SCORES_TABLE}
            WHERE DATE(timestamp)
                  BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
                      AND DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
            GROUP BY student_id
            HAVING COUNT(*) >= 10
          ),
          ranked AS (
            SELECT
              RANK() OVER (
                ORDER BY
                  (b.avg_score - a.avg_score) DESC,
                  b.avg_score DESC,
                  a.student_id ASC
              )                                    AS rank,
              a.student_id,
              ROUND(b.avg_score, 2)                AS avg_score_prev_week,
              ROUND(a.avg_score, 2)                AS avg_score_week_before,
              ROUND(b.avg_score - a.avg_score, 2)  AS growth,
              b.q_count                            AS questions_prev_week,
              a.q_count                            AS questions_week_before
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
        LEFT JOIN {NAMES_TABLE} p USING (student_id)
        WHERE r.rank <= 5
        ORDER BY r.rank
    """

    try:
        rows = list(client.query(query).result())
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Leaderboard query failed: {str(e)}",
        )

    result = {
        "last_updated": date.today().isoformat(),
        "leaderboard": [dict(row) for row in rows],
    }
    _set_cached(result)
    return result