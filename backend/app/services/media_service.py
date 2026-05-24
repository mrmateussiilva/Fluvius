import os
import uuid
import logging
import mimetypes
import asyncio
import httpx
from pathlib import Path
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.media import Media
from app.models.message import Message
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.connection import Connection
from app.models.inbox import Inbox
from app.services.evolution_service import EvolutionService
from app.utils.media import save_base64_to_disk

logger = logging.getLogger(__name__)

# Diretório base montado no docker/local
UPLOADS_DIR = Path("uploads")


class MediaDownloadService:
    # Semáforo para limitar downloads simultâneos de mídias pesadas a 3
    _download_semaphore = asyncio.Semaphore(3)

    @staticmethod
    def ensure_directories():
        """Garante que as subpastas de mídias existam."""
        for sub in ["audio", "images", "video", "documents", "avatars"]:
            (UPLOADS_DIR / sub).mkdir(parents=True, exist_ok=True)

    @staticmethod
    async def download_message_media(db: Session | None, message_id: str):
        """
        Tarefa em background para baixar e descriptografar mídia de uma mensagem.
        Se `db` for None, cria uma session fresca via SessionLocal().
        """
        MediaDownloadService.ensure_directories()
        
        # Gerencia session local se não foi provida uma
        db_provided = db is not None
        session = db if db_provided else SessionLocal()

        try:
            # 1. Buscar registro de mídia
            media = session.query(Media).filter(Media.message_id == message_id).first()
            if not media:
                logger.warning(f"[MediaDownloadService] Nenhuma mídia cadastrada para a mensagem {message_id}")
                return

            if media.downloaded and media.file_path:
                # Verifica se o arquivo físico existe
                local_path = Path(media.file_path.lstrip("/"))
                if local_path.exists():
                    return

            # 2. Buscar mensagem e conexão
            message = session.query(Message).filter(Message.id == message_id).first()
            if not message:
                logger.error(f"[MediaDownloadService] Mensagem {message_id} não encontrada no banco")
                return

            conversation = session.query(Conversation).filter(Conversation.id == message.conversation_id).first()
            if not conversation:
                logger.error(f"[MediaDownloadService] Conversa {message.conversation_id} não encontrada")
                return

            inbox = session.query(Inbox).filter(Inbox.id == conversation.inbox_id).first()
            if not inbox:
                logger.error(f"[MediaDownloadService] Inbox {conversation.inbox_id} não encontrada")
                return

            connection = session.query(Connection).filter(Connection.inbox_id == inbox.id).first()
            if not connection:
                logger.error(f"[MediaDownloadService] Conexão WhatsApp não encontrada para a inbox {inbox.id}")
                return

            raw_payload = message.raw_payload or {}
            wa_message = (
                raw_payload.get("data", {}).get("message")
                or raw_payload.get("message")
            )

            # Detectar a URL original (se houver) salva no payload ou informada
            source_url = raw_payload.get("data", {}).get("mediaUrl") or raw_payload.get("mediaUrl")
            
            # Tipo e extensão do arquivo
            mime_type = message.mime_type or media.mime_type or "application/octet-stream"
            ext = mimetypes.guess_extension(mime_type) or ""
            if mime_type == "audio/ogg" or "audio/ogg" in mime_type:
                ext = ".ogg"
            elif mime_type == "audio/mpeg" or "audio/mpeg" in mime_type:
                ext = ".mp3"

            # Caminho onde salvaremos
            dest_subfolder = "documents"
            if media.media_type in ["image", "audio", "video"]:
                dest_subfolder = f"{media.media_type}s" # Ex: images, audio (com s no final para bater com ensure_dirs)
                if media.media_type == "audio":
                    dest_subfolder = "audio" # Sem s para áudio ficar na pasta uploads/audio

            filename = f"{uuid.uuid4().hex}{ext}"
            relative_path = f"uploads/{dest_subfolder}/{filename}"
            absolute_path = UPLOADS_DIR / dest_subfolder / filename

            # 3. Executar download
            success = False
            async with MediaDownloadService._download_semaphore:
                try:
                    # Caso 1: Mídia descriptografada via Evolution API (para .enc do WhatsApp)
                    if wa_message and (source_url and ".enc" in source_url or "keys" in str(wa_message).lower()):
                        logger.info(f"[MediaDownloadService] Solicitando descriptografia via Evolution para mensagem {message_id}")
                        base64_data = await EvolutionService.get_base64_from_media_message(
                            base_url=connection.base_url,
                            api_key=connection.api_key,
                            instance_name=connection.instance_name,
                            message={"message": wa_message},
                        )
                        if base64_data:
                            import base64
                            with open(absolute_path, "wb") as f:
                                f.write(base64.b64decode(base64_data))
                            success = True
                            logger.info(f"[MediaDownloadService] Mídia descriptografada salva em {relative_path}")

                    # Caso 2: URL direta de download da Evolution API (localhost / docker)
                    if not success and source_url and ("localhost" in source_url or "host.docker.internal" in source_url or "/message/download" in source_url):
                        logger.info(f"[MediaDownloadService] Baixando URL interna do Evolution: {source_url}")
                        headers = {"apikey": connection.api_key}
                        async with httpx.AsyncClient() as client:
                            response = await client.get(source_url, headers=headers, timeout=15.0)
                            if response.status_code == 200:
                                with open(absolute_path, "wb") as f:
                                    f.write(response.content)
                                success = True
                                logger.info(f"[MediaDownloadService] Mídia de URL interna salva em {relative_path}")

                    # Caso 3: URL normal na internet
                    if not success and source_url and source_url.startswith("http"):
                        logger.info(f"[MediaDownloadService] Baixando URL direta da internet: {source_url}")
                        async with httpx.AsyncClient() as client:
                            response = await client.get(source_url, timeout=15.0)
                            if response.status_code == 200:
                                with open(absolute_path, "wb") as f:
                                    f.write(response.content)
                                success = True
                                logger.info(f"[MediaDownloadService] Mídia de URL pública salva em {relative_path}")

                except Exception as e:
                    logger.error(f"[MediaDownloadService] Falha ao baixar mídia {media.id} para mensagem {message_id}: {e}")

            # 4. Atualizar registro no banco
            if success:
                media.downloaded = True
                media.file_path = f"/{relative_path}"
                media.file_size = absolute_path.stat().st_size
                media.failed = False
                
                # Também atualiza media_url na tabela messages para apontar para a API local
                message.media_url = f"/api/media/{media.id}"
                session.commit()
            else:
                media.failed = True
                session.commit()
        finally:
            if not db_provided:
                session.close()

    @staticmethod
    async def download_contact_avatar(db: Session | None, contact_id: str):
        """
        Tarefa em background para baixar a foto de perfil do contato.
        Se `db` for None, cria uma session fresca via SessionLocal().
        """
        MediaDownloadService.ensure_directories()

        db_provided = db is not None
        session = db if db_provided else SessionLocal()

        try:
            contact = session.query(Contact).filter(Contact.id == contact_id).first()
            if not contact or not contact.avatar_url:
                return

            # Se já é local, não faz nada
            if contact.avatar_url.startswith("/api/media/"):
                return

            # 1. Obter a URL real do avatar. Se for externa do WhatsApp:
            external_url = contact.avatar_url

            # Criar registro de mídia associado
            media = session.query(Media).filter(Media.media_type == "avatar", Media.file_path == contact.id).first()
            if not media:
                media = Media(
                    media_type="avatar",
                    mime_type="image/jpeg",
                    file_path=contact.id,  # Armazena o ID do contato para facilitar busca
                    downloaded=False,
                    failed=False
                )
                session.add(media)
                session.commit()
                session.refresh(media)

            filename = f"{contact_id}.jpg"
            relative_path = f"uploads/avatars/{filename}"
            absolute_path = UPLOADS_DIR / "avatars" / filename

            success = False
            try:
                logger.info(f"[MediaDownloadService] Baixando avatar para contato {contact.name or contact.phone}")
                async with httpx.AsyncClient() as client:
                    response = await client.get(external_url, timeout=10.0)
                    if response.status_code == 200:
                        with open(absolute_path, "wb") as f:
                            f.write(response.content)
                        success = True

            except Exception as e:
                logger.error(f"[MediaDownloadService] Falha ao baixar avatar do contato {contact_id}: {e}")

            if success:
                media.downloaded = True
                media.file_path = f"/{relative_path}"
                media.file_size = absolute_path.stat().st_size
                media.failed = False
                
                # Atualiza o avatar_url do contato para apontar para a rota local do Fluvius
                contact.avatar_url = f"/api/media/avatar/{contact_id}"
                session.commit()
            else:
                media.failed = True
                session.commit()
        finally:
            if not db_provided:
                session.close()
