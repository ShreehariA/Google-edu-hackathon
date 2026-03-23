from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmResponse, LlmRequest
from google.genai import types
from typing import Optional


def suppress_orchestrator_text(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    """
    After the Orchestrator LLM responds, check if it is doing a tool call
    or transfer. If so, strip any text parts from the response so the
    student never sees narration like "Excellent choice! Let's get started..."
    before the transfer happens.
    """
    if not llm_response.content or not llm_response.content.parts:
        return None

    has_function_call = any(
        hasattr(part, "function_call") and part.function_call is not None
        for part in llm_response.content.parts
    )

    if not has_function_call:
        # no tool call or transfer — let the response through unchanged
        return None

    # strip text parts, keep only function call parts
    clean_parts = [
        part for part in llm_response.content.parts
        if not (hasattr(part, "text") and part.text)
    ]

    if not clean_parts:
        return None

    return LlmResponse(
        content=types.Content(
            role=llm_response.content.role,
            parts=clean_parts,
        )
    )