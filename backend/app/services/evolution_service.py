"""
Evolution API Service — v2 (Resiliente)

Melhorias em relação à versão anterior:
  1. Cliente httpx compartilhado com pool de conexões TCP (evita handshake a cada chamada).
  2. Retry automático com backoff exponencial para erros de rede/timeout (até 3 tentativas).
  3. Circuit breaker integrado — interrompe chamadas quando a Evolution API está instável.
"""

import asyncio
import logging
import httpx

from app.core.circuit_breaker import evolution_circuit_breaker, CircuitBreakerError

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pool de conexões HTTP compartilhado
# ---------------------------------------------------------------------------
_http_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    """Retorna (ou cria) o cliente HTTP compartilhado com pool de conexões."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=30.0, write=30.0, pool=5.0),
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10,
                keepalive_expiry=30,
            ),
            http2=False,  # Evolution API não suporta HTTP/2
        )
        logger.debug("Novo httpx.AsyncClient criado (pool compartilhado)")
    return _http_client


async def close_http_client():
    """Fecha o pool de conexões — chamar no shutdown da aplicação."""
    global _http_client
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None
        logger.info("httpx.AsyncClient (pool compartilhado) encerrado")


# ---------------------------------------------------------------------------
# Helper: request com retry + circuit breaker
# ---------------------------------------------------------------------------
_RETRYABLE_EXCEPTIONS = (
    httpx.ConnectError,
    httpx.TimeoutException,
    httpx.RemoteProtocolError,
)


async def _request(
    method: str,
    url: str,
    max_retries: int = 3,
    **kwargs,
) -> httpx.Response:
    """
    Realiza uma requisição HTTP com:
      - Circuit breaker (falha rápida quando a API está instável)
      - Retry automático (backoff: 1s → 2s → 4s) para erros de rede/timeout
      - Pool de conexões compartilhado
    """
    last_exc: Exception | None = None

    for attempt in range(1, max_retries + 1):
        coro = None
        try:
            client = get_http_client()
            coro = getattr(client, method)(url, **kwargs)
            response: httpx.Response = await evolution_circuit_breaker.call(coro)
            coro = None  # awaited com sucesso — não precisa fechar
            return response

        except CircuitBreakerError:
            # Circuit aberto — fecha a coroutine para evitar RuntimeWarning
            if coro is not None:
                coro.close()
            raise

        except _RETRYABLE_EXCEPTIONS as exc:
            last_exc = exc
            if attempt < max_retries:
                wait = 2 ** (attempt - 1)  # 1s, 2s, 4s
                logger.warning(
                    f"[EvolutionService] Tentativa {attempt}/{max_retries} falhou "
                    f"({type(exc).__name__}). Aguardando {wait}s → {url}"
                )
                await asyncio.sleep(wait)
            else:
                logger.error(
                    f"[EvolutionService] Todas as {max_retries} tentativas falharam → {url}: {exc}"
                )

        except Exception:
            # Erros não recuperáveis (4xx, 5xx, etc.) — não retentar
            raise

    raise last_exc  # type: ignore[misc]



# ---------------------------------------------------------------------------
# Evolution API Service
# ---------------------------------------------------------------------------
class EvolutionService:

    @staticmethod
    async def send_text_message(
        base_url: str,
        api_key: str,
        instance_name: str,
        phone: str,
        text: str,
        quoted_external_id: str = None,
    ) -> dict:
        url = f"{base_url.rstrip('/')}/message/sendText/{instance_name}"
        headers = {"apikey": api_key, "Content-Type": "application/json"}
        payload = {"number": phone, "text": text}

        if quoted_external_id:
            payload["options"] = {
                "quoted": {"key": {"id": quoted_external_id}}
            }

        try:
            response = await _request("post", url, headers=headers, json=payload)
            if response.status_code >= 400:
                logger.error(
                    f"Evolution API Error ({response.status_code}): {response.text}"
                )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to send message to Evolution API: {e}")
            raise

    @staticmethod
    async def send_media_message(
        base_url: str,
        api_key: str,
        instance_name: str,
        phone: str,
        media: str,
        media_type: str,
        mimetype: str,
        caption: str = "",
        quoted_external_id: str = None,
    ) -> dict:
        """
        media: base64 string ou URL
        media_type: image, audio, video, document
        mimetype: image/jpeg, audio/mp4, etc.
        """
        url = f"{base_url.rstrip('/')}/message/sendMedia/{instance_name}"
        headers = {"apikey": api_key, "Content-Type": "application/json"}

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
            "media": media,
        }

        if quoted_external_id:
            payload["options"] = {
                "quoted": {"key": {"id": quoted_external_id}}
            }

        logger.info(
            f"Sending media to Evolution API: {url} | type={media_type}"
        )

        try:
            response = await _request("post", url, headers=headers, json=payload)
            if response.status_code not in (200, 201):
                logger.error(
                    f"Evolution API Error: {response.status_code} - {response.text}"
                )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to send media message to Evolution API: {e}")
            raise

    @staticmethod
    async def send_audio_message(
        base_url: str,
        api_key: str,
        instance_name: str,
        phone: str,
        audio_base64: str,
        mimetype: str = "audio/ogg",
        quoted_external_id: str = None,
    ) -> dict:
        """Envia áudio como WhatsApp PTT (Push-to-Talk) via endpoint dedicado."""
        url = f"{base_url.rstrip('/')}/message/sendWhatsAppAudio/{instance_name}"
        headers = {"apikey": api_key, "Content-Type": "application/json"}

        if audio_base64.startswith("data:"):
            try:
                audio_base64 = audio_base64.split(",")[1]
            except IndexError:
                pass

        payload = {"number": phone, "audio": audio_base64, "encoding": True}

        if quoted_external_id:
            payload["options"] = {
                "quoted": {"key": {"id": quoted_external_id}}
            }

        logger.info(f"Sending PTT audio to Evolution API: {url}")

        try:
            response = await _request("post", url, headers=headers, json=payload)
            if response.status_code >= 400:
                logger.error(
                    f"Evolution API Error ({response.status_code}): {response.text}"
                )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to send audio message to Evolution API: {e}")
            raise

    @staticmethod
    async def get_base64_from_media_message(
        base_url: str,
        api_key: str,
        instance_name: str,
        message: dict,
    ) -> str | None:
        """Solicita à Evolution API que descriptografe e retorne base64 de uma mídia."""
        url = f"{base_url.rstrip('/')}/chat/getBase64FromMediaMessage/{instance_name}"
        headers = {"apikey": api_key, "Content-Type": "application/json"}

        try:
            response = await _request(
                "post", url, headers=headers, json={"message": message}
            )
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict) and "base64" in data:
                return data["base64"]
            return None
        except Exception as e:
            logger.error(f"Failed to fetch base64 media from Evolution API: {e}")
            return None

    @staticmethod
    async def get_qrcode(base_url: str, api_key: str, instance_name: str) -> dict:
        url = f"{base_url.rstrip('/')}/instance/connect/{instance_name}"
        headers = {"apikey": api_key}

        try:
            response = await _request("get", url, headers=headers)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to fetch QR Code from Evolution API: {e}")
            raise

    @staticmethod
    async def get_connection_state(
        base_url: str, api_key: str, instance_name: str
    ) -> dict:
        url = f"{base_url.rstrip('/')}/instance/connectionState/{instance_name}"
        headers = {"apikey": api_key}

        try:
            response = await _request("get", url, headers=headers, max_retries=2)
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
            response = await _request("post", url, headers=headers, json={}, max_retries=2)
            logger.info(f"fetch_chats status={response.status_code} for {instance_name}")
            response.raise_for_status()
            data = response.json()

            if isinstance(data, list):
                logger.info(f"fetch_chats returned {len(data)} chats (list format)")
                return data
            elif isinstance(data, dict):
                for key in ("chats", "data", "records"):
                    if key in data and isinstance(data[key], list):
                        logger.info(
                            f"fetch_chats returned {len(data[key])} chats (dict.{key} format)"
                        )
                        return data[key]
                logger.warning(f"fetch_chats unknown dict format, keys: {list(data.keys())}")
                return []
            logger.warning(f"fetch_chats unexpected type: {type(data)}")
            return []
        except Exception as e:
            logger.error(f"Failed to fetch chats from Evolution API: {e}")
            return []

    @staticmethod
    async def fetch_contacts(base_url: str, api_key: str, instance_name: str) -> list:
        """Busca todos os contatos — fallback quando findChats retorna vazio."""
        url = f"{base_url.rstrip('/')}/chat/findContacts/{instance_name}"
        headers = {"apikey": api_key, "Content-Type": "application/json"}

        try:
            response = await _request("post", url, headers=headers, json={}, max_retries=2)
            logger.info(f"fetch_contacts status={response.status_code} for {instance_name}")
            response.raise_for_status()
            data = response.json()

            if isinstance(data, list):
                logger.info(f"fetch_contacts returned {len(data)} contacts")
                return data
            elif isinstance(data, dict):
                for key in ("contacts", "data", "records"):
                    if key in data and isinstance(data[key], list):
                        return data[key]
            return []
        except Exception as e:
            logger.error(f"Failed to fetch contacts from Evolution API: {e}")
            return []

    @staticmethod
    async def fetch_groups(base_url: str, api_key: str, instance_name: str) -> list:
        url = f"{base_url.rstrip('/')}/group/fetchAllGroups/{instance_name}"
        headers = {"apikey": api_key}
        params = {"getParticipants": "false"}

        try:
            response = await _request("get", url, headers=headers, params=params, max_retries=2)
            response.raise_for_status()
            data = response.json()
            logger.info(
                f"fetch_groups returned {len(data) if isinstance(data, list) else '?'} groups"
            )
            return data if isinstance(data, list) else []
        except Exception as e:
            logger.error(f"Failed to fetch groups from Evolution API: {e}")
            return []

    @staticmethod
    async def fetch_profile_picture_url(
        base_url: str, api_key: str, instance_name: str, number: str
    ) -> str | None:
        url = f"{base_url.rstrip('/')}/chat/fetchProfilePictureUrl/{instance_name}"
        headers = {"apikey": api_key, "Content-Type": "application/json"}
        payload = {"number": number}

        try:
            response = await _request(
                "post", url, headers=headers, json=payload, max_retries=1
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict):
                return data.get("profilePictureUrl")
            return None
        except Exception as e:
            logger.info(f"Failed to fetch profile picture for {number}: {e}")
            return None

    @staticmethod
    async def fetch_messages(
        base_url: str,
        api_key: str,
        instance_name: str,
        remote_jid: str,
        limit: int = 30,
    ) -> list:
        url = f"{base_url.rstrip('/')}/chat/findMessages/{instance_name}"
        headers = {"apikey": api_key, "Content-Type": "application/json"}
        payload = {"where": {"key": {"remoteJid": remote_jid}}, "limit": limit}

        try:
            response = await _request("post", url, headers=headers, json=payload, max_retries=2)
            response.raise_for_status()
            data = response.json()

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
        headers = {"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"}
        payload = {
            "instanceName": instance_name,
            "qrcode": True,
            "integration": "WHATSAPP-BAILEYS",
        }

        try:
            response = await _request("post", url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to create instance in Evolution API: {e}")
            raise

    @staticmethod
    async def delete_instance(instance_name: str) -> dict:
        from app.core.config import settings

        url = f"{settings.evolution_base_url.rstrip('/')}/instance/delete/{instance_name}"
        headers = {"apikey": settings.EVOLUTION_API_KEY}

        try:
            response = await _request("delete", url, headers=headers, max_retries=1)
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
            response = await _request("delete", url, headers=headers, max_retries=1)
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
            response = await _request("put", url, headers=headers)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to restart instance in Evolution API: {e}")
            raise

    @staticmethod
    async def set_webhook(instance_name: str, webhook_url: str) -> dict:
        from app.core.config import settings

        url = f"{settings.evolution_base_url.rstrip('/')}/webhook/set/{instance_name}"
        headers = {"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"}
        payload = {
            "webhook": {
                "url": webhook_url,
                "enabled": True,
                "events": [
                    "MESSAGES_UPSERT",
                    "MESSAGES_UPDATE",
                    "MESSAGES_DELETE",
                    "SEND_MESSAGE",
                    "CONNECTION_UPDATE",
                ],
            }
        }

        try:
            response = await _request("post", url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to set webhook in Evolution API: {e}")
            raise
