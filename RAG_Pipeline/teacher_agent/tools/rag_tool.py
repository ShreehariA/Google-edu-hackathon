import warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the teacher_agent package directory.
# This is necessary because this module is imported at module load time
# (via tools/__init__.py), which happens before server.py's load_dotenv() call.
_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(_env_path, override=False)   # override=False: real env vars take precedence

from google.adk.agents import Agent
from google.adk.tools.retrieval.vertex_ai_rag_retrieval import VertexAiRagRetrieval
from vertexai import rag
import vertexai

LOCATION      = os.environ["GOOGLE_CLOUD_LOCATION"]
PROJECT_ID    = os.environ["GOOGLE_CLOUD_PROJECT"]
RAG_CORPUS_URI = os.environ["GOOGLE_RAG_CORPUS"]

vertexai.init(project=PROJECT_ID, location=LOCATION)


rag_tool = VertexAiRagRetrieval(
    name='retrieve_rag_study_resources',
    description=(
        'Use this tool to retrieve study resources and reference materials for the question from the RAG corpus,'
    ),
    rag_resources=[
        rag.RagResource(
            # please fill in your own rag corpus
            # here is a sample rag corpus for testing purpose
            # e.g. projects/123/locations/us-central1/ragCorpora/456
            rag_corpus= RAG_CORPUS_URI
        )
    ],
    similarity_top_k=10,
    vector_distance_threshold=0.6,
)