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

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from .agent import root_agent

app = FastAPI(title="DeltaEd Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health check endpoint for Cloud Run ───────────────────────────────────
@app.get("/")
async def root():
    return {"status": "ok", "service": "deltaed-agent"}

@app.get("/health")
async def health():
    return {"status": "ok", "service": "deltaed-agent"}

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

    # ── Preprocess nested get_dashboard response into flat initial_state ──────
    # get_dashboard (main.py) returns:
    #   { student_id, student_name, subject_id, subject_name,
    #     scores:   { overall: { till_date_avg, growth_delta, growth_percentile, ... },
    #                 by_chapter: [ { chapter_id, chapter_name, till_date_avg, growth_delta, ... } ] },
    #     progress: { overall: { till_date_progress, growth_delta, ... },
    #                 by_chapter: [ { chapter_id, chapter_name, till_date_progress, growth_delta, ... } ] } }
    #
    # We flatten this into the format required by initial_state (and the agent).

    overall_scores   = ctx.get("scores",   {}).get("overall", {})
    overall_progress = ctx.get("progress", {}).get("overall", {})

    # Build indexed map of progress rows so we can merge by chapter_id
    prog_by_chapter: dict = {
        r["chapter_id"]: r
        for r in ctx.get("progress", {}).get("by_chapter", [])
        if "chapter_id" in r
    }

    # If a pre-flattened "chapters" list was already supplied (e.g. during testing),
    # use it as-is; otherwise merge scores.by_chapter + progress.by_chapter.
    chapters_payload = ctx.get("chapters") or []
    if not chapters_payload:
        for sc in ctx.get("scores", {}).get("by_chapter", []):
            cid = sc.get("chapter_id")
            pc  = prog_by_chapter.get(cid, {})
            chapters_payload.append({
                "chapter_id":           cid,
                "chapter_name":         sc.get("chapter_name"),
                "score_till_date_avg":  sc.get("till_date_avg")        if sc.get("till_date_avg")        is not None else 0.0,
                "score_growth_delta":   sc.get("growth_delta")         if sc.get("growth_delta")         is not None else 0.0,
                "progress_till_date":   pc.get("till_date_progress")   if pc.get("till_date_progress")   is not None else 0.0,
                "progress_growth_delta": pc.get("growth_delta")        if pc.get("growth_delta")         is not None else 0.0,
            })

    def _f(v, fallback=0.0):
        """Return v if not None, else fallback."""
        return v if v is not None else fallback

    initial_state = {
        "student_id":                   ctx.get("student_id",   ""),
        "student_name":                 ctx.get("student_name", ""),
        "subject_id":                   ctx.get("subject_id",   ""),
        "subject_name":                 "Natural Language Processing & Speech",
        # overall score metrics — check flat keys first, then nested scores.overall
        "overall_till_date_avg":        _f(ctx.get("overall_till_date_avg",        overall_scores.get("till_date_avg"))),
        "overall_growth_delta":         _f(ctx.get("overall_growth_delta",         overall_scores.get("growth_delta"))),
        "overall_growth_percentile":    _f(ctx.get("overall_growth_percentile",    overall_scores.get("growth_percentile")), fallback=0),
        # overall progress metrics — check flat keys first, then nested progress.overall
        "overall_till_date_progress":   _f(ctx.get("overall_till_date_progress",   overall_progress.get("till_date_progress"))),
        "overall_progress_growth_delta": _f(ctx.get("overall_progress_growth_delta", overall_progress.get("growth_delta"))),
        "chapters":                     chapters_payload,
        "selected_chapter_id":          None,
        "selected_chapter_name":        None,
        "vocab_embeddings":             [],
        "active_agent":                 "",
    }

    logger.info("Initializing Agent Session with State: %s", json.dumps(initial_state, indent=2))

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
                    opening_message += str(part.text)

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
