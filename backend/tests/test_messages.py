import pytest
from unittest.mock import patch, AsyncMock
from app.models.contact import Contact
from app.models.inbox import Inbox
from app.models.connection import Connection
from app.models.conversation import Conversation
from app.models.message import Message

@pytest.fixture
def message_setup(db_session, workspace_seed):
    workspace_id = workspace_seed["workspace_id"]
    
    inbox = Inbox(workspace_id=workspace_id, name="Test Inbox", channel_type="whatsapp")
    db_session.add(inbox)
    db_session.flush()

    connection = Connection(
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        name="Test Conn",
        provider="evolution_api",
        instance_name="test_inst",
        base_url="http://localhost:8080",
        api_key="key",
        status="connected"
    )
    db_session.add(connection)
    
    contact = Contact(
        workspace_id=workspace_id,
        name="John Customer",
        phone="5511999999999"
    )
    db_session.add(contact)
    db_session.flush()
    
    conversation = Conversation(
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        contact_id=contact.id,
        status="pending",
    )
    db_session.add(conversation)
    db_session.flush()
    
    msg = Message(
        workspace_id=workspace_id,
        conversation_id=conversation.id,
        contact_id=contact.id,
        direction="inbound",
        message_type="text",
        content="hello"
    )
    db_session.add(msg)
    db_session.commit()
    
    return {
        "conversation": conversation,
        "message": msg
    }

def test_get_messages(client, auth_headers, message_setup):
    conv_id = message_setup["conversation"].id
    response = client.get(f"/api/conversations/{conv_id}/messages", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["content"] == "hello"


def test_get_messages_auto_syncs_empty_conversation(client, auth_headers, db_session, workspace_seed):
    workspace_id = workspace_seed["workspace_id"]

    inbox = Inbox(workspace_id=workspace_id, name="Sync Inbox", channel_type="whatsapp")
    db_session.add(inbox)
    db_session.flush()

    connection = Connection(
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        name="Sync Conn",
        provider="evolution_api",
        instance_name="sync_inst",
        base_url="http://localhost:8080",
        api_key="key",
        status="connected",
    )
    contact = Contact(
        workspace_id=workspace_id,
        name="Sync Customer",
        phone="5511888888888",
    )
    db_session.add_all([connection, contact])
    db_session.flush()

    conversation = Conversation(
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        contact_id=contact.id,
        external_id="5511888888888@s.whatsapp.net",
        status="pending",
    )
    db_session.add(conversation)
    db_session.commit()

    async def fake_sync(sync_db, _connection, chat):
        assert chat["remoteJid"] == "5511888888888@s.whatsapp.net"
        sync_db.add(Message(
            workspace_id=workspace_id,
            conversation_id=conversation.id,
            contact_id=contact.id,
            direction="inbound",
            message_type="text",
            content="historico recuperado",
        ))
        sync_db.commit()
        return True, 1

    with patch("app.services.sync_service.sync_chat_record", new_callable=AsyncMock, side_effect=fake_sync) as mock_sync:
        response = client.get(f"/api/conversations/{conversation.id}/messages", headers=auth_headers)

    assert response.status_code == 200
    data = response.json()
    assert [msg["content"] for msg in data] == ["historico recuperado"]
    mock_sync.assert_awaited_once()

def test_get_messages_not_found(client, auth_headers):
    response = client.get("/api/conversations/invalid-id/messages", headers=auth_headers)
    assert response.status_code == 404

@patch("app.api.routes.messages.EvolutionService.send_text_message", new_callable=AsyncMock)
def test_send_message(mock_send, client, auth_headers, message_setup):
    conv_id = message_setup["conversation"].id
    payload = {
        "content": "test reply",
        "message_type": "text"
    }
    
    response = client.post(f"/api/conversations/{conv_id}/messages", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "test reply"
    assert data["status"] == "pending"
    assert data["is_internal"] is False

def test_send_internal_message(client, auth_headers, message_setup):
    conv_id = message_setup["conversation"].id
    payload = {
        "content": "internal note",
        "message_type": "text",
        "is_internal": True
    }
    
    response = client.post(f"/api/conversations/{conv_id}/messages", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "internal note"
    assert data["is_internal"] is True
    assert data["status"] == "sent"

@patch("app.api.routes.messages.EvolutionService.send_media_message", new_callable=AsyncMock)
def test_send_media_message(mock_send, client, auth_headers, message_setup):
    conv_id = message_setup["conversation"].id
    payload = {
        "media": "base64data",
        "media_type": "image",
        "mimetype": "image/jpeg",
        "caption": "test image"
    }
    
    response = client.post(f"/api/conversations/{conv_id}/messages/media", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["content"] == "test image"
    assert data["message_type"] == "image"
    assert data["status"] == "pending"
