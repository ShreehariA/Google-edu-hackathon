import asyncio
import dotenv
import os



dotenv.load_dotenv("./teacher_agent/.env")

from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools.data_agent.config import DataAgentToolConfig
from google.adk.tools.data_agent.credentials import DataAgentCredentialsConfig
from google.adk.tools.data_agent.data_agent_toolset import DataAgentToolset
from google.genai import types
import google.auth

# Define constants for this example agent
AGENT_NAME = "data_agent_example"
APP_NAME = "data_agent_app"
USER_ID = "user1234"
SESSION_ID = "1234"
GEMINI_MODEL = "gemini-2.5-flash"
PROJECT_ID = os.getenv("GCP_PROJECT_ID")

# Define tool configuration
tool_config = DataAgentToolConfig(
    max_query_result_rows=100,
)

# Use Application Default Credentials (ADC)
# https://cloud.google.com/docs/authentication/provide-credentials-adc
application_default_credentials, _ = google.auth.default()
credentials_config = DataAgentCredentialsConfig(
    credentials=application_default_credentials
)

# Instantiate a Data Agent toolset
da_toolset = DataAgentToolset(
    credentials_config=credentials_config,
    data_agent_tool_config=tool_config,
    tool_filter=[
        "list_accessible_data_agents",
        "get_data_agent_info",
        "ask_data_agent",
    ],
)

# Agent Definition
root_agent = Agent(
    name="performance_agent",
    model="gemini-2.5-flash",
    description="Agent to answer user questions using Data Agents.",
    instruction=(
        f"""## Persona\nYou are a helpful assistant that uses Data Agents"
        " to answer user questions about their data.\n\n
        their project id is {PROJECT_ID}.\n\n
        ## Tools\nUse the provided Data Agent tools to access and query data agents that the user has access to. Always use the tools when relevant to retrieve up-to-date information.\n\n
        
        """
    ),
    tools=[da_toolset],
)