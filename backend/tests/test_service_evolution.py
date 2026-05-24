import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from app.services.evolution_service import EvolutionService

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_evolution_send_text_message(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"messageId": "123"}
    mock_post.return_value = mock_response
    
    response = await EvolutionService.send_text_message(
        base_url="http://localhost",
        api_key="key",
        instance_name="inst",
        phone="5511999999999",
        text="Hello"
    )
    
    assert response["messageId"] == "123"
    mock_post.assert_called_once()
    args, kwargs = mock_post.call_args
    assert kwargs["json"]["number"] == "5511999999999"
    assert kwargs["json"]["text"] == "Hello"

@pytest.mark.asyncio
@patch("httpx.AsyncClient.post", new_callable=AsyncMock)
async def test_evolution_send_media_message(mock_post):
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"messageId": "456"}
    mock_post.return_value = mock_response
    
    response = await EvolutionService.send_media_message(
        base_url="http://localhost",
        api_key="key",
        instance_name="inst",
        phone="5511999999999",
        media="base64data",
        media_type="image",
        mimetype="image/jpeg",
        caption="Image"
    )
    
    assert response["messageId"] == "456"
    mock_post.assert_called_once()
    args, kwargs = mock_post.call_args
    assert kwargs["json"]["number"] == "5511999999999"
    assert kwargs["json"]["mediatype"] == "image"
