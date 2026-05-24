"""
Media Route — Servidor e Proxy de Mídias Locais do Fluvius

Garante que o frontend nunca bata nas URLs do WhatsApp diretamente.
Suporta downloads on-demand resilientes e Range Requests nativos para players de áudio/vídeo.
"""
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
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


async def fetch_and_download_avatar_task(
    contact_id: str,
    base_url: str,
    api_key: str,
    instance_name: str,
    phone: str
):
    """Obtém a URL externa do avatar na API em background e faz o download da imagem."""
    try:
        avatar_url = await EvolutionService.fetch_profile_picture_url(
            base_url=base_url,
            api_key=api_key,
            instance_name=instance_name,
            number=phone
        )
        if avatar_url:
            from app.core.database import SessionLocal
            with SessionLocal() as temp_db:
                temp_contact = temp_db.query(Contact).filter(Contact.id == contact_id).first()
                if temp_contact:
                    temp_contact.avatar_url = avatar_url
                    temp_db.commit()
            
            # Executa o download da imagem do avatar localmente
            await MediaDownloadService.download_contact_avatar(None, contact_id)
        else:
            # Registra no cache negativo para evitar consultas imediatas
            no_avatar_path = Path(f"uploads/avatars/{contact_id}.no_avatar")
            try:
                no_avatar_path.parent.mkdir(parents=True, exist_ok=True)
                no_avatar_path.touch()
            except Exception:
                pass
    except Exception as e:
        logger.error(f"[AvatarBackground] Erro ao obter/baixar avatar para {contact_id}: {e}")
        no_avatar_path = Path(f"uploads/avatars/{contact_id}.no_avatar")
        try:
            no_avatar_path.parent.mkdir(parents=True, exist_ok=True)
            no_avatar_path.touch()
        except Exception:
            pass


@router.get("/avatar/{contact_id}")
async def get_contact_avatar(
    contact_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Retorna o avatar local do contato. Se já estiver baixado, serve diretamente.
    Se o contato tem um avatar_url externo (HTTP) no banco, inicia o download em background
    e redireciona temporariamente para a URL externa para exibição imediata.
    Caso contrário, agenda a busca na Evolution API e download em background.
    """
    local_path = Path(f"uploads/avatars/{contact_id}.jpg")
    
    if local_path.exists():
        return FileResponse(str(local_path), media_type="image/jpeg")

    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contato não encontrado")

    # Redireciona para o avatar externo (se disponível no banco) e inicia download local em background
    if contact.avatar_url and contact.avatar_url.startswith("http"):
        background_tasks.add_task(MediaDownloadService.download_contact_avatar, None, contact_id)
        return RedirectResponse(contact.avatar_url)

    # Cache negativo: evita bater na API caso já tenhamos tentado recentemente e falhado
    no_avatar_path = Path(f"uploads/avatars/{contact_id}.no_avatar")
    if no_avatar_path.exists():
        mtime = no_avatar_path.stat().st_mtime
        import time
        if time.time() - mtime < 3600:  # Cache negativo de 1 hora
            raise HTTPException(status_code=404, detail="Avatar não disponível (cached)")

    # Se não existe localmente nem no cache negativo, vamos buscar na Evolution API em background
    conversation = db.query(Conversation).filter(Conversation.contact_id == contact.id).first()
    if conversation:
        inbox = db.query(Inbox).filter(Inbox.id == conversation.inbox_id).first()
        if inbox:
            connection = db.query(Connection).filter(Connection.inbox_id == inbox.id).first()
            if connection:
                base_url = connection.base_url
                api_key = connection.api_key
                instance_name = connection.instance_name
                phone = contact.phone

                # Dispara a busca e download em background
                background_tasks.add_task(
                    fetch_and_download_avatar_task,
                    contact_id=contact_id,
                    base_url=base_url,
                    api_key=api_key,
                    instance_name=instance_name,
                    phone=phone
                )

    return JSONResponse(
        status_code=404,
        content={"detail": "Avatar carregando em segundo plano"}
    )


from app.models.message import Message

@router.get("/{media_id}")
async def get_media_file(
    media_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Serve a mídia cadastrada. Se o arquivo ainda não foi baixado,
    dispara o download em background e retorna 202 imediatamente.
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

    # Negative cache em disco: se já tentamos e falhamos, retorna 410 Gone imediatamente
    # sem bater na Evolution API novamente (URLs do WhatsApp expiram em ~72h)
    import time
    no_media_path = Path(f"uploads/.no_media_{media_id}")
    if no_media_path.exists():
        mtime = no_media_path.stat().st_mtime
        # Cache negativo de 6 horas — depois tenta novamente caso a URL tenha sido renovada
        if time.time() - mtime < 21600:
            raise HTTPException(status_code=410, detail="Mídia expirada ou indisponível")
        else:
            # Expirou o cache negativo, remove e tenta novamente
            try:
                no_media_path.unlink()
            except Exception:
                pass

    # Se já está marcado como failed no banco, cria o cache negativo e retorna 410
    if media.failed:
        try:
            Path("uploads").mkdir(parents=True, exist_ok=True)
            no_media_path.touch()
        except Exception:
            pass
        raise HTTPException(status_code=410, detail="Mídia expirada ou indisponível")

    # Se o download ainda não foi feito, dispara o download em background e retorna 202
    if media.message_id:
        message_id = media.message_id
        media_uuid = media.id
        
        # Inicia a tarefa em background sem bloquear o pool de conexões HTTP do FastAPI
        background_tasks.add_task(MediaDownloadService.download_message_media, None, message_id)
        
        return JSONResponse(
            status_code=202,
            content={"status": "processing", "message": "Mídia está sendo baixada do WhatsApp"}
        )

    raise HTTPException(
        status_code=410,
        detail="Mídia expirada ou indisponível (URL do WhatsApp expirou)"
    )
