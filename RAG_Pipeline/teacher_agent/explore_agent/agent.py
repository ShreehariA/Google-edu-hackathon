
import warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

from google.adk.agents import Agent
from google.adk.tools import google_search


import dotenv
import os


dotenv.load_dotenv("../.env")

LOCATION = os.environ["GOOGLE_CLOUD_LOCATION"]
PROJECT_ID = os.environ["GOOGLE_CLOUD_PROJECT"]






# Google Search Agent

search_agent = Agent(
    model='gemini-2.5-flash',
    name='google_search_agent',
    description="Google search agent for answering relevant questions outside the scope of the rag agent",
    instruction= "You are a google search agent that will answer questions outside the rag resource. The questions must still be relevant to the subject matter.",
    tools=[
        google_search,
    ]
)






