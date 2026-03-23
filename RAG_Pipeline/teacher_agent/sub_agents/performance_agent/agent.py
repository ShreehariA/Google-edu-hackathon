import warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

from google.adk.agents import Agent
from google.adk.agents.readonly_context import ReadonlyContext
from ...tools import text_to_sql_tool, execute_sql_tool

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
  → For these, call text_to_sql_tool then execute_sql_tool
"""


async def performance_instruction(context: ReadonlyContext) -> str:
    state = context.state

    student_name  = state.get("student_name", "")
    subject_name  = state.get("subject_name", "")
    student_id    = state.get("student_id", "")
    subject_id    = state.get("subject_id", "")

    chapters      = state.get("chapters", [])
    scored        = [c for c in chapters if c.get("score_till_date_avg", 0) > 0]
    sorted_score  = sorted(scored, key=lambda c: c["score_till_date_avg"], reverse=True)
    best_chapter  = sorted_score[0]  if sorted_score else None
    worst_chapter = sorted_score[-1] if sorted_score else None

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

    overall_avg          = round(state.get("overall_till_date_avg", 0) * 100)
    overall_growth       = state.get("overall_growth_delta", 0)
    overall_percentile   = state.get("overall_growth_percentile", 0)
    overall_progress     = round(state.get("overall_till_date_progress", 0) * 100)
    progress_growth      = state.get("overall_progress_growth_delta", 0)

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

    When the student asks something the payload cannot answer:
    Step 1 — call text_to_sql_tool with the student's natural language
             question, student_id={student_id}, subject_id={subject_id}
    Step 2 — call execute_sql_tool with the returned SQL
    Step 3 — narrate the results conversationally

    When presenting results:
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
        text_to_sql_tool,
        execute_sql_tool,
    ],
)