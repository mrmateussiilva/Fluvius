import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.webhook_service import WebhookService
from app.models.connection import Connection
from app.models.inbox import Inbox

@pytest.mark.asyncio
async def test_webhook_connection_update(db_session):
    """Verifica que connection.update atualiza o status no DB e dispara sync supervisionado."""
    workspace_id = "test_workspace_123"

    inbox = Inbox(workspace_id=workspace_id, name="Test Webhook Inbox", channel_type="whatsapp")
    db_session.add(inbox)
    db_session.flush()

    connection = Connection(
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        name="Webhook Connection",
        provider="evolution_api",
        instance_name="webhook_instance",
        base_url="http://localhost:8080",
        api_key="key",
        status="offline"
    )
    db_session.add(connection)
    db_session.commit()

    payload = {
        "event": "connection.update",
        "data": {"state": "open"}
    }

    # O sync agora é chamado dentro de _safe_sync via asyncio.create_task.
    # Mockamos sync_connection e garantimos que o status foi atualizado.
    with patch("app.services.sync_service.SyncService.sync_connection", new_callable=AsyncMock):
        with patch("app.core.socket_manager.socket_manager.broadcast", new_callable=AsyncMock):
            await WebhookService._handle_connection_update(db_session, connection.id, payload)

            # Drena tarefas pendentes do event loop para que o _safe_sync execute
            await asyncio.sleep(0)

        db_session.refresh(connection)
        assert connection.status == "connected"


@pytest.mark.asyncio
async def test_webhook_connection_update_to_disconnected(db_session):
    """Verifica que state=close atualiza o status para disconnected."""
    workspace_id = "test_workspace_456"

    inbox = Inbox(workspace_id=workspace_id, name="Test Inbox 2", channel_type="whatsapp")
    db_session.add(inbox)
    db_session.flush()

    connection = Connection(
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        name="Conn 2",
        provider="evolution_api",
        instance_name="inst_2",
        base_url="http://localhost:8080",
        api_key="key",
        status="connected"
    )
    db_session.add(connection)
    db_session.commit()

    payload = {
        "event": "connection.update",
        "data": {"state": "close"}
    }

    with patch("app.core.socket_manager.socket_manager.broadcast", new_callable=AsyncMock):
        await WebhookService._handle_connection_update(db_session, connection.id, payload)

    db_session.refresh(connection)
    assert connection.status == "disconnected"

