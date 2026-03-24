"""
DeltaEd — FastAPI Backend
=========================
Endpoints:
  POST /register                           { email, password } → 201 or 409
  POST /login                              { email, password } → 200 + student_id
  GET  /leaderboard                        → top 5 most improved
  GET  /student/{student_id}/subjects      → list of subjects in curriculum
  GET  /student/{student_id}/dashboard     → full dashboard payload

Key implementation notes:
  - Uses SQL INSERT (not streaming insert_rows_json) so rows are immediately queryable
  - login now returns student_id resolved from student_personal_details
  - dashboard q uses two weekly windows for prev/week-before comparisons
"""

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from google.cloud import bigquery
from datetime import date
import hashlib
import os
from dotenv import load_dotenv

from dotenv import load_dotenv
load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

PROJECT_ID = os.environ["GCP_PROJECT_ID"]
client     = bigquery.Client(project=PROJECT_ID, location="EU")

# ── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="DeltaEd API",
    description="Educational platform API with BigQuery integration",
    version="1.0.0"
)

# ── CORS Configuration ────────────────────────────────────────────────────────
# Enable CORS so frontend can make requests from any origin

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (works from phone, desktop, etc.)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allow all headers
)

# ── Table references ──────────────────────────────────────────────────────────
# Table names match Terraform definitions (main.tf)

AUTH_TABLE     = f"`{PROJECT_ID}.auth_creds.user_creds_db`"
SCORES_TABLE   = f"`{PROJECT_ID}.student_db.student_scores`"
PROGRESS_TABLE = f"`{PROJECT_ID}.student_db.student_progress`"
NAMES_TABLE    = f"`{PROJECT_ID}.student_db.student_personal_details`"
CHAPTER_TABLE  = f"`{PROJECT_ID}.educational_resources_db.chapter_table`"
SUBJECT_TABLE  = f"`{PROJECT_ID}.educational_resources_db.subject_table`"

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
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _run(query: str, params: list) -> list:
    """Run a BigQuery query with parameters, return list of row dicts."""
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    return [dict(r) for r in client.query(query, job_config=job_config).result()]


def get_user(email: str) -> dict | None:
    rows = _run(
        f"SELECT username, hashkey FROM {AUTH_TABLE} WHERE username = @email LIMIT 1",
        [bigquery.ScalarQueryParameter("email", "STRING", email)],
    )
    return rows[0] if rows else None


def get_student_id_for_email(email: str) -> str | None:
    """Resolve email → student_id via student_personal_details. None if not found."""
    rows = _run(
        f"SELECT student_id FROM {NAMES_TABLE} WHERE email_address = @email LIMIT 1",
        [bigquery.ScalarQueryParameter("email", "STRING", email)],
    )
    return rows[0]["student_id"] if rows else None


def _safe(v):
    return float(v) if v is not None else None


def _avg(lst, key):
    vals = [c[key] for c in lst if c.get(key) is not None]
    return sum(vals) / len(vals) if vals else None


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "DeltaEd API is running ✅"}

@app.get("/health")
def health():
    return {"status": "ok", "service": "deltaed-backend"}


@app.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserRequest):
    if get_user(user.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="An account with this email already exists.")

    insert_query = f"""
        INSERT INTO {AUTH_TABLE} (username, hashkey, login_time)
        VALUES (@email, @hashkey, CURRENT_TIMESTAMP())
    """
    try:
        _run(insert_query, [
            bigquery.ScalarQueryParameter("email",   "STRING", user.email),
            bigquery.ScalarQueryParameter("hashkey", "STRING", hash_password(user.password)),
        ])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insert failed: {e}")

    return {"message": "User created.", "email": user.email}


@app.post("/login")
def login(user: UserRequest):
    existing = get_user(user.email)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="No account found with that email.")
    if existing["hashkey"] != hash_password(user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Incorrect password. Please try again.")

    # Best-effort — does not fail the login if the student isn't in personal_details
    student_id = get_student_id_for_email(user.email)

    return {
        "message":    "Successful login.",
        "email":      user.email,
        "student_id": student_id,   # None if email not linked to a student record
    }


@app.get("/leaderboard")
def leaderboard():
    """Top 5 most improved students, cached once per day."""
    cached = _get_cached()
    if cached is not None:
        return cached

    query = f"""
        WITH
          week_a AS (
            SELECT student_id, AVG(correct) AS avg_score, COUNT(*) AS q_count
            FROM {SCORES_TABLE}
            WHERE DATE(timestamp)
                  BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                      AND DATE_SUB(CURRENT_DATE(), INTERVAL 8 DAY)
            GROUP BY student_id
            HAVING COUNT(*) >= 10
          ),
          week_b AS (
            SELECT student_id, AVG(correct) AS avg_score, COUNT(*) AS q_count
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
                ORDER BY (b.avg_score - a.avg_score) DESC,
                          b.avg_score DESC,
                          a.student_id ASC
              )                                    AS rank,
              a.student_id,
              ROUND(b.avg_score, 2)                AS avg_score_prev_week,
              ROUND(a.avg_score, 2)                AS avg_score_week_before,
              ROUND(b.avg_score - a.avg_score, 2)  AS growth,
              b.q_count                            AS questions_prev_week,
              a.q_count                            AS questions_week_before
            FROM week_a a JOIN week_b b USING (student_id)
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
        rows = _run(query, [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Leaderboard query failed: {e}")

    result = {"last_updated": date.today().isoformat(), "leaderboard": rows}
    _set_cached(result)
    return result


@app.get("/student/{student_id}/leaderboard-rank")
def get_leaderboard_rank(student_id: str):
    """
    Return this student's full rank in the most-improved leaderboard,
    across ALL eligible students (not just top 5).

    Same eligibility rules as /leaderboard:
      - ≥ 10 attempts in each of the two 7-day windows.
    Returns:
      { rank: int | null, total_eligible: int, growth: float | null }
    rank is null if the student has insufficient activity.
    """
    query = f"""
        WITH
          week_a AS (
            SELECT student_id, AVG(correct) AS avg_score
            FROM {SCORES_TABLE}
            WHERE DATE(timestamp)
                  BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                      AND DATE_SUB(CURRENT_DATE(), INTERVAL 8 DAY)
            GROUP BY student_id
            HAVING COUNT(*) >= 10
          ),
          week_b AS (
            SELECT student_id, AVG(correct) AS avg_score
            FROM {SCORES_TABLE}
            WHERE DATE(timestamp)
                  BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
                      AND DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
            GROUP BY student_id
            HAVING COUNT(*) >= 10
          ),
          all_ranked AS (
            SELECT
              a.student_id,
              ROUND(b.avg_score - a.avg_score, 4) AS growth,
              RANK() OVER (
                ORDER BY (b.avg_score - a.avg_score) DESC,
                          b.avg_score DESC,
                          a.student_id ASC
              ) AS rank,
              COUNT(*) OVER () AS total_eligible
            FROM week_a a JOIN week_b b USING (student_id)
          )
        SELECT rank, growth, total_eligible
        FROM all_ranked
        WHERE student_id = @student_id
        LIMIT 1
    """
    try:
        rows = _run(query, [bigquery.ScalarQueryParameter("student_id", "STRING", student_id)])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rank query failed: {e}")

    if not rows:
        return {"rank": None, "growth": None, "total_eligible": 0}

    r = rows[0]
    return {
        "rank":            int(r["rank"]),
        "growth":          float(r["growth"]) if r["growth"] is not None else None,
        "total_eligible":  int(r["total_eligible"]),
    }



# ── Dashboard endpoints ───────────────────────────────────────────────────────

@app.get("/student/{student_id}/subjects")
def get_subjects(student_id: str):
    """
    All subjects in the curriculum (from chapter_table).
    student_id param accepted for route consistency but subjects are curriculum-wide.
    """
    try:
        rows = _run(
            f"SELECT DISTINCT subject_id, subject_name FROM {CHAPTER_TABLE} ORDER BY subject_name",
            [],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Subjects query failed: {e}")
    return rows


@app.get("/student/{student_id}/dashboard")
def get_dashboard(student_id: str, subject_id: str = Query(...)):
    """
    Full dashboard payload for a student + subject.

    KEY SCHEMA NOTE:
      student_scores uses `topic_id`  (not chapter_id)
      chapter_table  uses `chapter_id`
      topic_id == chapter_id  (same numeric values, different column names)

    All 6 BigQuery queries run in parallel via ThreadPoolExecutor.
    """

    p = [
        bigquery.ScalarQueryParameter("student_id", "STRING", student_id),
        bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id),
    ]
    p_sid  = [bigquery.ScalarQueryParameter("student_id", "STRING", student_id)]
    p_subj = [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)]

    # ── Scores (topic_id in student_scores = chapter_id in chapter_table) ─────
    scores_sql = f"""
        WITH
          chapters AS (
            SELECT chapter_id, chapter_name
            FROM {CHAPTER_TABLE}
            WHERE subject_id = @subject_id
          ),
          base AS (
            SELECT s.topic_id AS chapter_id, s.correct, s.timestamp
            FROM {SCORES_TABLE} s
            JOIN chapters ON s.topic_id = chapters.chapter_id
            WHERE s.student_id = @student_id
          ),
          till_date AS (
            SELECT chapter_id, AVG(correct) AS till_date_avg
            FROM base GROUP BY chapter_id
          ),
          prev_week AS (
            SELECT chapter_id, AVG(correct) AS prev_week_avg
            FROM base
            WHERE DATE(timestamp)
                  BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
                      AND CURRENT_DATE()
            GROUP BY chapter_id
          ),
          week_before AS (
            SELECT chapter_id, AVG(correct) AS week_before_avg
            FROM base
            WHERE DATE(timestamp)
                  BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                      AND DATE_SUB(CURRENT_DATE(), INTERVAL 8 DAY)
            GROUP BY chapter_id
          )
        SELECT
          c.chapter_id,
          c.chapter_name,
          td.till_date_avg,
          pw.prev_week_avg,
          wb.week_before_avg,
          (pw.prev_week_avg - wb.week_before_avg) AS growth_delta
        FROM chapters c
        LEFT JOIN till_date  td USING (chapter_id)
        LEFT JOIN prev_week  pw USING (chapter_id)
        LEFT JOIN week_before wb USING (chapter_id)
        ORDER BY CAST(c.chapter_id AS INT64)
    """

    # ── Progress (chapter_id is correct here) ────────────────────────────────
    progress_sql = f"""
        WITH
          chapters AS (
            SELECT chapter_id, chapter_name
            FROM {CHAPTER_TABLE}
            WHERE subject_id = @subject_id
          ),
          all_prog AS (
            SELECT p.chapter_id, p.chapter_cumulative_progress,
                   p.subject_cumulative_progress, p.timestamp
            FROM {PROGRESS_TABLE} p
            JOIN chapters USING (chapter_id)
            WHERE p.student_id = @student_id
          ),
          -- Chapter-level metrics
          latest_chap AS (
            SELECT chapter_id, chapter_cumulative_progress,
                   ROW_NUMBER() OVER (PARTITION BY chapter_id ORDER BY timestamp DESC) AS rn
            FROM all_prog
          ),
          snap_now AS (
            SELECT chapter_id, chapter_cumulative_progress AS now_prog
            FROM latest_chap WHERE rn = 1
          ),
          snap_7d AS (
            SELECT chapter_id, chapter_cumulative_progress AS prog_7d,
                   ROW_NUMBER() OVER (PARTITION BY chapter_id ORDER BY timestamp DESC) AS rn
            FROM all_prog
            WHERE timestamp <= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
          ),
          at_7d AS (SELECT chapter_id, prog_7d FROM snap_7d WHERE rn = 1),
          snap_14d AS (
            SELECT chapter_id, chapter_cumulative_progress AS prog_14d,
                   ROW_NUMBER() OVER (PARTITION BY chapter_id ORDER BY timestamp DESC) AS rn
            FROM all_prog
            WHERE timestamp <= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)
          ),
          at_14d AS (SELECT chapter_id, prog_14d FROM snap_14d WHERE rn = 1),

          -- Global Subject-level metrics
          subj_now_rn AS (
            SELECT subject_cumulative_progress AS val,
                   ROW_NUMBER() OVER (ORDER BY timestamp DESC) AS rn
            FROM all_prog
          ),
          cte_subj_now AS (SELECT val FROM subj_now_rn WHERE rn = 1),
          
          subj_7d_rn AS (
            SELECT subject_cumulative_progress AS val,
                   ROW_NUMBER() OVER (ORDER BY timestamp DESC) AS rn
            FROM all_prog
            WHERE timestamp <= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
          ),
          cte_subj_7d AS (SELECT val FROM subj_7d_rn WHERE rn = 1),
          
          subj_14d_rn AS (
            SELECT subject_cumulative_progress AS val,
                   ROW_NUMBER() OVER (ORDER BY timestamp DESC) AS rn
            FROM all_prog
            WHERE timestamp <= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 14 DAY)
          ),
          cte_subj_14d AS (SELECT val FROM subj_14d_rn WHERE rn = 1)
          
        SELECT
          c.chapter_id,
          c.chapter_name,
          n.now_prog                      AS till_date_progress,
          (SELECT val FROM cte_subj_now)  AS subject_cumulative_progress,
          (SELECT val FROM cte_subj_7d)   AS subject_prog_7d,
          (SELECT val FROM cte_subj_14d)  AS subject_prog_14d,
          (n.now_prog - a7.prog_7d)       AS prev_week_progress,
          (a7.prog_7d - a14.prog_14d)     AS week_before_progress,
          CASE WHEN n.now_prog >= 0.999 THEN NULL 
               ELSE ((n.now_prog  - a7.prog_7d) - (a7.prog_7d  - a14.prog_14d)) 
          END AS growth_delta
        FROM chapters c
        LEFT JOIN snap_now n   USING (chapter_id)
        LEFT JOIN at_7d    a7  USING (chapter_id)
        LEFT JOIN at_14d   a14 USING (chapter_id)
        ORDER BY CAST(c.chapter_id AS INT64)
    """

    # ── Score growth & percentile (topic_id = chapter_id) ─────────────────────
    score_pct_sql = f"""
        WITH
          chaps AS (SELECT chapter_id FROM {CHAPTER_TABLE} WHERE subject_id = @subject_id),
          td AS (
            SELECT student_id, AVG(correct) AS avg
            FROM {SCORES_TABLE}
            WHERE topic_id IN (SELECT chapter_id FROM chaps)
            GROUP BY student_id
          ),
          pw AS (
            SELECT student_id, AVG(correct) AS avg, COUNT(*) AS cnt
            FROM {SCORES_TABLE}
            WHERE topic_id IN (SELECT chapter_id FROM chaps)
              AND DATE(timestamp) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
                                      AND CURRENT_DATE()
            GROUP BY student_id
          ),
          wb AS (
            SELECT student_id, AVG(correct) AS avg, COUNT(*) AS cnt
            FROM {SCORES_TABLE}
            WHERE topic_id IN (SELECT chapter_id FROM chaps)
              AND DATE(timestamp) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                                      AND DATE_SUB(CURRENT_DATE(), INTERVAL 8 DAY)
            GROUP BY student_id
          ),
          growth AS (
            SELECT pw.student_id, (pw.avg - wb.avg) AS g
            FROM pw JOIN wb USING (student_id)
            WHERE pw.cnt >= 10 AND wb.cnt >= 10
          ),
          my_td AS (SELECT avg FROM td WHERE student_id = @student_id),
          my_pw AS (SELECT avg FROM pw WHERE student_id = @student_id),
          my_wb AS (SELECT avg FROM wb WHERE student_id = @student_id),
          my_g AS (SELECT (pw.avg - wb.avg) AS g FROM pw JOIN wb USING (student_id) WHERE pw.student_id = @student_id),
          total AS (SELECT COUNT(*) AS n FROM growth)
        SELECT
          (SELECT avg FROM my_td) AS till_date_avg,
          (SELECT avg FROM my_pw) AS prev_week_avg,
          (SELECT avg FROM my_wb) AS week_before_avg,
          (SELECT g FROM my_g) AS growth_delta,
          CASE
            WHEN (SELECT n FROM total) <= 1 THEN NULL
            ELSE CAST(ROUND(
              100.0 * (SELECT COUNT(*) FROM growth WHERE g < (SELECT g FROM my_g))
              / NULLIF((SELECT n FROM total) - 1, 0)
            ) AS INT64)
          END AS growth_percentile
    """

    # ── Progress percentile ───────────────────────────────────────────────────
    prog_pct_sql = f"""
        WITH
          chaps AS (SELECT chapter_id FROM {CHAPTER_TABLE} WHERE subject_id = @subject_id),
          latest AS (
            SELECT student_id, subject_cumulative_progress,
                   ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY timestamp DESC) AS rn
            FROM {PROGRESS_TABLE}
            WHERE chapter_id IN (SELECT chapter_id FROM chaps)
          ),
          lps AS (SELECT student_id, subject_cumulative_progress FROM latest WHERE rn = 1),
          my_p AS (SELECT subject_cumulative_progress FROM lps WHERE student_id = @student_id),
          total AS (SELECT COUNT(*) AS n FROM lps)
        SELECT
          CASE
            WHEN (SELECT n FROM total) <= 1 THEN NULL
            ELSE CAST(ROUND(
              100.0 * (SELECT COUNT(*) FROM lps
                       WHERE subject_cumulative_progress < (SELECT subject_cumulative_progress FROM my_p))
              / NULLIF((SELECT n FROM total) - 1, 0)
            ) AS INT64)
          END AS progress_percentile
    """

    name_sql = f"SELECT name FROM {NAMES_TABLE} WHERE student_id = @student_id LIMIT 1"
    subj_sql  = f"SELECT DISTINCT subject_name FROM {CHAPTER_TABLE} WHERE subject_id = @subject_id LIMIT 1"

    # ── Run all 6 queries in parallel ─────────────────────────────────────────
    from concurrent.futures import ThreadPoolExecutor, as_completed

    tasks = {
        "scores":    (scores_sql,    p),
        "progress":  (progress_sql,  p),
        "score_pct": (score_pct_sql, p),
        "prog_pct":  (prog_pct_sql,  p),
        "name":      (name_sql,      p_sid),
        "subj":      (subj_sql,      p_subj),
    }

    results: dict = {}
    try:
        with ThreadPoolExecutor(max_workers=6) as ex:
            futs = {ex.submit(_run, sql, prms): key for key, (sql, prms) in tasks.items()}
            for fut in as_completed(futs):
                key = futs[fut]
                results[key] = fut.result()   # raises on error → caught below
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dashboard query failed: {e}")

    scores_rows = results["scores"]
    prog_rows   = results["progress"]
    sc_pct_rows = results["score_pct"]
    pr_pct_rows = results["prog_pct"]
    name_rows   = results["name"]
    subj_rows   = results["subj"]

    # ── Build by_chapter scores ───────────────────────────────────────────────
    chapters_score = [
        {
            "chapter_id":      r["chapter_id"],
            "chapter_name":    r["chapter_name"],
            "till_date_avg":   _safe(r.get("till_date_avg")),
            "prev_week_avg":   _safe(r.get("prev_week_avg")),
            "week_before_avg": _safe(r.get("week_before_avg")),
            "growth_delta":    _safe(r.get("growth_delta")),
        }
        for r in scores_rows
    ]

    score_row = sc_pct_rows[0] if sc_pct_rows else {}
    growth_pct = score_row.get("growth_percentile")
    prog_pct   = pr_pct_rows[0]["progress_percentile"] if pr_pct_rows else None

    def _round(v):
        return round(v, 4) if v is not None else None

    scores_overall = {
        "till_date_avg":     _round(score_row.get("till_date_avg")),
        "prev_week_avg":     _round(score_row.get("prev_week_avg")),
        "week_before_avg":   _round(score_row.get("week_before_avg")),
        "growth_delta":      _round(score_row.get("growth_delta")),
        "growth_percentile": int(growth_pct) if growth_pct is not None else None,
    }

    # ── Build by_chapter progress ─────────────────────────────────────────────
    chapters_progress = [
        {
            "chapter_id":           r["chapter_id"],
            "chapter_name":         r["chapter_name"],
            "till_date_progress":   _safe(r.get("till_date_progress")),
            "prev_week_progress":   _safe(r.get("prev_week_progress")),
            "week_before_progress": _safe(r.get("week_before_progress")),
            "growth_delta":         _safe(r.get("growth_delta")),
        }
        for r in prog_rows
    ]

    subject_prog = next(
        (_safe(r.get("subject_cumulative_progress")) for r in prog_rows
         if r.get("subject_cumulative_progress") is not None),
        None,
    )
    subject_prog_7d = next(
        (_safe(r.get("subject_prog_7d")) for r in prog_rows
         if r.get("subject_prog_7d") is not None),
        None,
    )
    subject_prog_14d = next(
        (_safe(r.get("subject_prog_14d")) for r in prog_rows
         if r.get("subject_prog_14d") is not None),
        None,
    )

    progress_overall = {
        "till_date_progress":   subject_prog,
        "prev_week_progress":   _round(subject_prog - subject_prog_7d) if subject_prog is not None and subject_prog_7d is not None else None,
        "week_before_progress": _round(subject_prog_7d - subject_prog_14d) if subject_prog_7d is not None and subject_prog_14d is not None else None,
        "growth_delta":         _round(
            (subject_prog - subject_prog_7d) - (subject_prog_7d - subject_prog_14d)
        ) if subject_prog is not None and subject_prog_7d is not None and subject_prog_14d is not None else None,
        "growth_percentile": int(prog_pct) if prog_pct is not None else None,
    }

    student_name = name_rows[0]["name"] if name_rows else student_id
    # subject_name may be NULL in BigQuery.
    # Fallback: derive a curriculum hint from the chapter names already fetched,
    # so the agent has meaningful context rather than the opaque "Subject {id}".
    raw_subj_name = subj_rows[0]["subject_name"] if subj_rows else None
    if raw_subj_name:
        subject_name = raw_subj_name
    elif scores_rows:
        # Use first 3 chapter names as a curriculum fingerprint
        sample = [r["chapter_name"] for r in scores_rows[:3] if r.get("chapter_name")]
        subject_name = f"Subject covering: {', '.join(sample)}" if sample else f"Subject {subject_id}"
    else:
        subject_name = f"Subject {subject_id}"

    return {
        "student_id":   student_id,
        "student_name": student_name,
        "subject_id":   subject_id,
        "subject_name": subject_name,
        "scores": {
            "overall":    scores_overall,
            "by_chapter": chapters_score,
        },
        "progress": {
            "overall":    progress_overall,
            "by_chapter": chapters_progress,
        },
    }



