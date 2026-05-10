import httpx
import logging

logger = logging.getLogger(__name__)

class EvolutionService:
    @staticmethod
    async def send_text_message(base_url: str, api_key: str, instance_name: str, phone: str, text: str, quoted_external_id: str = None) -> dict:
        url = f"{base_url.rstrip('/')}/message/sendText/{instance_name}"
        headers = {
            "apikey": api_key,
            "Content-Type": "application/json"
        }
        payload = {
            "number": phone,
            "text": text
        }
        
        if quoted_external_id:
            payload["options"] = {
                "quoted": {
                    "key": {
                        "id": quoted_external_id
                    }
                }
            }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=10.0)
                if response.status_code >= 400:
                    logger.error(f"Evolution API Error ({response.status_code}): {response.text}")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to send message to Evolution API: {e}")
            raise

    @staticmethod
    async def send_media_message(base_url: str, api_key: str, instance_name: str, phone: str, media: str, media_type: str, mimetype: str, caption: str = "", quoted_external_id: str = None) -> dict:
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
        
        if quoted_external_id:
            payload["options"] = {
                "quoted": {
                    "key": {
                        "id": quoted_external_id
                    }
                }
            }
        
        logger.info(f"Sending media to Evolution API: {url} | type={media_type} | Payload keys: {list(payload.keys())}")
        
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
    async def send_audio_message(base_url: str, api_key: str, instance_name: str, phone: str, audio_base64: str, mimetype: str = "audio/ogg", quoted_external_id: str = None) -> dict:
        """
        Sends audio as WhatsApp PTT (Push-to-Talk) using the dedicated endpoint.
        audio_base64: pure base64 string (no data: prefix)
        """
        url = f"{base_url.rstrip('/')}/message/sendWhatsAppAudio/{instance_name}"
        headers = {
            "apikey": api_key,
            "Content-Type": "application/json"
        }
        
        # Clean base64 prefix if present
        if audio_base64.startswith("data:"):
            try:
                audio_base64 = audio_base64.split(",")[1]
            except IndexError:
                pass
        
        payload = {
            "number": phone,
            "audio": audio_base64,
            "encoding": True
        }
        
        if quoted_external_id:
            payload["options"] = {
                "quoted": {
                    "key": {
                        "id": quoted_external_id
                    }
                }
            }
        
        logger.info(f"Sending PTT audio to Evolution API: {url}")
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=30.0)
                if response.status_code >= 400:
                    logger.error(f"Evolution API Error ({response.status_code}): {response.text}")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to send audio message to Evolution API: {e}")
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
    async def fetch_chats(base_url: str, api_key: str, instance_name: str) -> list:
        url = f"{base_url.rstrip('/')}/chat/findChats/{instance_name}"
        headers = {"apikey": api_key, "Content-Type": "application/json"}
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json={}, timeout=20.0)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to fetch chats from Evolution API: {e}")
            return []

    @staticmethod
    async def fetch_messages(base_url: str, api_key: str, instance_name: str, remote_jid: str, limit: int = 30) -> list:
        url = f"{base_url.rstrip('/')}/chat/findMessages/{instance_name}"
        headers = {"apikey": api_key, "Content-Type": "application/json"}
        payload = {
            "where": {
                "key": {
                    "remoteJid": remote_jid
                }
            },
            "limit": limit
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=20.0)
                response.raise_for_status()
                data = response.json()
                
                # The API returns {"messages": {"records": [...]}} or just [...] depending on version
                if isinstance(data, dict) and "messages" in data:
                    msgs = data["messages"]
                    if isinstance(msgs, dict) and "records" in msgs:
                        return msgs["records"]
                    return msgs
                elif isinstance(data, list):
                    return data
                return []
        except Exception as e:
            logger.error(f"Failed to fetch messages for {remote_jid}: {e}")
            return []

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
            "qrcode": True,
            "integration": "WHATSAPP-BAILEYS",  # Required in Evolution API v2
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
    async def delete_instance(instance_name: str) -> dict:
        from app.core.config import settings
        url = f"{settings.evolution_base_url.rstrip('/')}/instance/delete/{instance_name}"
        headers = {"apikey": settings.EVOLUTION_API_KEY}
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(url, headers=headers, timeout=15.0)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to delete instance in Evolution API: {e}")
            raise

    @staticmethod
    async def logout_instance(instance_name: str) -> dict:
        from app.core.config import settings
        url = f"{settings.evolution_base_url.rstrip('/')}/instance/logout/{instance_name}"
        headers = {"apikey": settings.EVOLUTION_API_KEY}
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(url, headers=headers, timeout=15.0)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to logout instance in Evolution API: {e}")
            raise

    @staticmethod
    async def restart_instance(instance_name: str) -> dict:
        from app.core.config import settings
        url = f"{settings.evolution_base_url.rstrip('/')}/instance/restart/{instance_name}"
        headers = {"apikey": settings.EVOLUTION_API_KEY}
        try:
            async with httpx.AsyncClient() as client:
                response = await client.put(url, headers=headers, timeout=15.0)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to restart instance in Evolution API: {e}")
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
