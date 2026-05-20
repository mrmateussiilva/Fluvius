import pytest
import os
from unittest.mock import patch, AsyncMock
from app.utils.media import save_base64_to_disk, download_media

def test_save_base64_to_disk(tmp_path):
    # Mocking os.path.join to save in tmp_path
    with patch("app.utils.media.os.path.join", return_value=str(tmp_path / "test.png")):
        result = save_base64_to_disk("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "image/png")
        assert result.startswith("/uploads/")
        assert os.path.exists(tmp_path / "test.png")

@pytest.mark.asyncio
@patch("httpx.AsyncClient.get", new_callable=AsyncMock)
async def test_download_media_success(mock_get, tmp_path):
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.content = b"test content"
    mock_get.return_value = mock_response

    with patch("app.utils.media.os.path.join", return_value=str(tmp_path / "test.mp3")):
        result = await download_media("http://test/audio.mp3", "key", "audio/mpeg")
        assert result.startswith("/uploads/")
        assert os.path.exists(tmp_path / "test.mp3")

@pytest.mark.asyncio
@patch("httpx.AsyncClient.get", new_callable=AsyncMock)
async def test_download_media_failure(mock_get):
    mock_get.side_effect = Exception("Download failed")
    result = await download_media("http://test/fail.mp3", "key", "audio/mpeg")
    assert result == "http://test/fail.mp3"
