import base64
import uuid
import mimetypes
import os
import httpx
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def save_base64_to_disk(b64_str: str, mime_type: str) -> str:
    # Remove prefix if present (e.g. data:image/png;base64,...)
    if "," in b64_str:
        b64_str = b64_str.split(",")[1]

    ext = mimetypes.guess_extension(mime_type) or ""
    if mime_type == "audio/ogg":
        ext = ".ogg"
    elif mime_type == "audio/mpeg":
        ext = ".mp3"
        
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join("uploads", filename)
    
    with open(filepath, "wb") as f:
        f.write(base64.b64decode(b64_str))
        
    # In a real SaaS, this should be the public URL or S3 URL
    return f"/uploads/{filename}"

async def download_media(url: str, api_key: str, mime_type: str) -> str:
    ext = mimetypes.guess_extension(mime_type) or ""
    if mime_type == "audio/ogg":
        ext = ".ogg"
    elif mime_type == "audio/mpeg":
        ext = ".mp3"
        
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join("uploads", filename)
    
    headers = {"apikey": api_key}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=30.0)
            response.raise_for_status()
            with open(filepath, "wb") as f:
                f.write(response.content)
        return f"/uploads/{filename}"
    except Exception as e:
        logger.error(f"Failed to download media from {url}: {e}")
        return url # Fallback to original URL if download fails


def get_message_preview(message_type: str, content: str | None, is_internal: bool = False) -> str:
    if is_internal:
        return f"📝 Nota: {content or ''}"
    
    if message_type == "text":
        return content or ""
    elif message_type == "image":
        return f"📷 Foto{': ' + content if content else ''}"
    elif message_type == "video":
        return f"🎥 Vídeo{': ' + content if content else ''}"
    elif message_type == "audio":
        return "🎤 Áudio"
    elif message_type == "document":
        return f"📄 Documento{': ' + content if content else ''}"
    return content or ""


def get_serialized_avatar_url(avatar_url: str | None, contact_id: str) -> str | None:
    if not avatar_url:
        return None
    if avatar_url.startswith("/api/media/avatar/"):
        if Path(f"uploads/avatars/{contact_id}.jpg").exists():
            return avatar_url
        return None
    if avatar_url.startswith("http"):
        # Only expose the local avatar endpoint when the file is already cached.
        # Otherwise large conversation lists trigger hundreds of slow 404 image
        # requests while the browser tries to load avatars that do not exist yet.
        if Path(f"uploads/avatars/{contact_id}.jpg").exists():
            return f"/api/media/avatar/{contact_id}"
        return None
    return avatar_url
