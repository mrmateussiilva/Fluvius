from fastapi import APIRouter, Request, BackgroundTasks, Query, HTTPException, status
from app.core.database import SessionLocal
from app.services.webhook_service import WebhookService
from app.core.config import settings
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/evolution/{connection_id}", tags=["webhooks"])

async def background_process_webhook(connection_id: str, payload: dict):
    with SessionLocal() as db:
        try:
            await WebhookService.process_webhook(db, connection_id, payload)
        except Exception as e:
            logger.error(f"Background webhook error for connection {connection_id}: {e}")

@router.post("")
async def receive_webhook(
    connection_id: str, 
    request: Request, 
    background_tasks: BackgroundTasks,
    token: Optional[str] = Query(None)
):
    # Validate secret webhook token if configured
    if settings.EVOLUTION_WEBHOOK_SECRET:
        if not token or token != settings.EVOLUTION_WEBHOOK_SECRET:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing webhook authorization token"
            )

    try:
        payload = await request.json()
    except Exception:
        payload = {}
        
    background_tasks.add_task(background_process_webhook, connection_id, payload)
    return {"status": "received"}
