import base64
import uuid
import mimetypes
import os
import httpx
import logging

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
