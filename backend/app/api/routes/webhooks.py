"""
Webhook Route — Evolution API

Recebe eventos da Evolution API e os processa em background.

Segurança:
  - Suporta validação por token query param (método legado).
  - Suporta validação por assinatura HMAC-SHA256 via header 'x-evolution-signature'
    quando EVOLUTION_WEBHOOK_SECRET estiver configurado no .env.
"""

import hmac
import hashlib
import logging

from fastapi import APIRouter, Request, BackgroundTasks, Query, HTTPException, status
from typing import Optional

from app.core.database import SessionLocal
from app.services.webhook_service import WebhookService
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks/evolution/{connection_id}", tags=["webhooks"])


def _verify_hmac_signature(body: bytes, signature: str, secret: str) -> bool:
    """
    Valida assinatura HMAC-SHA256.

    A Evolution API envia o header 'x-evolution-signature' com o formato:
        sha256=<hex_digest>
    """
    try:
        prefix, received_digest = signature.split("=", 1)
        if prefix != "sha256":
            return False
        expected_digest = hmac.new(
            secret.encode("utf-8"), body, hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected_digest, received_digest)
    except Exception:
        return False


async def background_process_webhook(connection_id: str, payload: dict):
    with SessionLocal() as db:
        try:
            await WebhookService.process_webhook(db, connection_id, payload)
        except Exception as e:
            logger.error(
                f"Background webhook error for connection {connection_id}: {e}"
            )


@router.post("")
async def receive_webhook(
    connection_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    token: Optional[str] = Query(None),
):
    if settings.EVOLUTION_WEBHOOK_SECRET:
        secret = settings.EVOLUTION_WEBHOOK_SECRET

        # Método 1: HMAC-SHA256 via header (preferido)
        hmac_sig = request.headers.get("x-evolution-signature") or request.headers.get(
            "x-hub-signature-256"
        )

        if hmac_sig:
            body = await request.body()
            if not _verify_hmac_signature(body, hmac_sig, secret):
                logger.warning(
                    f"Webhook rejeitado (assinatura HMAC inválida) para connection {connection_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Assinatura HMAC inválida",
                )
        else:
            # Método 2: Token via query param (legado)
            if not token or token != secret:
                logger.warning(
                    f"Webhook rejeitado (token inválido) para connection {connection_id}"
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token de autorização inválido ou ausente",
                )

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    background_tasks.add_task(background_process_webhook, connection_id, payload)
    return {"status": "received"}
