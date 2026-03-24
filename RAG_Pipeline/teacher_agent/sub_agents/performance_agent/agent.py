import warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

import os
from google.adk.agents import Agent
from google.adk.agents.readonly_context import ReadonlyContext
from ...tools.text_to_sql_tool import bigquery_toolset, validate_tenant_isolation

PROJECT_ID      = os.environ["GOOGLE_CLOUD_PROJECT"]
SCORES_DATASET  = os.environ["BIGQUERY_SCORES_DATASET_ID"]
CHAPTER_DATASET = os.environ["BIGQUERY_CHAPTER_DATASET_ID"]

SCHEMA_CONTEXT = f"""
You have access to the following BigQuery tables.
Always filter by the student_id provided to you.
Never query data for any other student.

TABLE: `{PROJECT_ID}.{SCORES_DATASET}.student_scores`
COLUMNS:
  - student_id   STRING
  - timestamp    TIMESTAMP
  - question_id  STRING
  - topic_id     STRING
  - correct      INTEGER

TABLE: `{PROJECT_ID}.{SCORES_DATASET}.student_progress`
COLUMNS:
  - student_id                   STRING
  - timestamp                    TIMESTAMP
  - chapter_id                   STRING
  - subject_cumulative_progress  FLOAT
  - chapter_cumulative_progress  FLOAT

TABLE: `{PROJECT_ID}.{CHAPTER_DATASET}.chapter_table`
COLUMNS:
  - chapter_id   STRING
  - chapter_name STRING
  - subject_name STRING
  - subject_id   STRING

TABLE: `{PROJECT_ID}.{CHAPTER_DATASET}.subject_table`
COLUMNS:
  - subject_id   STRING
  - subject_name STRING
"""

async def performance_instruction(context: ReadonlyContext) -> str:
    state = context.state

    student_name  = state.get("student_name", "")
    subject_name  = state.get("subject_name", "")
    student_id    = state.get("student_id", "")

    chapters      = state.get("chapters", [])
    # Filter out chapters with no activity for best/worst calculation
    active_scored = [c for c in chapters if c.get("score_till_date_avg", 0) > 0 or c.get("progress_till_date", 0) > 0]
    sorted_score  = sorted(active_scored, key=lambda c: c.get("score_till_date_avg", 0), reverse=True)
    
    best_chapter  = sorted_score[0]  if sorted_score else None
    worst_chapter = sorted_score[-1] if sorted_score else None

    # Filter out 0-value rows from the narrative summary
    chapters_summary = "\n".join([
        f"  - {c['chapter_name']}: "
        f"score={round(c.get('score_till_date_avg', 0) * 100)}%, "
        f"progress={round(c.get('progress_till_date', 0) * 100)}%, "
        f"score_growth={'+' if c.get('score_growth_delta', 0) >= 0 else ''}"
        f"{round(c.get('score_growth_delta', 0) * 100)}%, "
        f"progress_growth={'+' if c.get('progress_growth_delta', 0) >= 0 else ''}"
        f"{round(c.get('progress_growth_delta', 0) * 100)}%"
        for c in chapters if c.get('score_till_date_avg', 0) > 0 or c.get('progress_till_date', 0) > 0
    ])

    overall_avg          = round(state.get("overall_till_date_avg", 0) * 100)
    overall_growth       = state.get("overall_growth_delta", 0)
    overall_percentile   = state.get("overall_growth_percentile", 0)
    overall_progress     = round(state.get("overall_till_date_progress", 0) * 100)
    progress_growth      = state.get("overall_progress_growth_delta", 0)

    best_str  = f"{best_chapter['chapter_name']} — {round(best_chapter.get('score_till_date_avg', 0) * 100)}%" if best_chapter else "N/A"
    worst_str = f"{worst_chapter['chapter_name']} — {round(worst_chapter.get('score_till_date_avg', 0) * 100)}%" if worst_chapter else "N/A"

    dynamic_rules = f"""
    RULES:
      - Explicit Table Joins: 'topic_id' in student_scores is identical to 'chapter_id' in student_progress and chapter_table.
      - Mandatory Filter: Always include WHERE student_id = '{student_id}'
      - Temporal Granularity: 
        * For 'week-on-week': Use DATE_TRUNC(DATE(timestamp), WEEK)
        * For 'month-on-month': Use DATE_TRUNC(DATE(timestamp), MONTH)
        * Format output as YYYY-MM-DD for weeks and YYYY-MM for months.
      - Zero-Value Filtering: Exclude rows where activity is zero (e.g., AND correct > 0 or AND chapter_cumulative_progress > 0).
      - Never SELECT * — only declare necessary columns.
    """

    return f"""
    You are a performance advisor for {student_name} studying {subject_name}.
    Target student_id: {student_id}

    EXECUTION PROTOCOL:
    1. Evaluate if the user's query can be fully answered using the SESSION SNAPSHOT data below.
    2. If the query falls under the 'PAYLOAD CAN ANSWER' category, generate the response immediately using ONLY the provided text. DO NOT invoke BigQueryToolset.
    3. If and only if the query falls under the 'PAYLOAD CANNOT ANSWER' category, utilize BigQueryToolset.

    {SCHEMA_CONTEXT}
    {dynamic_rules}

    SESSION SNAPSHOT (Non-zero chapters only):
      OVERALL PERFORMANCE:
        Score average:     {overall_avg}%
        Score growth:      {'+' if overall_growth >= 0 else ''}{round(overall_growth * 100)}%
        Growth percentile: {overall_percentile}%
        Progress:          {overall_progress}%
        Progress growth:   {'+' if progress_growth >= 0 else ''}{round(progress_growth * 100)}%

      BEST CHAPTER:  {best_str}
      WORST CHAPTER: {worst_str}

      ALL ACTIVE CHAPTERS:
{chapters_summary}

    CAPABILITY SCOPE:
      PAYLOAD CAN ANSWER:
        - What is my overall score?
        - Which chapter has my highest / lowest score?
        - How much progress have I made overall or per chapter?

      PAYLOAD CANNOT ANSWER:
        - Performance on specific dates or months
        - Weekday vs weekend performance
        - Score or progress trends over time
        - Aggregations requiring raw historical data
    """

performance_agent = Agent(
    model='gemini-2.5-flash',
    name='PerformanceAgent',
    instruction=performance_instruction,
    tools=[bigquery_toolset],
    before_tool_callback=validate_tenant_isolation
)