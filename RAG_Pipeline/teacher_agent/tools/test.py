from google.adk.agents import Agent
from google.adk.tools import AgentTool
from google.cloud import bigquery
import os
import logging
import dotenv

dotenv.load_dotenv("teacher_agent\.env")


bq_client = bigquery.Client(location=os.environ["GOOGLE_CLOUD_LOCATION"])


# ...existing code...

# Example: Execute a simple query
query = """
SELECT * FROM `birmiu-agent-two26bir-4072.birmiu-agent-two26bir-4072.student_db.student_scores`
LIMIT 10;
"""

try:
    results = bq_client.query(query).result()
    for row in results:
        print(dict(row))
except Exception as e:
    print(f"Error: {e}")