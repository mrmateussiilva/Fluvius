import pytest
from app.models.contact import Contact

@pytest.fixture
def contact_setup(db_session, workspace_seed):
    contact = Contact(
        workspace_id=workspace_seed["workspace_id"],
        name="Test Contact",
        phone="5511999999999"
    )
    db_session.add(contact)
    db_session.commit()
    return contact

def test_update_contact_tags(client, auth_headers, contact_setup, db_session):
    payload = {
        "tags": [" VIP ", " urgent", "vip", "NEW"]
    }
    
    response = client.patch(f"/api/contacts/{contact_setup.id}/tags", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    
    # Should be normalized: deduplicated (case-insensitive deduplication), stripped, case preserved for output
    assert len(data["tags"]) == 3
    assert "VIP" in data["tags"]
    assert "urgent" in data["tags"]
    assert "NEW" in data["tags"]

def test_update_contact_tags_not_found(client, auth_headers):
    payload = {"tags": ["vip"]}
    response = client.patch("/api/contacts/invalid-id/tags", json=payload, headers=auth_headers)
    assert response.status_code == 404

def test_update_contact_tags_cross_workspace(client, db_session, workspace_seed, contact_setup):
    # Create another workspace and agent
    register_payload = {
        "company_name": "Other Company",
        "agent_name": "Other Admin",
        "email": "other@test.com",
        "password": "securepassword123"
    }
    response = client.post("/api/auth/register", json=register_payload)
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    payload = {"tags": ["vip"]}
    response = client.patch(f"/api/contacts/{contact_setup.id}/tags", json=payload, headers=headers)
    assert response.status_code == 404
