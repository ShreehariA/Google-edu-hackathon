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

    def _pct(v):
        """Convert a float (possibly None) to an integer percentage."""
        return round((v or 0) * 100)

    def _sign(v):
        """Return '+' prefix for non-negative values."""
        return '+' if (v or 0) >= 0 else ''

    chapters_summary = "\n".join([
        f"  - {c['chapter_name']}: "
        f"score={_pct(c.get('score_till_date_avg'))}%, "
        f"progress={_pct(c.get('progress_till_date'))}%, "
        f"score_growth={_sign(c.get('score_growth_delta'))}"
        f"{_pct(c.get('score_growth_delta'))}%, "
        f"progress_growth={_sign(c.get('progress_growth_delta'))}"
        f"{_pct(c.get('progress_growth_delta'))}%"
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
    You have TWO data sources. You MUST use the right one for each question.

    ═══════════════════════════════════════════════════════════════
    DATA SOURCE 1: SNAPSHOT (already loaded — use for simple questions)
    ═══════════════════════════════════════════════════════════════

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

    Use DATA SOURCE 1 for:
      ✅ "What is my overall score?"
      ✅ "How am I doing compared to my peers?"
      ✅ "Which chapter is my best / worst?"
      ✅ "How much progress have I made?"
      ✅ "Have I improved?"

    ═══════════════════════════════════════════════════════════════
    DATA SOURCE 2: DATABASE (call tools — REQUIRED for time/trend questions)
    ═══════════════════════════════════════════════════════════════

    MANDATORY: For ANY question about dates, times, trends, weekdays,
    weekends, months, weeks, "over time", "history", or specific periods,
    you MUST call the tools below. NEVER say "I don't have that data."

    Use DATA SOURCE 2 for:
      🔧 "How did I do on weekdays vs weekends?"
      🔧 "Show me my monthly score trend"
      🔧 "When do I study the most?"
      🔧 "How have my scores changed over the last month?"
      🔧 Any question involving time, dates, or historical patterns

    HOW TO USE DATA SOURCE 2:
      Step 1 → Call text_to_sql_tool with this EXACT format:
               "Question: <student's question>. student_id={student_id}, subject_id={subject_id}"
      Step 2 → Take the SQL string returned and call execute_sql with it
      Step 3 → Read the rows returned and narrate them conversationally

    CRITICAL: If the question mentions time, dates, trends, weekday, weekend,
    month, week, history — ALWAYS call text_to_sql_tool. Do NOT refuse.
    Do NOT say you lack data. The database has the full history.

    ═══════════════════════════════════════════════════════════════
    PRESENTATION RULES
    ═══════════════════════════════════════════════════════════════
    - Always lead with what has improved — growth first, gaps second
    - Plain language only — never expose SQL, JSON, state keys, or internal IDs
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