import pytest
from app.models.queue import Queue
from app.models.agent import Agent

@pytest.fixture
def queue_setup(db_session, workspace_seed):
    queue = Queue(
        workspace_id=workspace_seed["workspace_id"],
        name="Support",
        description="General Support"
    )
    db_session.add(queue)
    db_session.commit()
    db_session.refresh(queue)
    return queue

def test_get_queues(client, auth_headers, queue_setup):
    response = client.get("/api/queues", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Support"

def test_create_queue(client, auth_headers):
    payload = {
        "name": "Sales",
        "description": "Sales team"
    }
    response = client.post("/api/queues", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Sales"
    assert data["description"] == "Sales team"

def test_create_queue_not_admin(client, db_session, workspace_seed):
    operator = Agent(
        workspace_id=workspace_seed["workspace_id"],
        name="Operator",
        email="operator2@test.com",
        role="agent",
        hashed_password="hash"
    )
    db_session.add(operator)
    db_session.commit()
    db_session.refresh(operator)
    
    from app.core.auth import create_access_token
    token = create_access_token({"sub": operator.id, "type": "agent"})
    headers = {"Authorization": f"Bearer {token}"}
    
    payload = {"name": "Test"}
    response = client.post("/api/queues", json=payload, headers=headers)
    assert response.status_code == 403

def test_update_queue(client, auth_headers, queue_setup):
    payload = {"name": "Support v2"}
    response = client.put(f"/api/queues/{queue_setup.id}", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Support v2"

def test_delete_queue(client, auth_headers, queue_setup):
    response = client.delete(f"/api/queues/{queue_setup.id}", headers=auth_headers)
    assert response.status_code == 200
    
    response = client.get("/api/queues", headers=auth_headers)
    assert len(response.json()) == 0

def test_queue_agents(client, auth_headers, queue_setup, workspace_seed):
    # Empty initially
    response = client.get(f"/api/queues/{queue_setup.id}/agents", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 0
    
    # Add agent
    payload = {"agent_ids": [workspace_seed["agent_id"]]}
    response = client.post(f"/api/queues/{queue_setup.id}/agents", json=payload, headers=auth_headers)
    assert response.status_code == 200
    
    # Check again
    response = client.get(f"/api/queues/{queue_setup.id}/agents", headers=auth_headers)
    assert len(response.json()) == 1
    assert response.json()[0] == workspace_seed["agent_id"]
