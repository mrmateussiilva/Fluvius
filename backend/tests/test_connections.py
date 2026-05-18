import pytest
from unittest.mock import AsyncMock, patch
from app.services.sync_service import is_whatsapp_chat_jid
from app.models.connection import Connection
from app.models.inbox import Inbox

def test_is_whatsapp_chat_jid():
    # Valid individual JIDs
    assert is_whatsapp_chat_jid("551199999999@s.whatsapp.net") is True
    assert is_whatsapp_chat_jid("123456789@c.us") is True
    
    # Valid group JIDs
    assert is_whatsapp_chat_jid("120363123456789@g.us") is True
    
    # Valid LID JIDs (Newly supported!)
    assert is_whatsapp_chat_jid("551199999999@lid") is True
    
    # Raw phone digits
    assert is_whatsapp_chat_jid("551199999999") is True
    
    # Invalid JIDs
    assert is_whatsapp_chat_jid("") is False
    assert is_whatsapp_chat_jid(None) is False
    assert is_whatsapp_chat_jid("invalid_jid") is False
    assert is_whatsapp_chat_jid("user@domain.com") is False

@pytest.mark.asyncio
async def test_connection_status_normalization(client, db_session):
    # 1. Create a workspace and agent first
    register_payload = {
        "company_name": "Fluvius Corp",
        "agent_name": "John Doe",
        "email": "john_test@example.com",
        "password": "securepassword123"
    }
    reg_response = client.post("/api/auth/register", json=register_payload)
    assert reg_response.status_code == 200
    token = reg_response.json()["access_token"]
    agent_data = reg_response.json()["agent"]
    
    # Fetch details from DB
    workspace_id = reg_response.json()["agent"]["id"] # in this schema, we can get workspace_id from DB
    
    # Create test Inbox & Connection in DB directly
    inbox = Inbox(workspace_id=workspace_id, name="Test WhatsApp", channel_type="whatsapp")
    db_session.add(inbox)
    db_session.flush()
    
    connection = Connection(
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        name="Test Connection",
        provider="evolution_api",
        instance_name="test_instance",
        base_url="http://localhost:8080",
        api_key="key",
        status="offline"
    )
    db_session.add(connection)
    db_session.commit()
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Test status normalization: 'open' -> 'connected'
    mock_response_open = {"instance": {"state": "open"}}
    with patch("app.services.evolution_service.EvolutionService.get_connection_state", new_callable=AsyncMock) as mock_state:
        mock_state.return_value = mock_response_open
        response = client.get(f"/api/connections/{connection.id}/status", headers=headers)
        assert response.status_code == 200
        
        # Verify db status was normalized to 'connected'
        db_session.refresh(connection)
        assert connection.status == "connected"
        
    # 3. Test status normalization: 'close' -> 'disconnected'
    mock_response_close = {"instance": {"state": "close"}}
    with patch("app.services.evolution_service.EvolutionService.get_connection_state", new_callable=AsyncMock) as mock_state:
        mock_state.return_value = mock_response_close
        response = client.get(f"/api/connections/{connection.id}/status", headers=headers)
        assert response.status_code == 200
        
        # Verify db status was normalized to 'disconnected'
        db_session.refresh(connection)
        assert connection.status == "disconnected"
        
    # 4. Test status normalization: 'qr' -> 'qrcode'
    mock_response_qr = {"instance": {"state": "qr"}}
    with patch("app.services.evolution_service.EvolutionService.get_connection_state", new_callable=AsyncMock) as mock_state:
        mock_state.return_value = mock_response_qr
        response = client.get(f"/api/connections/{connection.id}/status", headers=headers)
        assert response.status_code == 200
        
        # Verify db status was normalized to 'qrcode'
        db_session.refresh(connection)
        assert connection.status == "qrcode"
