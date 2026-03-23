"""
server.py — FastAPI + AG-UI SSE endpoint for LearningOrchestrator

Endpoints:
  POST /agent/init  { student_context }  → { session_id, opening_message }
  POST /agent/run   { session_id, student_id, message, chip_selected }  → SSE stream
"""

import uuid
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")
import json
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types as genai_types

from .agent import root_agent

app = FastAPI(title="DeltaEd Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── ADK session service ───────────────────────────────────────────────────
session_service = InMemorySessionService()
APP_NAME = "deltaedu"

# ── Request models ────────────────────────────────────────────────────────

class InitRequest(BaseModel):
    student_context: dict

class RunRequest(BaseModel):
    session_id:    str
    student_id:    str
    message:       str
    chip_selected: Optional[str] = None

# ── /agent/init ───────────────────────────────────────────────────────────

@app.post("/agent/init")
async def agent_init(req: InitRequest):
    session_id = str(uuid.uuid4())
    ctx = req.student_context

    # Build chapter_vocabulary from the student_context
    # Prioritize flat 'chapters' list, fall back to nested 'scores.by_chapter'
    chapters_data = ctx.get("chapters")
    if not chapters_data:
        chapters_data = ctx.get("scores", {}).get("by_chapter", [])

    chapter_vocabulary = [
        c["chapter_name"]
        for c in chapters_data
        if "chapter_name" in c
    ]

    # Pull overall metrics — prefer flat top-level keys, fall back to nested shape
    overall_scores   = ctx.get("scores",   {}).get("overall", {})
    overall_progress = ctx.get("progress", {}).get("overall", {})

    # Initial session state — flat keys for agent instruction templates +
    # normalised chapters list so ScopeGateAgent / PerformanceAgent can iterate it
    initial_state = {
        # Full payload (agents may read any field)
        "student_context": ctx,

        # Flat identity keys (used directly in {student_name} / {subject_name} templates)
        "student_id":   ctx.get("student_id",   "unknown"),
        "student_name": ctx.get("student_name", ""),
        "subject_id":   ctx.get("subject_id",   ""),
        "subject_name": ctx.get("subject_name", ""),

        # Overall score metrics
        "overall_till_date_avg":         ctx.get("overall_till_date_avg",         overall_scores.get("till_date_avg",        0.0)),
        "overall_growth_delta":          ctx.get("overall_growth_delta",          overall_scores.get("growth_delta",         0.0)),
        "overall_growth_percentile":     ctx.get("overall_growth_percentile",     overall_scores.get("growth_percentile",    0)),
        "overall_till_date_progress":    ctx.get("overall_till_date_progress",    overall_progress.get("till_date_progress", 0.0)),
        "overall_progress_growth_delta": ctx.get("overall_progress_growth_delta", overall_progress.get("progress_growth_delta", 0.0)),

        # Normalised chapters list (flat shape the agents expect)
        "chapters":           chapters_data,
        "chapter_vocabulary": chapter_vocabulary,

        # Routing placeholders (cleared after each turn by orchestrator tools)
        "selected_chapter_id":   None,
        "selected_chapter_name": None,
    }

    await session_service.create_session(
        app_name=APP_NAME,
        user_id=ctx.get("student_id", "unknown"),
        session_id=session_id,
        state=initial_state,
    )

    # Ask the orchestrator for the opening message
    runner = Runner(
        agent=root_agent,
        app_name=APP_NAME,
        session_service=session_service,
    )

    opening_message = ""
    async for event in runner.run_async(
        user_id=ctx.get("student_id", "unknown"),
        session_id=session_id,
        new_message=genai_types.Content(
            role="user",
            parts=[genai_types.Part(text="__init__")]
        ),
    ):
        if event.is_final_response() and event.content:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text:
                    opening_message += part.text

    return {"session_id": session_id, "opening_message": opening_message}


# ── /agent/run ────────────────────────────────────────────────────────────

@app.post("/agent/run")
async def agent_run(req: RunRequest):

    async def event_stream():
        # Write chip_selected into session state before running
        if req.chip_selected:
            session = await session_service.get_session(
                app_name=APP_NAME,
                user_id=req.student_id,
                session_id=req.session_id,
            )
            if session:
                session.state["chip_selected"] = req.chip_selected

        runner = Runner(
            agent=root_agent,
            app_name=APP_NAME,
            session_service=session_service,
        )

        async for event in runner.run_async(
            user_id=req.student_id,
            session_id=req.session_id,
            new_message=genai_types.Content(
                role="user",
                parts=[genai_types.Part(text=req.message)]
            ),
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        chunk = json.dumps({"text": part.text})
                        yield f"data: {chunk}\n\n"

            # Clear chip_selected after first event
            if req.chip_selected:
                session = await session_service.get_session(
                    app_name=APP_NAME,
                    user_id=req.student_id,
                    session_id=req.session_id,
                )
                if session:
                    session.state["chip_selected"] = None

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── Run ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("teacher_agent.server:app", host="0.0.0.0", port=8001, reload=True)
