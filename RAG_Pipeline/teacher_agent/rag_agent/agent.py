
import warnings
warnings.simplefilter(action='ignore', category=FutureWarning)

from google.adk.agents import Agent
from google.adk.tools.retrieval.vertex_ai_rag_retrieval import VertexAiRagRetrieval
from vertexai import rag


import os




LOCATION = os.environ["GOOGLE_CLOUD_LOCATION"]
PROJECT_ID = os.environ["GOOGLE_CLOUD_PROJECT"]
RAG_CORPUS_URI = os.environ["GOOGLE_RAG_CORPUS"]



# Configure Vertex RAG

rag_retrieval_tool = VertexAiRagRetrieval(
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

# Create RAG Agent

rag_agent = Agent(
    model='gemini-2.5-flash',
    name='ask_rag_agent',
    instruction= "You are an AI Agent designed to clarify doubts specifically from the RAG using the rag_retrieval_tool. Do not answer any questions outside the scope of the RAG. ",
    tools=[
        rag_retrieval_tool,
    ]
)






