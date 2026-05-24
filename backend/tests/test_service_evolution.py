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


@pytest.mark.asyncio
@patch("app.services.evolution_service._request", new_callable=AsyncMock)
async def test_get_base64_from_media_message_sends_evolution_payload(mock_request):
    mock_response = MagicMock()
    mock_response.json.return_value = {"base64": "YmFzZTY0"}
    mock_response.raise_for_status.return_value = None
    mock_request.return_value = mock_response

    result = await EvolutionService.get_base64_from_media_message(
        base_url="http://localhost",
        api_key="key",
        instance_name="inst",
        message={"key": {"id": "MSG123"}},
        convert_to_mp4=True,
    )

    assert result == "YmFzZTY0"
    mock_request.assert_called_once()
    args, kwargs = mock_request.call_args
    assert args[:2] == ("post", "http://localhost/chat/getBase64FromMediaMessage/inst")
    assert kwargs["json"] == {
        "message": {"key": {"id": "MSG123"}},
        "convertToMp4": True,
    }
