from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.webhook_service import WebhookService

router = APIRouter(prefix="/webhooks/evolution/{connection_id}", tags=["webhooks"])

@router.post("")
async def receive_webhook(connection_id: str, request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
        
    await WebhookService.process_webhook(db, connection_id, payload)
    return {"status": "received"}
