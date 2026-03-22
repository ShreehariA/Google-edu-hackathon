from fastapi import FastAPI, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from google.cloud import bigquery
import hashlib
import datetime

import os
from dotenv import load_dotenv

load_dotenv()

PROJECT_ID = os.environ["GCP_PROJECT_ID"]
client = bigquery.Client(project=PROJECT_ID)

app = FastAPI(title="Edu Hackathon API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── BigQuery table references ─────────────────────────────────────────────────
#
# auth_creds.user_creds_db            : username, hashkey, login_time
#
# student_db.student_scores           : student_id, timestamp, question_id, topic_id, correct
# student_db.student_progress         : student_id, timestamp, chapter_id,
#                                       subject_cumulative_progress, chapter_cumulative_progress
# student_db.student_personal_details : student_id, name, email_address
#
# educational_resources_db.chapter_table : chapter_id, chapter_name, subject_name, subject_id
# educational_resources_db.subject_table : subject_id, subject_name
#
# Key mapping:
#   student_scores.topic_id    → chapter_table.chapter_id
#   student_progress.chapter_id → chapter_table.chapter_id  (direct)
#   chapter_table.subject_id   → subject_table.subject_id

AUTH_TABLE     = f"{PROJECT_ID}.auth_creds.user_creds_db"
SCORES_TABLE   = f"{PROJECT_ID}.student_db.student_scores"
PROGRESS_TABLE = f"{PROJECT_ID}.student_db.student_progress"
NAMES_TABLE    = f"{PROJECT_ID}.student_db.student_personal_details"
CHAPTERS_TABLE = f"{PROJECT_ID}.educational_resources_db.chapter_table"
SUBJECTS_TABLE = f"{PROJECT_ID}.educational_resources_db.subject_table"

# ── Simple daily in-memory cache ──────────────────────────────────────────────

_leaderboard_cache: dict = {"date": None, "data": None}
_agent_context_cache: dict = {}

def _get_cached_leaderboard():
    today = datetime.date.today()
    if _leaderboard_cache["date"] == today:
        return _leaderboard_cache["data"]
    return None

def _set_cached_leaderboard(data):
    _leaderboard_cache["date"] = datetime.date.today()
    _leaderboard_cache["data"] = data


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class UserRequest(BaseModel):
    email: EmailStr
    password: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def get_user(email: str) -> dict | None:
    query = f"""
        SELECT username, hashkey
        FROM `{AUTH_TABLE}`
        WHERE username = @email
        LIMIT 1
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("email", "STRING", email)]
    )
    rows = list(client.query(query, job_config=job_config).result())
    return dict(rows[0]) if rows else None


def run_query(sql: str, params: list | None = None) -> list[dict]:
    job_config = bigquery.QueryJobConfig(query_parameters=params or [])
    return [dict(row) for row in client.query(sql, job_config=job_config).result()]


def _float2(v) -> float | None:
    return round(float(v), 2) if v is not None else None


def _int_or_none(v) -> int | None:
    return int(v) if v is not None else None


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserRequest):
    if get_user(user.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail=f"User already exists: {user.email}")
    row = {
        "username": user.email,
        "hashkey": hash_password(user.password),
        "login_time": datetime.datetime.utcnow().isoformat(),
    }
    errors = client.insert_rows_json(AUTH_TABLE, [row])
    if errors:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"BigQuery insert failed: {errors}")
    return {"message": "User created.", "email": user.email}


@app.post("/login")
def login(user: UserRequest, background_tasks: BackgroundTasks):
    existing = get_user(user.email)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="No account found with that email.")
    if existing["hashkey"] != hash_password(user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Incorrect password.")
                            
    # Dispatch an async background job to generate the student profile
    # for the Agent VM to read from the memory cache instantly later!
    background_tasks.add_task(_preload_agent_context, user.email)
    
    return {"message": "Successful login.", "email": user.email}


# ── Leaderboard ───────────────────────────────────────────────────────────────

@app.get("/leaderboard")
def leaderboard():
    cached = _get_cached_leaderboard()
    if cached is not None:
        return cached

    query = f"""
        WITH
          week_a AS (
            SELECT student_id,
                   AVG(correct) AS avg_score,
                   COUNT(*)     AS q_count
            FROM `{SCORES_TABLE}`
            WHERE DATE(timestamp) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                                      AND DATE_SUB(CURRENT_DATE(), INTERVAL  8 DAY)
            GROUP BY student_id
            HAVING COUNT(*) >= 10
          ),
          week_b AS (
            SELECT student_id,
                   AVG(correct) AS avg_score,
                   COUNT(*)     AS q_count
            FROM `{SCORES_TABLE}`
            WHERE DATE(timestamp) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
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


# ── Student: Subject List ─────────────────────────────────────────────────────

@app.get("/student/{student_id}/subjects")
def get_student_subjects(student_id: str):
    """
    Return distinct subjects the student has activity in.
    Joins touched chapters → chapter_table (has subject_id) → subject_table (has subject_name).

    Schema:
      student_scores.topic_id    → chapter_table.chapter_id
      student_progress.chapter_id → chapter_table.chapter_id
      chapter_table.subject_id   → subject_table.subject_id
    """
    sql = f"""
        WITH touched_chapters AS (
            SELECT DISTINCT topic_id AS chapter_id
            FROM `{SCORES_TABLE}`
            WHERE student_id = @student_id

            UNION DISTINCT

            SELECT DISTINCT chapter_id
            FROM `{PROGRESS_TABLE}`
            WHERE student_id = @student_id
        )
        SELECT DISTINCT
            s.subject_id,
            s.subject_name
        FROM touched_chapters tc
        JOIN `{CHAPTERS_TABLE}` c USING (chapter_id)
        JOIN `{SUBJECTS_TABLE}` s ON s.subject_id = c.subject_id
        ORDER BY s.subject_name
    """
    params = [bigquery.ScalarQueryParameter("student_id", "STRING", student_id)]
    rows = run_query(sql, params)

    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"No activity found for student: {student_id}")
    return rows   # [{ subject_id: string, subject_name: string }]


# ── Student: Dashboard ────────────────────────────────────────────────────────

@app.get("/student/{student_id}/dashboard")
def get_student_dashboard(student_id: str, subject_id: str):
    """
    subject_id is the STRING key from subject_table / chapter_table.subject_id.
    All subject filtering is done via chapter_table.subject_id = @subject_id.

    Schema applied:
      student_scores.topic_id    → chapter_table.chapter_id  (scores join)
      student_progress.chapter_id → chapter_table.chapter_id  (progress join)
      chapter_table.subject_id   → subject_table.subject_id  (subject name lookup)
    """

    # ── 0. Student name + subject name ───────────────────────────────────────
    meta_rows = run_query(
        f"""
        SELECT
            p.name       AS student_name,
            s.subject_name
        FROM `{NAMES_TABLE}` p
        CROSS JOIN (
            SELECT subject_name FROM `{SUBJECTS_TABLE}`
            WHERE subject_id = @subject_id
            LIMIT 1
        ) s
        WHERE p.student_id = @student_id
        LIMIT 1
        """,
        [
            bigquery.ScalarQueryParameter("student_id", "STRING", student_id),
            bigquery.ScalarQueryParameter("subject_id",  "STRING", subject_id),
        ],
    )
    student_name = meta_rows[0]["student_name"] if meta_rows else student_id
    subject_name = meta_rows[0]["subject_name"] if meta_rows else subject_id

    # ── 1. SCORE METRICS ──────────────────────────────────────────────────────
    scores_sql = f"""
        WITH
          all_scores AS (
            SELECT
              s.topic_id        AS chapter_id,
              s.correct,
              DATE(s.timestamp) AS dt
            FROM `{SCORES_TABLE}` s
            JOIN `{CHAPTERS_TABLE}` c ON c.chapter_id = s.topic_id
            WHERE s.student_id   = @student_id
              AND c.subject_id   = @subject_id
          ),
          overall_till_date AS (
            SELECT AVG(correct) AS till_date_avg FROM all_scores
          ),
          overall_week_a AS (
            SELECT AVG(correct) AS avg_score, COUNT(*) AS q_count
            FROM all_scores
            WHERE dt BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                         AND DATE_SUB(CURRENT_DATE(), INTERVAL  8 DAY)
          ),
          overall_week_b AS (
            SELECT AVG(correct) AS avg_score, COUNT(*) AS q_count
            FROM all_scores
            WHERE dt BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
                         AND DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
          ),
          per_chapter AS (
            SELECT
              chapter_id,
              AVG(correct) AS till_date_avg,
              AVG(CASE WHEN dt BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL  7 DAY)
                                   AND DATE_SUB(CURRENT_DATE(), INTERVAL  1 DAY)
                       THEN correct END) AS prev_week_avg,
              AVG(CASE WHEN dt BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                                   AND DATE_SUB(CURRENT_DATE(), INTERVAL  8 DAY)
                       THEN correct END) AS week_before_avg
            FROM all_scores
            GROUP BY chapter_id
          ),
          peer_deltas AS (
            SELECT
              s.student_id,
              AVG(CASE WHEN DATE(s.timestamp)
                            BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL  7 DAY)
                                AND DATE_SUB(CURRENT_DATE(), INTERVAL  1 DAY)
                       THEN s.correct END) -
              AVG(CASE WHEN DATE(s.timestamp)
                            BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                                AND DATE_SUB(CURRENT_DATE(), INTERVAL  8 DAY)
                       THEN s.correct END) AS delta
            FROM `{SCORES_TABLE}` s
            JOIN `{CHAPTERS_TABLE}` c ON c.chapter_id = s.topic_id
            WHERE c.subject_id = @subject_id
            GROUP BY s.student_id
            HAVING
              COUNT(CASE WHEN DATE(s.timestamp)
                              BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL  7 DAY)
                                  AND DATE_SUB(CURRENT_DATE(), INTERVAL  1 DAY)
                         THEN 1 END) >= 10
              AND COUNT(CASE WHEN DATE(s.timestamp)
                              BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                                  AND DATE_SUB(CURRENT_DATE(), INTERVAL  8 DAY)
                         THEN 1 END) >= 10
          ),
          this_delta AS (
            SELECT delta FROM peer_deltas WHERE student_id = @student_id
          ),
          score_percentile AS (
            SELECT CAST(ROUND(
              COUNTIF(p.delta < t.delta) * 100.0 / COUNT(*)
            ) AS INT64) AS growth_percentile
            FROM peer_deltas p CROSS JOIN this_delta t
          )

        SELECT
          otd.till_date_avg                                   AS overall_till_date_avg,
          CASE WHEN owb.q_count >= 10 THEN owb.avg_score END  AS overall_week_b_avg,
          CASE WHEN owa.q_count >= 10 THEN owa.avg_score END  AS overall_week_a_avg,
          owb.q_count                                         AS overall_week_b_count,
          owa.q_count                                         AS overall_week_a_count,
          sp.growth_percentile                                AS overall_growth_percentile,
          ARRAY_AGG(STRUCT(
            pc.chapter_id,
            pc.till_date_avg,
            pc.prev_week_avg,
            pc.week_before_avg
          )) AS chapters
        FROM overall_till_date otd
        CROSS JOIN overall_week_a owa
        CROSS JOIN overall_week_b owb
        CROSS JOIN score_percentile sp
        CROSS JOIN per_chapter pc
        GROUP BY 1,2,3,4,5,6
    """
    score_params = [
        bigquery.ScalarQueryParameter("student_id", "STRING", student_id),
        bigquery.ScalarQueryParameter("subject_id",  "STRING", subject_id),
    ]
    score_rows = run_query(scores_sql, score_params)

    # ── 2. PROGRESS METRICS ───────────────────────────────────────────────────
    progress_sql = f"""
        WITH
          student_chap AS (
            SELECT
              p.chapter_id,
              p.chapter_cumulative_progress AS prog,
              p.subject_cumulative_progress AS subj_prog,
              DATE(p.timestamp)             AS dt
            FROM `{PROGRESS_TABLE}` p
            JOIN `{CHAPTERS_TABLE}` c ON c.chapter_id = p.chapter_id
            WHERE p.student_id = @student_id
              AND c.subject_id  = @subject_id
          ),
          till_date AS (
            SELECT MAX(subj_prog) AS till_date_progress FROM student_chap
          ),
          per_chapter_till AS (
            SELECT chapter_id, MAX(prog) AS till_date_progress
            FROM student_chap GROUP BY chapter_id
          ),
          week_a AS (
            SELECT chapter_id, MAX(prog) - MIN(prog) AS progress_gained
            FROM student_chap
            WHERE dt BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                         AND DATE_SUB(CURRENT_DATE(), INTERVAL  8 DAY)
            GROUP BY chapter_id
          ),
          week_b AS (
            SELECT chapter_id, MAX(prog) - MIN(prog) AS progress_gained
            FROM student_chap
            WHERE dt BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
                         AND DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)
            GROUP BY chapter_id
          ),
          overall_week_a AS (SELECT SUM(progress_gained) AS total FROM week_a),
          overall_week_b AS (SELECT SUM(progress_gained) AS total FROM week_b),
          peer_prog_deltas AS (
            SELECT
              p.student_id,
              SUM(wb.progress_gained) - SUM(wa.progress_gained) AS delta
            FROM (
              SELECT DISTINCT s.student_id
              FROM `{PROGRESS_TABLE}` s
              JOIN `{CHAPTERS_TABLE}` c ON c.chapter_id = s.chapter_id
              WHERE c.subject_id = @subject_id
            ) p
            LEFT JOIN (
              SELECT s.student_id, s.chapter_id,
                     MAX(s.chapter_cumulative_progress) - MIN(s.chapter_cumulative_progress) AS progress_gained
              FROM `{PROGRESS_TABLE}` s
              JOIN `{CHAPTERS_TABLE}` c ON c.chapter_id = s.chapter_id
              WHERE c.subject_id = @subject_id
                AND DATE(s.timestamp) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL  7 DAY)
                                         AND DATE_SUB(CURRENT_DATE(), INTERVAL  1 DAY)
              GROUP BY s.student_id, s.chapter_id
            ) wb ON p.student_id = wb.student_id
            LEFT JOIN (
              SELECT s.student_id, s.chapter_id,
                     MAX(s.chapter_cumulative_progress) - MIN(s.chapter_cumulative_progress) AS progress_gained
              FROM `{PROGRESS_TABLE}` s
              JOIN `{CHAPTERS_TABLE}` c ON c.chapter_id = s.chapter_id
              WHERE c.subject_id = @subject_id
                AND DATE(s.timestamp) BETWEEN DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
                                         AND DATE_SUB(CURRENT_DATE(), INTERVAL  8 DAY)
              GROUP BY s.student_id, s.chapter_id
            ) wa ON p.student_id = wa.student_id AND wb.chapter_id = wa.chapter_id
            GROUP BY p.student_id
            HAVING SUM(wb.progress_gained) IS NOT NULL
               AND SUM(wa.progress_gained) IS NOT NULL
          ),
          this_prog_delta AS (
            SELECT delta FROM peer_prog_deltas WHERE student_id = @student_id
          ),
          prog_percentile AS (
            SELECT CAST(ROUND(
              COUNTIF(p.delta < t.delta) * 100.0 / COUNT(*)
            ) AS INT64) AS growth_percentile
            FROM peer_prog_deltas p CROSS JOIN this_prog_delta t
          ),
          chapter_combined AS (
            SELECT
              pct.chapter_id,
              pct.till_date_progress,
              wb.progress_gained AS prev_week_progress,
              wa.progress_gained AS week_before_progress
            FROM per_chapter_till pct
            LEFT JOIN week_b wb USING (chapter_id)
            LEFT JOIN week_a wa USING (chapter_id)
          )

        SELECT
          td.till_date_progress  AS overall_till_date_progress,
          owb.total              AS overall_week_b_progress,
          owa.total              AS overall_week_a_progress,
          pp.growth_percentile   AS overall_growth_percentile,
          ARRAY_AGG(STRUCT(
            cc.chapter_id,
            cc.till_date_progress,
            cc.prev_week_progress,
            cc.week_before_progress
          )) AS chapters
        FROM till_date td
        CROSS JOIN overall_week_a owa
        CROSS JOIN overall_week_b owb
        CROSS JOIN prog_percentile pp
        CROSS JOIN chapter_combined cc
        GROUP BY 1,2,3,4
    """
    progress_params = [
        bigquery.ScalarQueryParameter("student_id", "STRING", student_id),
        bigquery.ScalarQueryParameter("subject_id",  "STRING", subject_id),
    ]
    progress_rows = run_query(progress_sql, progress_params)

    # ── 3. Chapter name lookup ────────────────────────────────────────────────
    chapter_name_map: dict[str, str] = {
        r["chapter_id"]: r["chapter_name"]
        for r in run_query(
            f"SELECT chapter_id, chapter_name FROM `{CHAPTERS_TABLE}` WHERE subject_id = @subject_id",
            [bigquery.ScalarQueryParameter("subject_id", "STRING", subject_id)],
        )
    }

    # ── 4. Assemble response ──────────────────────────────────────────────────

    # Scores
    if score_rows:
        sr = score_rows[0]
        wb_avg = _float2(sr["overall_week_b_avg"])
        wa_avg = _float2(sr["overall_week_a_avg"])
        scores_overall = {
            "till_date_avg":     _float2(sr["overall_till_date_avg"]),
            "prev_week_avg":     wb_avg,
            "week_before_avg":   wa_avg,
            "growth_delta":      _float2(wb_avg - wa_avg) if (wb_avg is not None and wa_avg is not None) else None,
            "growth_percentile": _int_or_none(sr["overall_growth_percentile"]),
        }
        scores_by_chapter = sorted(
            [
                {
                    "chapter_id":      ch["chapter_id"],
                    "chapter_name":    chapter_name_map.get(ch["chapter_id"], ch["chapter_id"]),
                    "till_date_avg":   _float2(ch["till_date_avg"]),
                    "prev_week_avg":   _float2(ch["prev_week_avg"]),
                    "week_before_avg": _float2(ch["week_before_avg"]),
                    "growth_delta":    (
                        _float2(ch["prev_week_avg"] - ch["week_before_avg"])
                        if ch["prev_week_avg"] is not None and ch["week_before_avg"] is not None
                        else None
                    ),
                }
                for ch in sr["chapters"]
            ],
            key=lambda x: x["till_date_avg"] or 0,
            reverse=True,
        )
    else:
        scores_overall = {
            "till_date_avg": None, "prev_week_avg": None,
            "week_before_avg": None, "growth_delta": None, "growth_percentile": None,
        }
        scores_by_chapter = []

    # Progress
    if progress_rows:
        pr = progress_rows[0]
        wb_prog = _float2(pr["overall_week_b_progress"])
        wa_prog = _float2(pr["overall_week_a_progress"])
        progress_overall = {
            "till_date_progress":   _float2(pr["overall_till_date_progress"]),
            "prev_week_progress":   wb_prog,
            "week_before_progress": wa_prog,
            "growth_delta":         _float2(wb_prog - wa_prog) if (wb_prog is not None and wa_prog is not None) else None,
            "growth_percentile":    _int_or_none(pr["overall_growth_percentile"]),
        }
        progress_by_chapter = sorted(
            [
                {
                    "chapter_id":           ch["chapter_id"],
                    "chapter_name":         chapter_name_map.get(ch["chapter_id"], ch["chapter_id"]),
                    "till_date_progress":   _float2(ch["till_date_progress"]),
                    "prev_week_progress":   _float2(ch["prev_week_progress"]),
                    "week_before_progress": _float2(ch["week_before_progress"]),
                    "growth_delta":         (
                        _float2(ch["prev_week_progress"] - ch["week_before_progress"])
                        if ch["prev_week_progress"] is not None and ch["week_before_progress"] is not None
                        else None
                    ),
                }
                for ch in pr["chapters"]
            ],
            key=lambda x: x["till_date_progress"] or 0,
            reverse=True,
        )
    else:
        progress_overall = {
            "till_date_progress": None, "prev_week_progress": None,
            "week_before_progress": None, "growth_delta": None, "growth_percentile": None,
        }
        progress_by_chapter = []

    return {
        "student_id":   student_id,
        "student_name": student_name,
        "subject_id":   subject_id,
        "subject_name": subject_name,
        "scores": {
            "overall":    scores_overall,
            "by_chapter": scores_by_chapter,
        },
        "progress": {
            "overall":    progress_overall,
            "by_chapter": progress_by_chapter,
        },
    }

# ── Agent Context Preloader & Fetch Endpoint ──────────────────────────────────

def _preload_agent_context(email: str):
    """
    Background worker that runs instantly after student login.
    Resolves the student_id from student_personal_details using their email,
    fetches their subjects, pulls all dashboard data, and caches it globally!
    """
    print(f"[Agent Preload] Starting prefetch for {email}...")
    try:
        # Step 1: Look up student_id by email
        query = f"SELECT student_id FROM `{NAMES_TABLE}` WHERE email_address = @email LIMIT 1"
        job_config = bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("email", "STRING", email)]
        )
        rows = list(client.query(query, job_config=job_config).result())
        if not rows:
            print(f"[Agent Preload] No student_id matched to {email}.")
            return
            
        student_id = rows[0]["student_id"]
        
        # Step 2: Fetch all subjects for this student
        try:
            subjects = get_student_subjects(student_id)
        except HTTPException:
            subjects = []
            
        full_context = {
            "student_id":   student_id,
            "email":        email,
            "last_updated": datetime.datetime.utcnow().isoformat(),
            "subjects":     subjects,
            "dashboards":   {}
        }
        
        # Step 3: Fetch dashboard payloads for every active subject and map it out
        for sub in subjects:
            subj_id = sub["subject_id"]
            try:
                full_context["dashboards"][subj_id] = get_student_dashboard(student_id, subj_id)
            except Exception as e:
                print(f"[Agent Preload] Failed to generate dashboard for {subj_id}: {e}")
                
        # Cache it globally
        _agent_context_cache[student_id] = full_context
        print(f"[Agent Preload] SUCCESS: Cached {len(subjects)} subjects for {student_id}")
        
    except Exception as e:
        print(f"[Agent Preload] ERROR preloading context for {email}: {e}")

@app.get("/agent/context/{student_id}")
def get_agent_context(student_id: str):
    """
    VM-facing endpoint. Instantly returns the pre-calculated agent context 
    from backend RAM, preventing 5+ second BigQuery roundtrips for the AI Agent!
    """
    if student_id not in _agent_context_cache:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Context not preloaded. Ensure the student logged in successfully recently."
        )
    return _agent_context_cache[student_id]