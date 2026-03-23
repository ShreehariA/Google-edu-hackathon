from google.adk.tools import FunctionTool
from .rag_tool import rag_tool
from .focus_tools import compute_focus_chapters, select_chapter
from .text_to_sql_tool import text_to_sql_tool, execute_sql
from .orchestrator_tools import set_scope_gate_destination, clear_scope_gate_state, clear_active_agent, set_active_agent

compute_focus_chapters_tool   = FunctionTool(compute_focus_chapters)
select_chapter_tool           = FunctionTool(select_chapter)
execute_sql_tool              = FunctionTool(execute_sql)
set_scope_gate_destination_tool = FunctionTool(set_scope_gate_destination)
clear_scope_gate_state_tool   = FunctionTool(clear_scope_gate_state)
clear_active_agent_tool = FunctionTool(clear_active_agent)
set_active_agent_tool = FunctionTool(set_active_agent)