def test_media_head_request(client):
    # Send a HEAD request to an ID that doesn't exist
    response = client.head("/api/media/nonexistent-id")
    assert response.status_code == 404


def test_media_head_pending(client, db_session):
    from app.models.media import Media

    media = Media(
        id="media-head-pending",
        message_id="msg-head-pending",
        media_type="audio",
        mime_type="audio/ogg",
        downloaded=False,
        failed=False,
    )
    db_session.add(media)
    db_session.commit()

    response = client.head("/api/media/media-head-pending")
    assert response.status_code == 202


def test_media_head_failed(client, db_session):
    from app.models.media import Media

    media = Media(
        id="media-head-failed",
        message_id="msg-head-failed",
        media_type="audio",
        mime_type="audio/ogg",
        downloaded=False,
        failed=True,
    )
    db_session.add(media)
    db_session.commit()

    response = client.head("/api/media/media-head-failed")
    assert response.status_code == 410
