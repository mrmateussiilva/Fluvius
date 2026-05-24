import os
import base64
import pytest
from pathlib import Path
from unittest.mock import patch, AsyncMock

from app.models.media import Media
from app.models.message import Message
from app.models.workspace import Workspace
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.inbox import Inbox
from app.models.connection import Connection
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


@pytest.mark.asyncio
async def test_download_message_media_uses_evolution_message_envelope(db_session, tmp_path):
    workspace = Workspace(id="ws-media", name="Workspace", slug="ws-media")
    contact = Contact(id="contact-media", workspace_id=workspace.id, phone="5511999999999")
    inbox = Inbox(id="inbox-media", workspace_id=workspace.id, name="Inbox", channel_type="whatsapp")
    connection = Connection(
        id="conn-media",
        workspace_id=workspace.id,
        inbox_id=inbox.id,
        name="Evolution",
        provider="evolution_api",
        instance_name="inst",
        base_url="http://evolution.local",
        api_key="secret",
        status="online",
    )
    conversation = Conversation(
        id="conv-media",
        workspace_id=workspace.id,
        inbox_id=inbox.id,
        contact_id=contact.id,
    )
    message = Message(
        id="msg-media",
        workspace_id=workspace.id,
        conversation_id=conversation.id,
        contact_id=contact.id,
        direction="inbound",
        message_type="image",
        content="Imagem",
        media_url="/api/media/media-download",
        mime_type="image/jpeg",
        raw_payload={
            "data": {
                "key": {
                    "id": "EVOLUTION_MSG_ID",
                    "remoteJid": "5511999999999@s.whatsapp.net",
                    "fromMe": False,
                },
                "message": {
                    "imageMessage": {
                        "mimetype": "image/jpeg",
                        "url": "https://mmg.whatsapp.net/media.enc",
                    }
                },
            }
        },
    )
    media = Media(
        id="media-download",
        message_id=message.id,
        media_type="image",
        mime_type="image/jpeg",
        downloaded=False,
        failed=False,
    )

    db_session.add_all([workspace, contact, inbox, connection, conversation, message, media])
    db_session.commit()

    encoded = base64.b64encode(b"image data").decode()
    with patch("app.services.media_service.UPLOADS_DIR", tmp_path), patch(
        "app.services.media_service.EvolutionService.get_base64_from_media_message",
        new_callable=AsyncMock,
        return_value=encoded,
    ) as mock_get_base64:
        await MediaDownloadService.download_message_media(db_session, message.id)

    mock_get_base64.assert_awaited_once()
    _, kwargs = mock_get_base64.call_args
    assert kwargs["message"]["key"]["id"] == "EVOLUTION_MSG_ID"
    assert "imageMessage" in kwargs["message"]["message"]
    assert kwargs["convert_to_mp4"] is False

    db_session.refresh(media)
    db_session.refresh(message)
    assert media.downloaded is True
    assert media.failed is False
    assert media.file_path
    assert (tmp_path / "images" / Path(media.file_path).name).exists()
    assert message.media_url == "/api/media/media-download"


def test_get_contact_avatar_proxy(client, db_session):
    from app.models.contact import Contact
    contact_id = "contact-avatar-proxy-test"
    
    # Cria um contato com avatar_url externo
    contact = Contact(
        id=contact_id,
        workspace_id="ws-123",
        name="Test Contact Avatar",
        phone="5511999999999",
        avatar_url="http://whatsapp-cdn.net/profile.jpg"
    )
    db_session.add(contact)
    db_session.commit()

    mock_response = type("MockResponse", (), {})()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "image/jpeg"}
    mock_response.content = b"avatar image"

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock, return_value=mock_response) as mock_get:
        response = client.get(f"/api/media/avatar/{contact_id}", follow_redirects=False)

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.content == b"avatar image"
    mock_get.assert_called_once_with("http://whatsapp-cdn.net/profile.jpg")


def test_get_contact_avatar_not_found_is_fast_and_cacheable(client, db_session):
    from app.models.contact import Contact
    from app.models.conversation import Conversation
    from app.models.inbox import Inbox
    from app.models.connection import Connection

    # Configura banco com os dados necessários
    contact = Contact(
        id="contact-avatar-bg-test",
        workspace_id="ws-123",
        name="Test Contact Avatar BG",
        phone="5511999999998",
        avatar_url=None
    )
    db_session.add(contact)
    
    inbox = Inbox(
        id="inbox-avatar-test",
        workspace_id="ws-123",
        name="Test Inbox",
        channel_type="whatsapp"
    )
    db_session.add(inbox)
    db_session.flush()
    
    conversation = Conversation(
        id="conv-avatar-test",
        workspace_id="ws-123",
        contact_id=contact.id,
        inbox_id=inbox.id,
        status="open"
    )
    db_session.add(conversation)
    
    connection = Connection(
        id="conn-avatar-test",
        workspace_id="ws-123",
        inbox_id=inbox.id,
        name="Test Conn",
        provider="evolution",
        status="connected",
        base_url="http://evolution-api",
        api_key="api-key-123",
        instance_name="instance-123"
    )
    db_session.add(connection)
    db_session.commit()

    with patch("app.api.routes.media.fetch_and_download_avatar_task", new_callable=AsyncMock) as mock_fetch_task:
        response = client.get("/api/media/avatar/contact-avatar-bg-test")

        # Como o arquivo físico não existe e não há avatar_url externo, retorna 404 cacheável
        # sem acionar download em background a partir de request de imagem do browser.
        assert response.status_code == 404
        assert response.json()["detail"] == "Avatar não disponível"
        assert "max-age" in response.headers["cache-control"]
        mock_fetch_task.assert_not_called()
