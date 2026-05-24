"""
Media proxy route — descriptografa mídias do WhatsApp on-demand via Evolution API.

Fluxo:
  1. Frontend chama GET /api/media/proxy?message_id=<message_uuid>
  2. Backend busca a mensagem no banco e a conexão associada
  3. Chama Evolution API /chat/getBase64FromMediaMessage para descriptografar
  4. Salva o arquivo localmente em /uploads e atualiza media_url da mensagem
  5. Serve o arquivo como streaming response
"""
import base64
import logging
import mimetypes
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.auth import get_current_agent
from app.models.message import Message
from app.models.conversation import Conversation
from app.models.connection import Connection
from app.models.inbox import Inbox
from app.services.evolution_service import EvolutionService
from app.utils.media import save_base64_to_disk

logger = logging.getLogger(__name__)

router = APIRouter()

UPLOADS_DIR = Path("/uploads")


@router.get("/media/proxy")
async def proxy_media(
    message_id: str = Query(..., description="UUID da mensagem no banco Fluvius"),
    db: Session = Depends(get_db),
    current_agent=Depends(get_current_agent),
):
    """
    Descriptografa e serve mídia de um áudio (ou qualquer mídia) do WhatsApp.
    Se a media_url já for um arquivo local, serve diretamente.
    Caso contrário, aciona a Evolution API para descriptografar e salva localmente.
    """
    # 1. Buscar mensagem no banco
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")

    # 2. Se a media_url já é um arquivo local válido, servir direto
    if message.media_url and not message.media_url.startswith("http"):
        local_path_str = message.media_url.lstrip("/")
        local_path = Path("/") / local_path_str
        if local_path.exists():
            mime = message.mime_type or "application/octet-stream"
            return FileResponse(str(local_path), media_type=mime)

    # 3. Precisamos descriptografar via Evolution API
    if not message.external_message_id:
        raise HTTPException(status_code=422, detail="Mensagem sem ID externo — não é possível descriptografar")

    # Buscar conexão da conversa
    conversation = db.query(Conversation).filter(Conversation.id == message.conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")

    inbox = db.query(Inbox).filter(Inbox.id == conversation.inbox_id).first()
    if not inbox:
        raise HTTPException(status_code=404, detail="Inbox não encontrada")

    connection = db.query(Connection).filter(Connection.inbox_id == inbox.id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Conexão WhatsApp não encontrada")

    # 4. Chamar Evolution API para descriptografar
    # O campo `message` que a Evolution precisa é o payload original da mensagem WhatsApp
    raw_payload = message.raw_payload or {}
    wa_message = (
        raw_payload.get("data", {}).get("message")
        or raw_payload.get("message")
    )

    if not wa_message:
        raise HTTPException(
            status_code=422,
            detail="Payload original da mensagem não disponível para descriptografia"
        )

    logger.info(f"[MediaProxy] Descriptografando mensagem {message.id} via Evolution API")

    base64_data = await EvolutionService.get_base64_from_media_message(
        base_url=connection.base_url,
        api_key=connection.api_key,
        instance_name=connection.instance_name,
        message={"message": wa_message},
    )

    if not base64_data:
        raise HTTPException(
            status_code=502,
            detail="Evolution API não conseguiu descriptografar a mídia (pode ter expirado)"
        )

    # 5. Salvar localmente e atualizar media_url
    mime_type = message.mime_type or "audio/ogg"
    try:
        local_url = save_base64_to_disk(base64_data, mime_type)
        message.media_url = local_url
        db.commit()
        logger.info(f"[MediaProxy] Mídia salva em {local_url} para mensagem {message.id}")
    except Exception as e:
        logger.error(f"[MediaProxy] Falha ao salvar mídia: {e}")
        # Serve diretamente da memória se falhar ao salvar
        audio_bytes = base64.b64decode(base64_data)
        return StreamingResponse(
            iter([audio_bytes]),
            media_type=mime_type,
            headers={"Content-Length": str(len(audio_bytes))}
        )

    # 6. Servir o arquivo recém-salvo
    local_path_str = local_url.lstrip("/")
    local_path = Path("/") / local_path_str
    if local_path.exists():
        return FileResponse(str(local_path), media_type=mime_type)

    raise HTTPException(status_code=500, detail="Arquivo salvo mas não encontrado no disco")
