"""
Connection Health Service

Roda em background (loop infinito) e verifica periodicamente o estado real
de todas as conexões ativas na Evolution API.

Responsabilidades:
  1. Detectar conexões "zumbi" (status=connected no DB, mas close na API).
  2. Atualizar o status no banco e emitir CONNECTION_STATUS_UPDATED via WebSocket.
  3. Re-registrar o webhook automaticamente quando a conexão reconectar
     (útil após restart do container Evolution API).
  4. Disparar sync histórico quando uma instância voltar a ficar online.
"""

import asyncio
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Intervalo padrão entre verificações (segundos)
HEALTH_CHECK_INTERVAL = 60


@dataclass(frozen=True)
class ConnectionSnapshot:
    id: str
    workspace_id: str
    base_url: str
    api_key: str
    instance_name: str
    status: str


class ConnectionHealthService:

    @staticmethod
    def _get_connection_snapshots() -> list[ConnectionSnapshot]:
        from app.core.database import SessionLocal
        from app.models.connection import Connection

        with SessionLocal() as db:
            return [
                ConnectionSnapshot(
                    id=conn.id,
                    workspace_id=conn.workspace_id,
                    base_url=conn.base_url,
                    api_key=conn.api_key,
                    instance_name=conn.instance_name,
                    status=conn.status,
                )
                for conn in db.query(Connection).all()
            ]

    @staticmethod
    def _update_connection_status(connection_id: str, status: str):
        from app.core.database import SessionLocal
        from app.models.connection import Connection

        with SessionLocal() as db:
            conn = db.query(Connection).filter(Connection.id == connection_id).first()
            if not conn:
                return None
            conn.status = status
            db.commit()
            return ConnectionSnapshot(
                id=conn.id,
                workspace_id=conn.workspace_id,
                base_url=conn.base_url,
                api_key=conn.api_key,
                instance_name=conn.instance_name,
                status=conn.status,
            )

    @staticmethod
    async def check_all_connections() -> None:
        """
        Verifica o estado real de todas as conexões na Evolution API
        e sincroniza com o banco de dados.
        """
        from app.services.evolution_service import EvolutionService
        from app.core.socket_manager import socket_manager
        from app.core.config import settings
        from app.core.circuit_breaker import CircuitBreakerError

        try:
            connections = ConnectionHealthService._get_connection_snapshots()
            if not connections:
                return

            logger.debug(
                f"[HealthCheck] Verificando {len(connections)} conexão(ões)..."
            )

            status_map = {
                "open": "connected",
                "connecting": "connecting",
                "close": "disconnected",
                "qr": "qrcode",
            }

            for conn in connections:
                try:
                    state_data = await EvolutionService.get_connection_state(
                        base_url=conn.base_url,
                        api_key=conn.api_key,
                        instance_name=conn.instance_name,
                    )

                    raw_state = (
                        state_data.get("instance", {}).get("state")
                        or state_data.get("state", "")
                    )
                    new_status = status_map.get(str(raw_state).lower(), raw_state)

                    if not new_status:
                        continue

                    previous_status = conn.status

                    if new_status != previous_status:
                        logger.info(
                            f"[HealthCheck] {conn.instance_name}: "
                            f"{previous_status} → {new_status}"
                        )
                        updated_conn = ConnectionHealthService._update_connection_status(conn.id, new_status)
                        if not updated_conn:
                            continue

                        # Notifica o frontend via WebSocket
                        await socket_manager.broadcast({
                            "type": "CONNECTION_STATUS_UPDATED",
                            "workspace_id": updated_conn.workspace_id,
                            "data": {
                                "id": updated_conn.id,
                                "status": updated_conn.status,
                            },
                        })

                        # Reconectou → re-registra webhook e dispara sync
                        if new_status == "connected" and previous_status != "connected":
                            await ConnectionHealthService._on_reconnected(updated_conn, settings)

                except CircuitBreakerError as e:
                    logger.warning(
                        f"[HealthCheck] Circuit breaker aberto, pulando {conn.instance_name}: {e}"
                    )
                    # Não atualiza status — mantém o último conhecido
                    continue

                except Exception as e:
                    logger.warning(
                        f"[HealthCheck] Falha ao verificar {conn.instance_name}: {e}"
                    )
                    # Marca como disconnected se a API estiver inacessível
                    if conn.status == "connected":
                        updated_conn = ConnectionHealthService._update_connection_status(conn.id, "disconnected")
                        if not updated_conn:
                            continue
                        await socket_manager.broadcast({
                            "type": "CONNECTION_STATUS_UPDATED",
                            "workspace_id": updated_conn.workspace_id,
                            "data": {"id": updated_conn.id, "status": "disconnected"},
                        })

        except Exception as e:
            logger.error(f"[HealthCheck] Erro geral durante verificação: {e}")


    @staticmethod
    async def _on_reconnected(conn, settings) -> None:
        """
        Chamado quando uma instância volta ao estado 'connected'.

        Ações:
          1. Re-registra o webhook (garante que está apontando para a URL correta).
          2. Dispara sync histórico em background.
        """
        from app.services.evolution_service import EvolutionService
        from app.services.sync_service import SyncService

        # 1. Re-registrar webhook
        try:
            webhook_url = (
                f"{settings.webhook_public_base_url.rstrip('/')}"
                f"/webhooks/evolution/{conn.id}"
            )
            await EvolutionService.set_webhook(
                instance_name=conn.instance_name,
                webhook_url=webhook_url,
            )
            logger.info(
                f"[HealthCheck] Webhook re-registrado para {conn.instance_name}: {webhook_url}"
            )
        except Exception as e:
            logger.error(
                f"[HealthCheck] Falha ao re-registrar webhook de {conn.instance_name}: {e}"
            )

        # 2. Sync histórico em background (supervisionado)
        async def _safe_sync(connection_id: str):
            try:
                await SyncService.sync_connection(connection_id)
            except Exception as exc:
                logger.error(
                    f"[HealthCheck] Sync em background falhou para {connection_id}: {exc}"
                )

        asyncio.create_task(_safe_sync(conn.id))

    @staticmethod
    async def start_background_health_check(
        interval_seconds: int = HEALTH_CHECK_INTERVAL,
    ) -> None:
        """
        Loop infinito que chama check_all_connections() a cada `interval_seconds`.
        Deve ser iniciado como uma asyncio.Task no startup da aplicação.
        """
        logger.info(
            f"[HealthCheck] Serviço iniciado (intervalo: {interval_seconds}s)"
        )
        while True:
            try:
                await asyncio.sleep(interval_seconds)
                await ConnectionHealthService.check_all_connections()
            except asyncio.CancelledError:
                logger.info("[HealthCheck] Serviço encerrado.")
                break
            except Exception as e:
                # Nunca deixa o loop morrer por erro inesperado
                logger.error(f"[HealthCheck] Erro inesperado no loop: {e}")
                await asyncio.sleep(10)  # Pequena pausa antes de continuar
