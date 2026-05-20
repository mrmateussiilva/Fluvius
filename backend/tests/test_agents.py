import pytest
from app.models.agent import Agent

def test_get_agents(client, auth_headers, workspace_seed):
    response = client.get("/api/agents", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["email"] == "admin@test.com"

def test_create_agent(client, auth_headers):
    payload = {
        "name": "New Agent",
        "email": "new@test.com",
        "password": "pass",
        "role": "agent"
    }
    response = client.post("/api/agents", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "New Agent"
    assert data["email"] == "new@test.com"
    
    # Test duplicate email
    response = client.post("/api/agents", json=payload, headers=auth_headers)
    assert response.status_code == 409

def test_update_agent(client, auth_headers, db_session, workspace_seed):
    # Create target agent
    target = Agent(
        workspace_id=workspace_seed["workspace_id"],
        name="Target",
        email="target@test.com",
        role="agent",
        hashed_password="hash"
    )
    db_session.add(target)
    db_session.commit()
    db_session.refresh(target)
    
    payload = {"name": "Updated Target"}
    response = client.patch(f"/api/agents/{target.id}", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Target"

def test_update_agent_not_admin(client, db_session, workspace_seed):
    # Create operator agent
    operator = Agent(
        workspace_id=workspace_seed["workspace_id"],
        name="Operator",
        email="operator@test.com",
        role="agent",
        hashed_password="hash"
    )
    db_session.add(operator)
    db_session.commit()
    db_session.refresh(operator)
    
    # Login operator
    from app.core.auth import create_access_token
    token = create_access_token({"sub": operator.id, "type": "agent"})
    headers = {"Authorization": f"Bearer {token}"}
    
    payload = {"name": "Hack"}
    response = client.patch(f"/api/agents/{operator.id}", json=payload, headers=headers)
    assert response.status_code == 403

def test_delete_agent(client, auth_headers, db_session, workspace_seed):
    target = Agent(
        workspace_id=workspace_seed["workspace_id"],
        name="ToDelete",
        email="delete@test.com",
        role="agent",
        hashed_password="hash"
    )
    db_session.add(target)
    db_session.commit()
    db_session.refresh(target)
    
    response = client.delete(f"/api/agents/{target.id}", headers=auth_headers)
    assert response.status_code == 200
    
    # Verify deleted
    response = client.get("/api/agents", headers=auth_headers)
    emails = [a["email"] for a in response.json()]
    assert "delete@test.com" not in emails

def test_delete_self(client, auth_headers, workspace_seed):
    response = client.delete(f"/api/agents/{workspace_seed['agent_id']}", headers=auth_headers)
    assert response.status_code == 400
