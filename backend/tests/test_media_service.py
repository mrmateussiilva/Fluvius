import os
import pytest
from pathlib import Path
from unittest.mock import patch, AsyncMock

from app.models.media import Media
from app.models.message import Message
from app.services.media_service import MediaDownloadService


def test_ensure_directories(tmp_path):
    with patch("app.services.media_service.UPLOADS_DIR", tmp_path):
        MediaDownloadService.ensure_directories()
        for sub in ["audio", "images", "video", "documents", "avatars"]:
            assert (tmp_path / sub).exists()


def test_get_media_file_not_found(client, db_session):
    # Rota GET /api/media/{media_id} retorna 404 para ID inexistente
    response = client.get("/api/media/nonexistent-id")
    assert response.status_code == 404
    assert response.json()["detail"] == "Mídia não encontrada"


def test_get_media_file_success(client, db_session, tmp_path):
    # Cria registro mockado de mídia baixada
    test_file = tmp_path / "test.png"
    test_file.write_bytes(b"image data")

    media = Media(
        id="media-test-123",
        message_id="msg-test-123",
        media_type="image",
        mime_type="image/png",
        file_path=f"/{test_file}",
        downloaded=True,
        failed=False
    )
    db_session.add(media)
    db_session.commit()

    # Stub uploads dir logic to read absolute path
    with patch("app.api.routes.media.Path") as mock_path:
        mock_path.return_value = Path(str(test_file))
        response = client.get("/api/media/media-test-123")
        assert response.status_code == 200
        assert response.content == b"image data"


@pytest.mark.asyncio
async def test_get_media_file_autocure(client, db_session):
    # Cria uma mensagem do tipo imagem antiga sem registro Media correspondente
    message = Message(
        id="msg-legacy-456",
        workspace_id="ws-123",
        conversation_id="conv-123",
        contact_id="contact-123",
        direction="inbound",
        message_type="image",
        content="Imagem Legada",
        media_url="http://whatsapp/legacy.jpg",
        mime_type="image/jpeg"
    )
    db_session.add(message)
    db_session.commit()

    # Mocka o método de download em background para não bater na rede/Evolution API real
    with patch("app.api.routes.media.MediaDownloadService.download_message_media", new_callable=AsyncMock) as mock_download:
        response = client.get("/api/media/msg-legacy-456")
        
        # Como o arquivo físico não existe, a rota vai iniciar download em background e retornar 202
        assert response.status_code == 202
        
        # O download deve ter sido escalado em background
        mock_download.assert_called_once()

    # Verifica se o registro Media foi inserido no banco de dados com sucesso pelo fluxo de autocura
    media = db_session.query(Media).filter(Media.message_id == "msg-legacy-456").first()
    assert media is not None
    assert media.media_type == "image"
    assert media.downloaded is False
