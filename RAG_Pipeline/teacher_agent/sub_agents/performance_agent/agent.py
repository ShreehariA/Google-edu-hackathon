import warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

from google.adk.agents import Agent
from google.adk.agents.readonly_context import ReadonlyContext
from google.adk.tools.data_agent.config import DataAgentToolConfig
from google.adk.tools.data_agent.credentials import DataAgentCredentialsConfig
from google.adk.tools.data_agent.data_agent_toolset import DataAgentToolset
import google.auth
import os

PROJECT_ID = os.getenv("GCP_PROJECT_ID")

tool_config = DataAgentToolConfig(
    max_query_result_rows=100,
)

application_default_credentials, _ = google.auth.default()
credentials_config = DataAgentCredentialsConfig(
    credentials=application_default_credentials
)

da_toolset = DataAgentToolset(
    credentials_config=credentials_config,
    data_agent_tool_config=tool_config,
    tool_filter=[
        "list_accessible_data_agents",
        "get_data_agent_info",
        "ask_data_agent",
    ],
)

PAYLOAD_COVERS = """
The payload CAN answer:
  - What is my overall score?
  - How am I doing compared to my peers?
  - Which chapter has my highest / lowest score?
  - How much progress have I made overall or per chapter?
  - Have I improved since last period?

The payload CANNOT answer:
  - Performance on specific dates or months
  - Weekday vs weekend performance
  - Score or progress trends over time
  - Anything requiring historical granularity beyond the current snapshot
  → For these, use the data agent
"""


async def performance_instruction(context: ReadonlyContext) -> str:
    state = context.state

    student_name       = state.get("student_name", "")
    subject_name       = state.get("subject_name", "")
    student_id         = state.get("student_id", "")
    subject_id         = state.get("subject_id", "")

    chapters           = state.get("chapters", [])
    scored             = [c for c in chapters if c.get("score_till_date_avg", 0) > 0]
    sorted_score       = sorted(scored, key=lambda c: c["score_till_date_avg"], reverse=True)
    best_chapter       = sorted_score[0]  if sorted_score else None
    worst_chapter      = sorted_score[-1] if sorted_score else None

    chapters_summary = "\n".join([
        f"  - {c['chapter_name']}: "
        f"score={round(c['score_till_date_avg'] * 100)}%, "
        f"progress={round(c['progress_till_date'] * 100)}%, "
        f"score_growth={'+' if c['score_growth_delta'] >= 0 else ''}"
        f"{round(c['score_growth_delta'] * 100)}%, "
        f"progress_growth={'+' if c['progress_growth_delta'] >= 0 else ''}"
        f"{round(c['progress_growth_delta'] * 100)}%"
        for c in chapters
    ])

    overall_avg        = round(state.get("overall_till_date_avg", 0) * 100)
    overall_growth     = state.get("overall_growth_delta", 0)
    overall_percentile = state.get("overall_growth_percentile", 0)
    overall_progress   = round(state.get("overall_till_date_progress", 0) * 100)
    progress_growth    = state.get("overall_progress_growth_delta", 0)

    best_str  = f"{best_chapter['chapter_name']} — {round(best_chapter['score_till_date_avg'] * 100)}%" if best_chapter else "N/A"
    worst_str = f"{worst_chapter['chapter_name']} — {round(worst_chapter['score_till_date_avg'] * 100)}%" if worst_chapter else "N/A"

    return f"""
    You are a performance advisor for {student_name} studying {subject_name}.

    Use ONLY the data below to answer the student's questions.
    Do NOT reference session.state, compute values yourself, or use
    template syntax. Just read the numbers below and narrate conversationally.

    OVERALL PERFORMANCE:
      Score average:     {overall_avg}%
      Score growth:      {'+' if overall_growth >= 0 else ''}{round(overall_growth * 100)}%
      Growth percentile: {overall_percentile}%
      Progress:          {overall_progress}%
      Progress growth:   {'+' if progress_growth >= 0 else ''}{round(progress_growth * 100)}%

    BEST CHAPTER:  {best_str}
    WORST CHAPTER: {worst_str}

    ALL CHAPTERS:
{chapters_summary}

    {PAYLOAD_COVERS}

    STUDENT CONTEXT FOR DATA AGENT QUERIES:
      student_id = {{student_id}}
      project_id = {PROJECT_ID}

    WHEN TO USE THE DATA AGENT:
    Call the data agent when the student asks something the payload cannot
    answer — historical trends, specific dates, weekday vs weekend, monthly
    breakdowns etc.

    HOW TO USE THE DATA AGENT:
    Step 1 — call list_accessible_data_agents to find available agents.
             You MUST only use the agent named "Performance Agent".
             Do not use any other data agent.

    Step 2 — call get_data_agent_info with the Performance Agent's ID
             to understand what it can answer.

    Step 3 — call ask_data_agent with:
             - the Performance Agent's ID
             - a precise, data-focused question that includes:
                 "for student_id {student_id}"
             - always include {student_id} in the question
               so the data agent filters correctly and never returns
               data for other students

    Example ask_data_agent question:
    "For student_id {student_id},
     what was the average score on weekdays vs weekends over the last 30 days?"

    Step 4 — narrate the results conversationally.
             If the data agent returns no results, tell the student honestly
             that there isn't enough historical data to answer that question.

    STRICT RULES FOR DATA AGENT CALLS:
    - ONLY use the data agent named "Performance Agent" — never any other
    - ALWAYS include student_id = {student_id} in every ask_data_agent call
    - Never expose the raw query, SQL, or data agent response to the student
    - If the data agent returns an error, tell the student you couldn't
      retrieve that data and suggest they ask a different question

    When presenting any results:
    - Always lead with what has improved — growth first, gaps second
    - Plain language only — never expose SQL, JSON, state keys, or internal IDs
      e.g. "you've improved faster than {overall_percentile}% of your peers"
           not "overall_growth_percentile: {overall_percentile}"
      e.g. "you've completed about {overall_progress}% of the course"
           not "overall_till_date_progress: 0.{overall_progress}"
    - Never reference or compare to named peers
    - Never expose session state structure to the student
    """


performance_agent = Agent(
    model='gemini-2.5-flash',
    name='PerformanceAgent',
    instruction=performance_instruction,
    tools=[
        da_toolset,
    ],
)