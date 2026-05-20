import pytest
from unittest.mock import patch, MagicMock
from app.services.ai_service import GeminiProvider, AIService
from app.models.conversation import Conversation
from app.models.contact import Contact
from app.models.message import Message

def test_gemini_provider_generate_suggestion():
    with patch("google.genai.Client") as MockClient:
        mock_client_instance = MockClient.return_value
        mock_response = MagicMock()
        mock_response.text = "Hello, this is AI."
        mock_client_instance.models.generate_content.return_value = mock_response
        
        provider = GeminiProvider("fake_key")
        result = provider.generate_suggestion("Test prompt")
        assert result == "Hello, this is AI."

def test_ai_service_suggest_reply(db_session, workspace_seed):
    workspace_id = workspace_seed["workspace_id"]
    
    contact = Contact(workspace_id=workspace_id, phone="5511999999999", name="Test")
    db_session.add(contact)
    db_session.commit()
    
    conversation = Conversation(
        workspace_id=workspace_id,
        inbox_id="inbox1",
        contact_id=contact.id
    )
    db_session.add(conversation)
    db_session.commit()
    
    msg = Message(
        workspace_id=workspace_id,
        conversation_id=conversation.id,
        contact_id=contact.id,
        direction="inbound",
        message_type="text",
        content="Preciso de ajuda"
    )
    db_session.add(msg)
    db_session.commit()
    
    with patch("app.services.ai_service.GeminiProvider.generate_suggestion") as mock_gen:
        mock_gen.return_value = "Opção 1\nOpção 2"
        
        with patch("app.core.config.settings.GEMINI_API_KEY", "fake"):
            suggestions = AIService.suggest_reply(db_session, conversation.id)
            assert len(suggestions) > 0

def test_ai_service_summarize_conversation(db_session, workspace_seed):
    workspace_id = workspace_seed["workspace_id"]
    
    contact = Contact(workspace_id=workspace_id, phone="5511999999999", name="Test")
    db_session.add(contact)
    db_session.commit()
    
    conversation = Conversation(
        workspace_id=workspace_id,
        inbox_id="inbox1",
        contact_id=contact.id
    )
    db_session.add(conversation)
    db_session.commit()
    
    msg = Message(
        workspace_id=workspace_id,
        conversation_id=conversation.id,
        contact_id=contact.id,
        direction="inbound",
        message_type="text",
        content="Resumo"
    )
    db_session.add(msg)
    db_session.commit()
    
    with patch("app.services.ai_service.GeminiProvider.generate_suggestion") as mock_gen:
        mock_gen.return_value = "O cliente precisa de ajuda com resumo."
        
        with patch("app.core.config.settings.GEMINI_API_KEY", "fake"):
            summary = AIService.summarize_conversation(db_session, conversation.id)
            assert summary == "O cliente precisa de ajuda com resumo."
