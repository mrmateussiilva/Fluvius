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

    # Cache negativo: evita bater na API caso já tenhamos tentado recentemente e falhado
    no_avatar_path = Path(f"uploads/avatars/{contact_id}.no_avatar")
    if no_avatar_path.exists():
        mtime = no_avatar_path.stat().st_mtime
        import time
        if time.time() - mtime < 3600:  # Cache negativo de 1 hora
            raise HTTPException(status_code=404, detail="Avatar não disponível (cached)")

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
                # Extraímos as variáveis antes de fechar a sessão para evitar lazy loading errors
                base_url = connection.base_url
                api_key = connection.api_key
                instance_name = connection.instance_name
                phone = contact.phone

                # LIBERA A CONEXÃO COM O BANCO DE DADOS AGORA (antes da chamada de rede lenta)
                db.close()

                # Tenta buscar a URL externa atual na Evolution API (pode demorar ou dar timeout)
                avatar_url = await EvolutionService.fetch_profile_picture_url(
                    base_url=base_url,
                    api_key=api_key,
                    instance_name=instance_name,
                    number=phone
                )
                if avatar_url:
                    # Usamos uma sessão curta local apenas para gravar a nova url
                    from app.core.database import SessionLocal
                    with SessionLocal() as temp_db:
                        temp_contact = temp_db.query(Contact).filter(Contact.id == contact_id).first()
                        if temp_contact:
                            temp_contact.avatar_url = avatar_url
                            temp_db.commit()
                    
                    # Baixa síncrono on-demand (passando None para que use uma SessionLocal isolada internamente)
                    await MediaDownloadService.download_contact_avatar(None, contact_id)
                    if local_path.exists():
                        # Limpa qualquer marcador de cache negativo se agora deu certo
                        try:
                            if no_avatar_path.exists():
                                no_avatar_path.unlink()
                        except Exception:
                            pass
                        return FileResponse(str(local_path), media_type="image/jpeg")

    # Se falhou e não temos o arquivo local, criamos o marcador de cache negativo
    if not local_path.exists():
        try:
            no_avatar_path.parent.mkdir(parents=True, exist_ok=True)
            no_avatar_path.touch()
        except Exception:
            pass

    # Fallback se não encontrar avatar: retorna 404
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
        message_id = media.message_id
        media_uuid = media.id
        
        # LIBERA A CONEXÃO COM O BANCO DE DADOS AGORA (antes do download lento via rede)
        db.close()

        logger.info(f"[MediaRouter] Baixando mídia {media_uuid} on-demand para mensagem {message_id}")
        await MediaDownloadService.download_message_media(None, message_id)
        
        # Abre uma sessão curta apenas para ler o novo file_path e servir o arquivo
        from app.core.database import SessionLocal
        with SessionLocal() as temp_db:
            temp_media = temp_db.query(Media).filter(Media.id == media_uuid).first()
            if temp_media and temp_media.downloaded and temp_media.file_path:
                local_path = Path(temp_media.file_path.lstrip("/"))
                if local_path.exists():
                    mime = temp_media.mime_type or "application/octet-stream"
                    return FileResponse(str(local_path), media_type=mime)

    raise HTTPException(
        status_code=502,
        detail="Mídia indisponível (não foi possível baixar do WhatsApp/Evolution API)"
    )
