from google.adk.tools import FunctionTool
from .rag_tool import rag_tool
from .bigquery_tool import bigquery_tool
from .focus_tools import compute_focus_chapters, select_chapter
from .text_to_sql_tool import text_to_sql_tool, execute_sql

compute_focus_chapters_tool = FunctionTool(compute_focus_chapters)
select_chapter_tool = FunctionTool(select_chapter)
execute_sql_tool = FunctionTool(execute_sql)