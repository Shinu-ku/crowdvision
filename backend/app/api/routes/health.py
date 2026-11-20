"""Health check endpoint probing DB, AI Agent, and detector status."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.integrations.agent_client import AIAgentClient
from app.schemas.api_schemas import HealthResponse
from app.services.video_processor import get_shared_detector
from app.services.ws_manager import ws_manager

router = APIRouter()
agent_client = AIAgentClient()


@router.get("", response_model=HealthResponse)
@router.get("/", response_model=HealthResponse, include_in_schema=False)
@router.get("/health", response_model=HealthResponse, include_in_schema=False)
async def health_check(db: Annotated[AsyncSession, Depends(get_db)]):
    db_status = "healthy"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"unhealthy: {exc}"

    agent_status = "disabled"
    try:
        agent_health = await agent_client.get_health()
        agent_status = agent_health.get("status", "unreachable")
    except Exception:
        agent_status = "unreachable"

    detector = get_shared_detector()

    return HealthResponse(
        status="healthy" if db_status == "healthy" else "degraded",
        database=db_status,
        ai_agent=agent_status,
        detector_backend=detector.backend_name,
        active_ws_connections=ws_manager.connection_count(),
        timestamp=datetime.utcnow(),
    )
