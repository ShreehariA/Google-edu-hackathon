import os
import google.auth
from google.adk.tools.bigquery import BigQueryCredentialsConfig, BigQueryToolset
from google.adk.tools.bigquery.config import BigQueryToolConfig, WriteMode
from google.adk.tools import BaseTool, ToolContext
from typing import Dict, Any, Optional

PROJECT_ID = os.environ["GOOGLE_CLOUD_PROJECT"]

application_default_credentials, _ = google.auth.default()
credentials_config = BigQueryCredentialsConfig(
    credentials=application_default_credentials
)

tool_config = BigQueryToolConfig(write_mode=WriteMode.BLOCKED)

bigquery_toolset = BigQueryToolset(
    credentials_config=credentials_config,
    bigquery_tool_config=tool_config
)

async def validate_tenant_isolation(
    tool: BaseTool, args: Dict[str, Any], tool_context: ToolContext
) -> Optional[Dict]:
    if tool.name == 'execute_sql':
        # Native BigQueryToolset uses 'query', fallback to 'sql_query' just in case
        sql_string = args.get('query', args.get('sql_query', '')).lower()
        student_id = str(tool_context.state.get("student_id", "")).lower()
        
        if not student_id:
            return {"result": "Execution blocked: student_id is missing from session state."}
            
        if student_id not in sql_string:
            return {
                "result": f"Execution blocked: Query lacks required student_id filter '{student_id}'. Your query was: {sql_string}"
            }
            
    return None