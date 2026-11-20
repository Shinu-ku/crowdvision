"""Alert queries and acknowledge/resolve workflow endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.database.models import Alert, User
from app.database.session import get_db
from app.schemas.api_schemas import AlertAcknowledgeRequest, AlertResolveRequest, AlertResponse

router = APIRouter()


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    db: Annotated[AsyncSession, Depends(get_db)],
    event_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    zone_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    stmt = select(Alert).order_by(desc(Alert.created_at))
    if event_id:
        stmt = stmt.where(Alert.event_id == event_id)
    if status:
        stmt = stmt.where(Alert.status == status.upper())
    if severity:
        stmt = stmt.where(Alert.severity == severity.upper())
    if zone_id:
        stmt = stmt.where(Alert.zone_id == zone_id)
    stmt = stmt.offset(offset).limit(limit)

    alerts = (await db.execute(stmt)).scalars().all()
    return [AlertResponse.model_validate(a) for a in alerts]


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return AlertResponse.model_validate(alert)


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: str,
    payload: AlertAcknowledgeRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    if alert.status == "RESOLVED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Alert is already resolved")

    alert.status = "ACKNOWLEDGED"
    alert.acknowledged_by = current_user.email
    alert.acknowledged_at = datetime.utcnow()
    if payload.note:
        alert.resolution_note = (
            f"[Ack Note: {payload.note}] " + (alert.resolution_note or "")
        ).strip()

    await db.commit()
    await db.refresh(alert)
    return AlertResponse.model_validate(alert)


@router.post("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: str,
    payload: AlertResolveRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    alert = await db.get(Alert, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    alert.status = "RESOLVED"
    alert.resolved_by = current_user.email
    alert.resolved_at = datetime.utcnow()
    if payload.resolution_note:
        alert.resolution_note = payload.resolution_note

    await db.commit()
    await db.refresh(alert)
    return AlertResponse.model_validate(alert)
