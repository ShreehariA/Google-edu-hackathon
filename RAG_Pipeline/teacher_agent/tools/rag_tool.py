import warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

import asyncio

from google.adk.tools import FunctionTool
from vertexai import rag
import vertexai


import os
import dotenv

dotenv.load_dotenv("./teacher_agent/.env")


# RAG corpus + embeddings are regional; Gemini may use a different location
# (GOOGLE_CLOUD_LOCATION, e.g. "global"), so allow RAG_LOCATION to override.
LOCATION = os.environ.get("RAG_LOCATION") or os.environ["GOOGLE_CLOUD_LOCATION"]
PROJECT_ID = os.environ["GOOGLE_CLOUD_PROJECT"]
RAG_CORPUS_URI = os.environ["GOOGLE_RAG_CORPUS"]

vertexai.init(project=PROJECT_ID, location=LOCATION)

RETRIEVAL_CONFIG = rag.RagRetrievalConfig(
    top_k=10,
    filter=rag.Filter(vector_distance_threshold=0.6),
)


async def retrieve_rag_study_resources(query: str) -> dict:
    """Use this tool to retrieve study resources and reference materials for the question from the RAG corpus.

    Args:
        query: The student's question or topic to look up in the course textbook.
    """
    # Retrieval runs here (in RAG_LOCATION) instead of as Gemini's built-in
    # retrieval tool, because the global Gemini endpoint can't read a regional corpus.
    response = await asyncio.to_thread(
        rag.retrieval_query,
        text=query,
        rag_resources=[rag.RagResource(rag_corpus=RAG_CORPUS_URI)],
        rag_retrieval_config=RETRIEVAL_CONFIG,
    )
    contexts = [
        {"source": c.source_display_name, "text": c.text}
        for c in response.contexts.contexts
    ]
    if not contexts:
        return {"result": f"No course material found for: {query}"}
    return {"contexts": contexts}


rag_tool = FunctionTool(retrieve_rag_study_resources)
