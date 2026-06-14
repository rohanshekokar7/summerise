"""
FastAPI backend for the AI Research Assistant.
Streams research progress and follow-up Q&A via Server-Sent Events.
"""

import asyncio
import json
import os
import sys
import threading
from pathlib import Path
from typing import Optional

# Allow importing research_assistant from the same package folder
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from research_assistant import ResearchAssistant

app = FastAPI(title="AI Research Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Single global assistant instance (single-user dev tool)
assistant: Optional[ResearchAssistant] = None
_busy = False


def get_assistant() -> ResearchAssistant:
    global assistant
    if assistant is None:
        assistant = ResearchAssistant()
    return assistant


# ------------------------------------------------------------------
# Request / Response models
# ------------------------------------------------------------------

class ResearchRequest(BaseModel):
    query: str
    max_articles: int = 5


class FollowupRequest(BaseModel):
    question: str


# ------------------------------------------------------------------
# SSE helper
# ------------------------------------------------------------------

def make_sse_stream(run_fn):
    """
    Run `run_fn(on_event)` in a background thread.
    Yields SSE-formatted lines from emitted events.
    """
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def on_event(event: dict):
        asyncio.run_coroutine_threadsafe(queue.put(event), loop)

    def worker():
        try:
            run_fn(on_event)
        except Exception as exc:
            asyncio.run_coroutine_threadsafe(
                queue.put({"type": "error", "message": str(exc)}), loop
            )
        finally:
            asyncio.run_coroutine_threadsafe(
                queue.put({"type": "done"}), loop
            )

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

    async def generate():
        global _busy
        _busy = True
        try:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
                if event["type"] in ("done", "error"):
                    break
        finally:
            _busy = False

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ------------------------------------------------------------------
# API routes
# ------------------------------------------------------------------

@app.get("/api/status")
async def status():
    a = get_assistant()
    return {
        "busy": _busy,
        "has_research": a.current_research is not None,
        "query": a.current_research.query if a.current_research else None,
        "source_count": len(a.current_research.search_results) if a.current_research else 0,
    }


@app.post("/api/research")
async def research(request: ResearchRequest):
    if _busy:
        raise HTTPException(status_code=409, detail="Research already in progress.")
    a = get_assistant()

    def run(on_event):
        a.research(request.query, request.max_articles, on_event=on_event)

    return make_sse_stream(run)


@app.post("/api/followup")
async def followup(request: FollowupRequest):
    if _busy:
        raise HTTPException(status_code=409, detail="Research in progress, please wait.")
    a = get_assistant()
    if not a.current_research:
        raise HTTPException(status_code=400, detail="No research session. Run /api/research first.")

    def run(on_event):
        a.answer_followup(request.question, on_event=on_event)

    return make_sse_stream(run)


@app.get("/api/sources")
async def sources():
    a = get_assistant()
    if not a.current_research:
        return {"sources": []}
    return {
        "query": a.current_research.query,
        "sources": [
            {"title": r.title, "url": r.url, "snippet": r.snippet}
            for r in a.current_research.search_results
        ],
    }


@app.get("/api/report")
async def report():
    a = get_assistant()
    if not a.current_research or not a.current_research.report:
        raise HTTPException(status_code=404, detail="No report available.")
    return {
        "query": a.current_research.query,
        "report": a.current_research.report,
        "summary": a.current_research.summary,
    }


@app.get("/api/report/download")
async def download_report():
    a = get_assistant()
    if not a.current_research or not a.current_research.report:
        raise HTTPException(status_code=404, detail="No report available.")
    filename = f"report_{a.current_research.query[:30].replace(' ', '_')}.md"
    content = f"# Research Report: {a.current_research.query}\n\n{a.current_research.report}"
    return Response(
        content=content.encode("utf-8"),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ------------------------------------------------------------------
# Serve React build in production
# ------------------------------------------------------------------

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="static")
