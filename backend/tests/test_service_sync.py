import pytest
from unittest.mock import patch, AsyncMock
from app.services.sync_service import is_whatsapp_chat_jid, contact_phone_from_jid, sync_chat_record
from app.models.connection import Connection
from app.models.inbox import Inbox

def test_is_whatsapp_chat_jid():
    assert is_whatsapp_chat_jid("5511999999999@s.whatsapp.net") is True
    assert is_whatsapp_chat_jid("120363123456789@g.us") is True
    assert is_whatsapp_chat_jid("5511999999999@c.us") is True
    assert is_whatsapp_chat_jid("5511999999999") is True
    assert is_whatsapp_chat_jid(None) is False
    assert is_whatsapp_chat_jid("") is False
    assert is_whatsapp_chat_jid("invalid_string_without_at") is False

def test_contact_phone_from_jid():
    assert contact_phone_from_jid("5511999999999@s.whatsapp.net") == "5511999999999"
    assert contact_phone_from_jid("120363123456789@g.us") == "120363123456789@g.us"
    assert contact_phone_from_jid("5511999999999:2@s.whatsapp.net") == "5511999999999"
    assert contact_phone_from_jid(None) == ""
    assert contact_phone_from_jid("") == ""

@pytest.mark.asyncio
@patch("app.services.sync_service.EvolutionService.fetch_profile_picture_url", new_callable=AsyncMock)
async def test_sync_chat_record_new_contact_and_conversation(mock_fetch_pic, db_session, workspace_seed):
    workspace_id = workspace_seed["workspace_id"]
    inbox = Inbox(workspace_id=workspace_id, name="Test Inbox", channel_type="whatsapp")
    db_session.add(inbox)
    db_session.flush()

    conn = Connection(
        id="conn_sync",
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        name="Conn",
        provider="evolution_api",
        instance_name="inst",
        base_url="http://localhost",
        api_key="key",
        status="connected"
    )
    db_session.add(conn)
    db_session.commit()
    
    mock_fetch_pic.return_value = "http://avatar.url"
    
    chat_data = {
        "remoteJid": "5511888888888@s.whatsapp.net",
        "pushName": "New Contact Sync"
    }
    
    success, msgs_synced = await sync_chat_record(db_session, conn, chat_data)
    assert success is True
    assert msgs_synced == 0
    
    from app.models.contact import Contact
    contact = db_session.query(Contact).filter(Contact.phone == "5511888888888").first()
    assert contact is not None
    assert contact.name == "New Contact Sync"
    assert contact.avatar_url == "http://avatar.url"
    
    from app.models.conversation import Conversation
    conv = db_session.query(Conversation).filter(Conversation.contact_id == contact.id).first()
    assert conv is not None
    assert conv.external_id == "5511888888888@s.whatsapp.net"

@pytest.mark.asyncio
async def test_sync_chat_record_invalid_jid(db_session):
    conn = Connection() # dummy
    success, msgs_synced = await sync_chat_record(db_session, conn, {"remoteJid": "invalid"})
    assert success is False
    assert msgs_synced == 0
