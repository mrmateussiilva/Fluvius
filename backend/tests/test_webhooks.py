import pytest
from unittest.mock import AsyncMock, patch
from app.services.webhook_service import WebhookService
from app.models.connection import Connection
from app.models.inbox import Inbox

@pytest.mark.asyncio
async def test_webhook_connection_update(db_session):
    # 1. Setup mock models
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
    
    # 2. Mock background sync call
    payload = {
        "event": "connection.update",
        "data": {
            "state": "open"
        }
    }
    
    with patch("app.services.sync_service.SyncService.sync_connection", new_callable=AsyncMock) as mock_sync:
        await WebhookService._handle_connection_update(db_session, connection.id, payload)
        
        # Verify db status was updated correctly via webhook
        db_session.refresh(connection)
        assert connection.status == "connected"
        
        # Verify that background sync was triggered for 'connected' status
        mock_sync.assert_called_once_with(connection.id)
