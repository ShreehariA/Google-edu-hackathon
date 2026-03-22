import warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

from google.adk.agents import Agent
from ...tools import text_to_sql_tool, execute_sql_tool

PAYLOAD_SCHEMA = """
session.state["student_context"] has the following structure:

{
  "student_id": string,
  "student_name": string,
  "subject_id": string,
  "subject_name": string,
  "scores": {
    "overall": {
      "till_date_avg": float,       -- average score across all chapters up to today
      "growth_delta": float,        -- change in average since last period
      "growth_percentile": int      -- percentile rank among peers e.g. 74 = better than 74%
    },
    "by_chapter": [
      {
        "chapter_id": string,
        "chapter_name": string,
        "till_date_avg": float,     -- average score for this chapter up to today
        "growth_delta": float       -- change in chapter score since last period
      }
    ]
  },
  "progress": {
    "overall": {
      "till_date_progress": float,  -- overall completion 0.0 to 1.0
      "growth_delta": float         -- change in completion since last period
    },
    "by_chapter": [
      {
        "chapter_id": string,
        "chapter_name": string,
        "till_date_progress": float, -- chapter completion 0.0 to 1.0
        "growth_delta": float        -- change in chapter completion since last period
      }
    ]
  }
}
"""

PAYLOAD_COVERS = """
The payload CAN answer questions such as:
  - What is my overall score?
  - How am I doing compared to my peers?
  - Which chapter has my highest / lowest score?
  - How much progress have I made overall or per chapter?
  - Have I improved since last period? (growth_delta)

The payload CANNOT answer questions such as:
  - Performance on specific dates or months
  - Weekday vs weekend performance
  - Score or progress trends over time
  - Anything requiring historical granularity beyond the current snapshot
  → For these, use text_to_sql_tool then execute_sql_tool
"""

performance_agent = Agent(
    model='gemini-2.5-flash',
    name='PerformanceAgent',
    instruction=f"""
    You are a performance advisor for {{student_name}} studying {{subject_name}}.

    {PAYLOAD_SCHEMA}

    {PAYLOAD_COVERS}

    When the student asks something the payload cannot answer:

    Step 1 — call text_to_sql_tool with:
      - the student's natural language question
      - student_id from session.state["student_context"]["student_id"]
      - subject_id from session.state["student_context"]["subject_id"]

    Step 2 — take the SQL returned and call execute_sql_tool with it

    Step 3 — narrate the results conversationally

    When presenting any results:
    - Always lead with what has improved — growth first, gaps second
    - Plain language only — never expose SQL, JSON, field names, or internal IDs
      e.g. say "you've improved faster than 74% of your peers" not "growth_percentile: 74"
      e.g. say "you've completed about 60% of Chapter 3" not "till_date_progress: 0.6"
    - Never reference or compare to named peers
    - Never expose raw session state structure to the student
    """,
    tools=[
        text_to_sql_tool,
        execute_sql_tool,
 
    ],
)