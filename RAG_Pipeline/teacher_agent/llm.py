"""Shared Gemini model configuration for every agent."""
from google.adk.models import Gemini
from google.genai import types

MODEL_NAME = "gemini-3.5-flash"

# Vertex AI's shared Gemini capacity sometimes answers 429 RESOURCE_EXHAUSTED
# under load; retry those (and 408/5xx, the SDK defaults) with exponential
# backoff instead of failing the student's turn.
RETRY_OPTIONS = types.HttpRetryOptions(attempts=5, initial_delay=1.0, max_delay=16.0, exp_base=2.0)


def gemini() -> Gemini:
    return Gemini(model=MODEL_NAME, retry_options=RETRY_OPTIONS)
