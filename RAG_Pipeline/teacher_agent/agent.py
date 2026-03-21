from google.adk.agents import Agent
from google.adk.tools.retrieval.vertex_ai_rag_retrieval import VertexAiRagRetrieval
from vertexai import rag

import dotenv
import os

dotenv.load_dotenv()

import warnings
warnings.simplefilter(action='ignore', category=FutureWarning)






