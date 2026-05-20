import pytest
from app.models.quick_reply import QuickReply

@pytest.fixture
def quick_reply_setup(db_session, workspace_seed):
    qr = QuickReply(
        workspace_id=workspace_seed["workspace_id"],
        shortcut="hello",
        content="Hello, how can I help?"
    )
    db_session.add(qr)
    db_session.commit()
    db_session.refresh(qr)
    return qr

def test_get_quick_replies(client, auth_headers, quick_reply_setup):
    response = client.get("/api/quick-replies", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["shortcut"] == "hello"
    assert data[0]["content"] == "Hello, how can I help?"

def test_create_quick_reply(client, auth_headers):
    payload = {
        "shortcut": "/bye",
        "content": "Goodbye!"
    }
    response = client.post("/api/quick-replies", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # It should strip the leading slash
    assert data["shortcut"] == "bye"
    assert data["content"] == "Goodbye!"

def test_update_quick_reply(client, auth_headers, quick_reply_setup):
    payload = {
        "shortcut": "/hi",
        "content": "Hi there!"
    }
    response = client.put(f"/api/quick-replies/{quick_reply_setup.id}", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["shortcut"] == "hi"
    assert data["content"] == "Hi there!"

def test_delete_quick_reply(client, auth_headers, quick_reply_setup):
    response = client.delete(f"/api/quick-replies/{quick_reply_setup.id}", headers=auth_headers)
    assert response.status_code == 200
    
    response = client.get("/api/quick-replies", headers=auth_headers)
    assert len(response.json()) == 0
