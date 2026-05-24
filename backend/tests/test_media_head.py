import pytest

def test_media_head_request(client):
    # Send a HEAD request to an ID that doesn't exist
    response = client.head("/api/media/nonexistent-id")
    print(f"HEAD STATUS CODE: {response.status_code}")
    print(f"HEAD HEADERS: {response.headers}")
    assert response.status_code in [404, 405]
