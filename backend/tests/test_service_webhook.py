import pytest
from unittest.mock import patch, AsyncMock
from sqlalchemy.exc import IntegrityError
from app.services.webhook_service import WebhookService, contact_phone_from_remote_jid, normalize_evolution_event
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


def test_normalize_evolution_event_aliases():
    assert normalize_evolution_event("MESSAGES_UPSERT") == "messages.upsert"
    assert normalize_evolution_event("messages.update") == "messages.update"
    assert normalize_evolution_event("CONNECTION_UPDATE") == "connection.update"
    assert normalize_evolution_event("send_message") == "send.message"
    assert normalize_evolution_event(None) == "unknown"


@pytest.mark.asyncio
async def test_process_webhook_accepts_uppercase_evolution_event(db_session):
    payload = {"event": "MESSAGES_UPSERT", "data": {}}
    with patch.object(WebhookService, "_handle_message_upsert", new_callable=AsyncMock) as handler:
        event = await WebhookService.process_webhook(db_session, "conn_id", payload)

    assert event.event_type == "messages.upsert"
    assert event.processed is True
    handler.assert_awaited_once_with(db_session, "conn_id", payload)

@pytest.mark.asyncio
async def test_process_webhook_unknown_event(db_session):
    payload = {"event": "unknown.event", "data": {}}
    event = await WebhookService.process_webhook(db_session, "conn_id", payload)
    
    # Should record the event and mark as processed without error
    assert event.event_type == "unknown.event"
    assert event.processed is True
    assert event.error is None


def test_message_external_id_is_unique_per_conversation(db_session, webhook_setup):
    from app.models.message import Message

    conversation = db_session.query(Conversation).filter(
        Conversation.inbox_id == webhook_setup.inbox_id
    ).first()

    first = Message(
        workspace_id=webhook_setup.workspace_id,
        conversation_id=conversation.id,
        contact_id=conversation.contact_id,
        direction="inbound",
        message_type="text",
        content="first",
        external_message_id="DUPLICATE_EXTERNAL_ID",
        status="received",
    )
    db_session.add(first)
    db_session.commit()

    second = Message(
        workspace_id=webhook_setup.workspace_id,
        conversation_id=conversation.id,
        contact_id=conversation.contact_id,
        direction="inbound",
        message_type="text",
        content="second",
        external_message_id="DUPLICATE_EXTERNAL_ID",
        status="received",
    )
    db_session.add(second)

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

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


@pytest.mark.asyncio
@patch("app.services.webhook_service.socket_manager.broadcast", new_callable=AsyncMock)
@patch("app.services.webhook_service.ConversationVisibilityService.broadcast_to_allowed_agents", new_callable=AsyncMock)
async def test_handle_ephemeral_and_view_once_messages(mock_vis_broadcast, mock_ws_broadcast, db_session, webhook_setup):
    from app.models.message import Message

    # 1. Test Ephemeral Message containing text
    ephemeral_payload = {
        "event": "messages.upsert",
        "data": {
            "key": {
                "id": "EPHEMERAL_TXT_ID",
                "remoteJid": "551199999999@s.whatsapp.net",
                "fromMe": False
            },
            "message": {
                "ephemeralMessage": {
                    "message": {
                        "conversation": "This is an ephemeral message content"
                    }
                }
            }
        }
    }

    await WebhookService._handle_message_upsert(db_session, webhook_setup.id, ephemeral_payload)

    msg = db_session.query(Message).filter(Message.external_message_id == "EPHEMERAL_TXT_ID").first()
    assert msg is not None
    assert msg.message_type == "text"
    assert msg.content == "This is an ephemeral message content"

    # 2. Test View Once Image message
    view_once_payload = {
        "event": "messages.upsert",
        "data": {
            "key": {
                "id": "VIEW_ONCE_IMG_ID",
                "remoteJid": "551199999999@s.whatsapp.net",
                "fromMe": False
            },
            "message": {
                "viewOnceMessage": {
                    "message": {
                        "imageMessage": {
                            "mimetype": "image/jpeg",
                            "caption": "Only look once"
                        }
                    }
                }
            }
        }
    }

    await WebhookService._handle_message_upsert(db_session, webhook_setup.id, view_once_payload)

    msg_img = db_session.query(Message).filter(Message.external_message_id == "VIEW_ONCE_IMG_ID").first()
    assert msg_img is not None
    assert msg_img.message_type == "image"
    assert msg_img.content == "Only look once"


@pytest.mark.asyncio
@patch("app.services.webhook_service.socket_manager.broadcast", new_callable=AsyncMock)
@patch("app.services.webhook_service.ConversationVisibilityService.broadcast_to_allowed_agents", new_callable=AsyncMock)
async def test_handle_sticker_and_interactive_messages(mock_vis_broadcast, mock_ws_broadcast, db_session, webhook_setup):
    from app.models.message import Message

    # 1. Sticker Message
    sticker_payload = {
        "event": "messages.upsert",
        "data": {
            "key": {
                "id": "STICKER_MSG_ID",
                "remoteJid": "551199999999@s.whatsapp.net",
                "fromMe": False
            },
            "message": {
                "stickerMessage": {
                    "mimetype": "image/webp",
                    "url": "https://whatsapp.cdn/sticker"
                }
            }
        }
    }

    await WebhookService._handle_message_upsert(db_session, webhook_setup.id, sticker_payload)
    msg_stk = db_session.query(Message).filter(Message.external_message_id == "STICKER_MSG_ID").first()
    assert msg_stk is not None
    assert msg_stk.message_type == "image"
    assert msg_stk.mime_type == "image/webp"

    # 2. Interactive Message (buttons etc)
    interactive_payload = {
        "event": "messages.upsert",
        "data": {
            "key": {
                "id": "INTERACTIVE_MSG_ID",
                "remoteJid": "551199999999@s.whatsapp.net",
                "fromMe": False
            },
            "message": {
                "interactiveMessage": {
                    "body": {
                        "text": "Please choose an option"
                    }
                }
            }
        }
    }

    await WebhookService._handle_message_upsert(db_session, webhook_setup.id, interactive_payload)
    msg_int = db_session.query(Message).filter(Message.external_message_id == "INTERACTIVE_MSG_ID").first()
    assert msg_int is not None
    assert msg_int.message_type == "text"
    assert msg_int.content == "Please choose an option"
