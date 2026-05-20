import pytest
from unittest.mock import patch, AsyncMock
from app.services.bot_service import BotService
from app.models.inbox import Inbox
from app.models.conversation import Conversation
from app.models.connection import Connection

@pytest.fixture
def bot_setup(db_session, workspace_seed):
    workspace_id = workspace_seed["workspace_id"]
    
    inbox = Inbox(
        workspace_id=workspace_id, 
        name="Bot Inbox", 
        channel_type="whatsapp",
        default_bot_active=True,
        bot_type="ai",
        ai_instructions="Teste"
    )
    db_session.add(inbox)
    db_session.flush()

    conn = Connection(
        id="conn1",
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        name="Conn",
        provider="evolution_api",
        instance_name="inst1",
        base_url="http://localhost",
        api_key="key",
        status="connected"
    )
    db_session.add(conn)
    
    conversation = Conversation(
        id="conv1",
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        contact_id="contact1",
        status="bot"
    )
    db_session.add(conversation)
    db_session.commit()
    
    return {
        "inbox": inbox,
        "conn": conn,
        "conversation": conversation
    }

@pytest.mark.asyncio
async def test_process_bot_message_no_bot_active(db_session, bot_setup):
    bot_setup["inbox"].default_bot_active = False
    db_session.commit()
    
    await BotService.process_bot_message(
        db_session, 
        bot_setup["conversation"], 
        "oi", 
        bot_setup["inbox"], 
        "551199999999", 
        bot_setup["conn"]
    )
    
    db_session.refresh(bot_setup["conversation"])
    assert bot_setup["conversation"].status == "pending"

@pytest.mark.asyncio
@patch("app.services.bot_service.EvolutionService.send_text_message", new_callable=AsyncMock)
async def test_process_bot_message_ai_transfer_human(mock_send, db_session, bot_setup):
    # message content asks for human
    await BotService.process_bot_message(
        db_session, 
        bot_setup["conversation"], 
        "Quero falar com um atendente", 
        bot_setup["inbox"], 
        "551199999999", 
        bot_setup["conn"]
    )
    
    db_session.refresh(bot_setup["conversation"])
    assert bot_setup["conversation"].status == "pending"
    mock_send.assert_called_once()
    args, kwargs = mock_send.call_args
    assert "Entendido" in kwargs["text"]

@pytest.mark.asyncio
@patch("app.services.bot_service.EvolutionService.send_text_message", new_callable=AsyncMock)
@patch("app.services.bot_service.GeminiProvider.generate_suggestion")
async def test_process_bot_message_ai_response(mock_generate, mock_send, db_session, bot_setup):
    mock_generate.return_value = "Olá, eu sou o bot"
    
    await BotService.process_bot_message(
        db_session, 
        bot_setup["conversation"], 
        "oi", 
        bot_setup["inbox"], 
        "551199999999", 
        bot_setup["conn"]
    )
    
    db_session.refresh(bot_setup["conversation"])
    assert bot_setup["conversation"].status == "bot"
    mock_send.assert_called_once()
    args, kwargs = mock_send.call_args
    assert kwargs["text"] == "Olá, eu sou o bot"
