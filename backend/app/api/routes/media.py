"""
Media Route — Servidor e Proxy de Mídias Locais do Fluvius

Garante que o frontend nunca bata nas URLs do WhatsApp diretamente.
Suporta downloads on-demand resilientes e Range Requests nativos para players de áudio/vídeo.
"""
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.media import Media
from app.models.contact import Contact
from app.models.connection import Connection
from app.models.conversation import Conversation
from app.models.inbox import Inbox
from app.services.media_service import MediaDownloadService
from app.services.evolution_service import EvolutionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/media", tags=["media"])


@router.get("/avatar/{contact_id}")
async def get_contact_avatar(
    contact_id: str,
    db: Session = Depends(get_db)
):
    """
    Retorna o avatar local do contato. Se não estiver baixado, tenta buscar
    na Evolution API, baixa on-demand e serve.
    """
    local_path = Path(f"uploads/avatars/{contact_id}.jpg")
    
    if local_path.exists():
        return FileResponse(str(local_path), media_type="image/jpeg")

    # Se não existe localmente, vamos obter da Evolution API on-demand
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contato não encontrado")

    # Buscar conexão WhatsApp ativa para a inbox
    conversation = db.query(Conversation).filter(Conversation.contact_id == contact.id).first()
    if conversation:
        inbox = db.query(Inbox).filter(Inbox.id == conversation.inbox_id).first()
        if inbox:
            connection = db.query(Connection).filter(Connection.inbox_id == inbox.id).first()
            if connection:
                # Tenta buscar a URL externa atual na Evolution API
                avatar_url = await EvolutionService.fetch_profile_picture_url(
                    base_url=connection.base_url,
                    api_key=connection.api_key,
                    instance_name=connection.instance_name,
                    number=contact.phone
                )
                if avatar_url:
                    contact.avatar_url = avatar_url
                    db.commit()
                    
                    # Baixa síncrono on-demand
                    await MediaDownloadService.download_contact_avatar(db, contact_id)
                    if local_path.exists():
                        return FileResponse(str(local_path), media_type="image/jpeg")

    # Fallback se não encontrar avatar: retorna 404 ou uma imagem default/placeholder
    raise HTTPException(status_code=404, detail="Avatar não disponível")


from app.models.message import Message

@router.get("/{media_id}")
async def get_media_file(
    media_id: str,
    db: Session = Depends(get_db)
):
    """
    Serve a mídia cadastrada. Se o arquivo ainda não foi baixado
    (ex: download em background falhou ou pego na sync), executa o download on-demand.
    """
    # Tenta buscar por ID da mídia ou por ID da mensagem
    media = db.query(Media).filter((Media.id == media_id) | (Media.message_id == media_id)).first()
    
    if not media:
        # Mecanismo de Auto-Cura: se for uma mensagem com mídia antiga sem registro Media no banco
        message = db.query(Message).filter(Message.id == media_id).first()
        if message and message.message_type in ["image", "audio", "video", "document"]:
            from app.models.workspace import generate_uuid
            media = Media(
                id=generate_uuid(),
                message_id=message.id,
                media_type=message.message_type,
                mime_type=message.mime_type,
                downloaded=False,
                failed=False
            )
            db.add(media)
            db.commit()
            db.refresh(media)

    if not media:
        raise HTTPException(status_code=404, detail="Mídia não encontrada")

    # Se o download está marcado como concluído, servimos diretamente
    if media.downloaded and media.file_path:
        local_path = Path(media.file_path.lstrip("/"))
        if local_path.exists():
            mime = media.mime_type or "application/octet-stream"
            return FileResponse(str(local_path), media_type=mime)

    # Se o download ainda não foi feito ou falhou, tenta baixar de forma síncrona on-demand
    if media.message_id:
        logger.info(f"[MediaRouter] Baixando mídia {media.id} on-demand para mensagem {media.message_id}")
        await MediaDownloadService.download_message_media(db, media.message_id)
        
        # Recarrega a mídia
        db.refresh(media)
        if media.downloaded and media.file_path:
            local_path = Path(media.file_path.lstrip("/"))
            if local_path.exists():
                mime = media.mime_type or "application/octet-stream"
                return FileResponse(str(local_path), media_type=mime)

    raise HTTPException(
        status_code=502,
        detail="Mídia indisponível (não foi possível baixar do WhatsApp/Evolution API)"
    )
