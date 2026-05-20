import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, AsyncMock
from app.services.copilot_service import (
    CopilotService,
    _detect_intent,
    _minutes_without_response
)

def test_detect_intent():
    assert _detect_intent("Estou com um problema sério") == "complaint"
    assert _detect_intent("Quero cancelar minha assinatura") == "cancellation"
    assert _detect_intent("qual o valor do plano?") == "purchase_intent"
    assert _detect_intent("sistema caiu, urgente") == "urgent_support"
    assert _detect_intent("quero falar com um gerente") == "escalation_request"
    assert _detect_intent("olá bom dia") is None

def test_minutes_without_response():
    # Naive dt
    dt_naive = datetime.utcnow() - timedelta(minutes=5)
    assert 4.5 <= _minutes_without_response(dt_naive) <= 5.5
    
    # Aware dt
    dt_aware = datetime.now(timezone.utc) - timedelta(minutes=10)
    assert 9.5 <= _minutes_without_response(dt_aware) <= 10.5
    
    # None
    assert _minutes_without_response(None) == 0.0

def test_calc_urgency():
    # Negative/Urgent sentiment
    assert CopilotService._calc_urgency("NEGATIVE", None, 0, "inbound") == "high"
    assert CopilotService._calc_urgency("URGENT", None, 2, "inbound") == "critical"
    assert CopilotService._calc_urgency("NEGATIVE", None, 65, "sla_breach") == "critical"
    
    # Neutral/Positive sentiment
    assert CopilotService._calc_urgency("NEUTRAL", None, 0, "inbound") == "low"
    assert CopilotService._calc_urgency("POSITIVE", None, 5, "inbound") == "low"
    assert CopilotService._calc_urgency("NEUTRAL", None, 16, "sla_breach") == "medium"

@patch("app.core.config.settings")
@pytest.mark.asyncio
async def test_analyze_conversation_no_key(mock_settings, db_session):
    mock_settings.GEMINI_API_KEY = None
    
    # Should return safely and early
    result = await CopilotService.analyze_conversation(db_session, "conv_id", "hi", "inbound")
    assert result is None
