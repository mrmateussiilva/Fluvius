"""
Media Route — Servidor e Proxy de Mídias Locais do Fluvius

Garante que o frontend nunca bata nas URLs do WhatsApp diretamente.
Suporta downloads on-demand resilientes e Range Requests nativos para players de áudio/vídeo.
"""
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
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


AVATAR_CACHE_HEADERS = {
    "Cache-Control": "public, max-age=3600",
}
MISSING_AVATAR_HEADERS = {
    "Cache-Control": "public, max-age=900",
}
MISSING_MEDIA_HEADERS = {
    "Cache-Control": "public, max-age=21600",
}


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
        return FileResponse(
            str(local_path),
            media_type="image/jpeg",
            headers=AVATAR_CACHE_HEADERS,
        )

    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        return JSONResponse(
            status_code=404,
            content={"detail": "Contato não encontrado"},
            headers=MISSING_AVATAR_HEADERS,
        )

    # Redireciona para o avatar externo se disponível. O download local deve ser
    # feito pelo sync/webhook, não por uma enxurrada de requests de imagem do browser.
    if contact.avatar_url and contact.avatar_url.startswith("http"):
        return RedirectResponse(contact.avatar_url, headers=AVATAR_CACHE_HEADERS)

    # Cache negativo: evita bater na API caso já tenhamos tentado recentemente e falhado
    no_avatar_path = Path(f"uploads/avatars/{contact_id}.no_avatar")
    if no_avatar_path.exists():
        mtime = no_avatar_path.stat().st_mtime
        import time
        if time.time() - mtime < 3600:  # Cache negativo de 1 hora
            return JSONResponse(
                status_code=404,
                content={"detail": "Avatar não disponível"},
                headers=MISSING_AVATAR_HEADERS,
            )

    return JSONResponse(
        status_code=404,
        content={"detail": "Avatar não disponível"},
        headers=MISSING_AVATAR_HEADERS,
    )


from app.models.message import Message


def _get_media_by_id_or_message(db: Session, media_id: str) -> Media | None:
    return db.query(Media).filter((Media.id == media_id) | (Media.message_id == media_id)).first()


def _media_local_path(media: Media) -> Path | None:
    if not media.downloaded or not media.file_path:
        return None
    local_path = Path(media.file_path.lstrip("/"))
    return local_path if local_path.exists() else None


def _has_fresh_negative_media_cache(media_id: str) -> bool:
    import time

    no_media_path = Path(f"uploads/.no_media_{media_id}")
    if not no_media_path.exists():
        return False
    if time.time() - no_media_path.stat().st_mtime < 21600:
        return True
    try:
        no_media_path.unlink()
    except Exception:
        pass
    return False


@router.head("/{media_id}")
async def head_media_file(
    media_id: str,
    db: Session = Depends(get_db)
):
    """
    Preflight leve para players de áudio/vídeo. Nunca dispara download em
    background, para não transformar HEAD em trabalho pesado.
    """
    media = _get_media_by_id_or_message(db, media_id)
    if not media:
        return Response(status_code=404, headers={"Cache-Control": "no-store"})

    local_path = _media_local_path(media)
    if local_path:
        headers = {
            "Content-Type": media.mime_type or "application/octet-stream",
            "Content-Length": str(local_path.stat().st_size),
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=86400",
        }
        return Response(status_code=200, headers=headers)

    if media.failed or _has_fresh_negative_media_cache(media_id):
        return Response(status_code=410, headers=MISSING_MEDIA_HEADERS)

    return Response(status_code=202, headers={"Cache-Control": "no-store"})

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
    media = _get_media_by_id_or_message(db, media_id)
    
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
    local_path = _media_local_path(media)
    if local_path:
        mime = media.mime_type or "application/octet-stream"
        return FileResponse(
            str(local_path),
            media_type=mime,
            headers={"Cache-Control": "public, max-age=86400"},
        )

    # Negative cache em disco: se já tentamos e falhamos, retorna 410 Gone imediatamente
    # sem bater na Evolution API novamente (URLs do WhatsApp expiram em ~72h)
    no_media_path = Path(f"uploads/.no_media_{media_id}")
    if _has_fresh_negative_media_cache(media_id):
        return JSONResponse(
            status_code=410,
            content={"detail": "Mídia expirada ou indisponível"},
            headers=MISSING_MEDIA_HEADERS,
        )

    # Se já está marcado como failed no banco, cria o cache negativo e retorna 410
    if media.failed:
        try:
            Path("uploads").mkdir(parents=True, exist_ok=True)
            no_media_path.touch()
        except Exception:
            pass
        return JSONResponse(
            status_code=410,
            content={"detail": "Mídia expirada ou indisponível"},
            headers=MISSING_MEDIA_HEADERS,
        )

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
