import httpx
import logging

logger = logging.getLogger(__name__)

class EvolutionService:
    @staticmethod
    async def send_text_message(base_url: str, api_key: str, instance_name: str, phone: str, text: str) -> dict:
        url = f"{base_url.rstrip('/')}/message/sendText/{instance_name}"
        headers = {
            "apikey": api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "number": phone,
            "text": text
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=10.0)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to send message to Evolution API: {e}")
            raise

    @staticmethod
    async def send_media_message(base_url: str, api_key: str, instance_name: str, phone: str, media: str, media_type: str, mimetype: str, caption: str = "") -> dict:
        """
        media: base64 string or URL
        media_type: image, audio, video, document
        mimetype: image/jpeg, audio/mp4, etc.
        """
        url = f"{base_url.rstrip('/')}/message/sendMedia/{instance_name}"
        headers = {
            "apikey": api_key,
            "Content-Type": "application/json"
        }
        # Clean base64 prefix if present
        if media.startswith("data:"):
            try:
                media = media.split(",")[1]
            except IndexError:
                pass

        payload = {
            "number": phone,
            "mediatype": media_type,
            "mimetype": mimetype,
            "caption": caption,
            "media": media
        }
        
        logger.info(f"Sending media to Evolution API: {url} | Payload keys: {list(payload.keys())}")
        # logger.debug(f"Full payload: {payload}") # Cuidado com base64 gigante no log
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=30.0)
                if response.status_code != 201 and response.status_code != 200:
                    logger.error(f"Evolution API Error: {response.status_code} - {response.text}")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to send media message to Evolution API: {e}")
            raise

    @staticmethod
    async def get_qrcode(base_url: str, api_key: str, instance_name: str) -> dict:
        url = f"{base_url.rstrip('/')}/instance/connect/{instance_name}"
        headers = {
            "apikey": api_key
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=10.0)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to fetch QR Code from Evolution API: {e}")
            raise

    @staticmethod
    async def get_connection_state(base_url: str, api_key: str, instance_name: str) -> dict:
        url = f"{base_url.rstrip('/')}/instance/connectionState/{instance_name}"
        headers = {
            "apikey": api_key
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=10.0)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to fetch connection state from Evolution API: {e}")
            raise

    @staticmethod
    async def create_instance(instance_name: str) -> dict:
        from app.core.config import settings
        url = f"{settings.evolution_base_url.rstrip('/')}/instance/create"
        headers = {
            "apikey": settings.EVOLUTION_API_KEY,
            "Content-Type": "application/json"
        }
        payload = {
            "instanceName": instance_name,
            "token": settings.EVOLUTION_API_KEY, # Using same key for instance token for simplicity in MVP
            "qrcode": True
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=15.0)
                response.raise_for_status()
                data = response.json()
                return data
        except Exception as e:
            logger.error(f"Failed to create instance in Evolution API: {e}")
            raise

    @staticmethod
    async def set_webhook(instance_name: str, webhook_url: str) -> dict:
        from app.core.config import settings
        url = f"{settings.evolution_base_url.rstrip('/')}/webhook/set/{instance_name}"
        headers = {
            "apikey": settings.EVOLUTION_API_KEY,
            "Content-Type": "application/json"
        }
        payload = {
            "webhook": {
                "url": webhook_url,
                "enabled": True,
                "events": [
                    "MESSAGES_UPSERT",
                    "MESSAGES_UPDATE",
                    "MESSAGES_DELETE",
                    "SEND_MESSAGE",
                    "CONNECTION_UPDATE"
                ]
            }
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=10.0)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to set webhook in Evolution API: {e}")
            raise
