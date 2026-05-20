import pytest
from unittest.mock import patch, AsyncMock
from app.services.webhook_service import WebhookService, contact_phone_from_remote_jid
from app.models.connection import Connection
from app.models.inbox import Inbox
from app.models.contact import Contact
from app.models.conversation import Conversation

def test_contact_phone_from_remote_jid():
    # Individual JID
    assert contact_phone_from_remote_jid("551199999999@s.whatsapp.net") == "551199999999"
    # Group JID
    assert contact_phone_from_remote_jid("120363123456789@g.us") == "120363123456789@g.us"
    # Linked ID (LID)
    assert contact_phone_from_remote_jid("551199999999:2@s.whatsapp.net") == "551199999999"
    # Empty
    assert contact_phone_from_remote_jid("") == ""
    assert contact_phone_from_remote_jid(None) == ""

@pytest.mark.asyncio
async def test_process_webhook_unknown_event(db_session):
    payload = {"event": "unknown.event", "data": {}}
    event = await WebhookService.process_webhook(db_session, "conn_id", payload)
    
    # Should record the event and mark as processed without error
    assert event.event_type == "unknown.event"
    assert event.processed is True
    assert event.error is None

@pytest.fixture
def webhook_setup(db_session, workspace_seed):
    workspace_id = workspace_seed["workspace_id"]
    inbox = Inbox(workspace_id=workspace_id, name="Test Webhook Inbox", channel_type="whatsapp")
    db_session.add(inbox)
    db_session.flush()

    connection = Connection(
        id="conn_abc123",
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        name="Webhook Connection",
        provider="evolution_api",
        instance_name="webhook_instance",
        base_url="http://localhost:8080",
        api_key="key",
        status="connected"
    )
    db_session.add(connection)
    
    contact = Contact(
        workspace_id=workspace_id,
        name="John Customer",
        phone="551199999999"
    )
    db_session.add(contact)
    db_session.flush()
    
    conversation = Conversation(
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        contact_id=contact.id,
        status="pending"
    )
    db_session.add(conversation)
    
    db_session.commit()
    db_session.refresh(connection)
    return connection

@pytest.mark.asyncio
@patch("app.services.webhook_service.socket_manager.broadcast", new_callable=AsyncMock)
@patch("app.services.webhook_service.ConversationVisibilityService.broadcast_to_allowed_agents", new_callable=AsyncMock)
async def test_handle_presence_update(mock_vis_broadcast, mock_ws_broadcast, db_session, webhook_setup):
    payload = {
        "event": "presence.update",
        "data": {
            "id": "551199999999@s.whatsapp.net",
            "presences": {
                "551199999999@s.whatsapp.net": {
                    "lastKnownPresence": "composing"
                }
            }
        }
    }
    
    await WebhookService._handle_presence_update(db_session, webhook_setup.id, payload)
    
    # Should emit WS event TYPING_STATUS
    mock_vis_broadcast.assert_called_once()
    args, kwargs = mock_vis_broadcast.call_args
    assert args[2]["type"] == "TYPING_STATUS"
    assert args[2]["data"]["is_typing"] is True
    assert "contact_id" in args[2]["data"]

@pytest.mark.asyncio
@patch("app.services.webhook_service.socket_manager.broadcast", new_callable=AsyncMock)
@patch("app.services.webhook_service.ConversationVisibilityService.broadcast_to_allowed_agents", new_callable=AsyncMock)
async def test_handle_message_upsert_group_ignored(mock_vis_broadcast, mock_ws_broadcast, db_session, webhook_setup):
    payload = {
        "event": "messages.upsert",
        "data": {
            "key": {
                "remoteJid": "120363123456789@g.us"
            }
        }
    }
    
    # Group messages should be ignored
    await WebhookService._handle_message_upsert(db_session, webhook_setup.id, payload)
    mock_ws_broadcast.assert_not_called()
    mock_vis_broadcast.assert_not_called()
