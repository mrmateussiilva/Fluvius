import pytest
from unittest.mock import patch, AsyncMock
from app.models.contact import Contact
from app.models.inbox import Inbox
from app.models.connection import Connection
from app.models.conversation import Conversation
from app.models.agent import Agent

@pytest.fixture
def conversation_setup(db_session, workspace_seed):
    workspace_id = workspace_seed["workspace_id"]
    
    inbox = Inbox(workspace_id=workspace_id, name="Test Inbox", channel_type="whatsapp")
    db_session.add(inbox)
    db_session.flush()

    connection = Connection(
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        name="Test Conn",
        provider="evolution_api",
        instance_name="test_inst",
        base_url="http://localhost:8080",
        api_key="key",
        status="connected"
    )
    db_session.add(connection)
    
    contact = Contact(
        workspace_id=workspace_id,
        name="John Customer",
        phone="5511999999999@s.whatsapp.net"
    )
    db_session.add(contact)
    db_session.flush()
    
    conversation = Conversation(
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        contact_id=contact.id,
        status="pending",
        unread_count=0
    )
    db_session.add(conversation)
    db_session.commit()
    
    return {
        "inbox": inbox,
        "connection": connection,
        "contact": contact,
        "conversation": conversation
    }

def test_get_conversations(client, auth_headers, conversation_setup):
    response = client.get("/api/conversations", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == conversation_setup["conversation"].id
    
    # Test with status filter
    response = client.get("/api/conversations?status=resolved", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 0

def test_get_conversations_operator_visibility(client, db_session, workspace_seed, conversation_setup):
    # Create operator agent
    operator = Agent(
        workspace_id=workspace_seed["workspace_id"],
        name="Operator",
        email="op@test.com",
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
    
    # Operator sees pending conversations
    response = client.get("/api/conversations", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1
    
    # Mark conversation as resolved
    conversation = conversation_setup["conversation"]
    conversation.status = "resolved"
    db_session.commit()
    
    # Operator should not see resolved conversation unless assigned to them
    response = client.get("/api/conversations", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 0
    
    # Assign to operator
    conversation.assignee_id = operator.id
    db_session.commit()
    
    # Operator should now see it
    response = client.get("/api/conversations", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1

@patch("app.api.routes.conversations.EvolutionService.send_text_message", new_callable=AsyncMock)
@patch("app.api.routes.conversations.socket_manager.broadcast", new_callable=AsyncMock)
def test_start_conversation(mock_broadcast, mock_send, client, auth_headers, conversation_setup):
    payload = {
        "phone": "5511888888888",
        "name": "New Contact",
        "inbox_id": conversation_setup["inbox"].id
    }
    
    response = client.post("/api/conversations/start", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "open"
    assert data["contact"]["phone"] == "5511888888888"

def test_assign_conversation(client, auth_headers, conversation_setup, workspace_seed):
    conv_id = conversation_setup["conversation"].id
    payload = {"agent_id": workspace_seed["agent_id"]}
    
    response = client.patch(f"/api/conversations/{conv_id}/assign", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "open"
    assert data["assignee"]["id"] == workspace_seed["agent_id"]

def test_resolve_conversation(client, auth_headers, conversation_setup):
    conv_id = conversation_setup["conversation"].id
    response = client.patch(f"/api/conversations/{conv_id}/resolve", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "resolved"

@patch("app.api.routes.conversations.EvolutionService.send_read_receipt", new_callable=AsyncMock)
def test_read_conversation(mock_send, client, auth_headers, conversation_setup, db_session):
    from app.models.message import Message
    conv_id = conversation_setup["conversation"].id
    
    # Add a mock inbound message
    msg = Message(
        workspace_id=conversation_setup["inbox"].workspace_id,
        conversation_id=conv_id,
        contact_id=conversation_setup["contact"].id,
        direction="inbound",
        message_type="text",
        content="test",
        external_message_id="ext123"
    )
    db_session.add(msg)
    
    conversation_setup["conversation"].unread_count = 5
    db_session.commit()
    
    response = client.patch(f"/api/conversations/{conv_id}/read", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["unread_count"] == 0

def test_pending_conversation(client, auth_headers, conversation_setup):
    conv_id = conversation_setup["conversation"].id
    response = client.patch(f"/api/conversations/{conv_id}/pending", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["status"] == "pending"
    assert response.json()["assignee_id"] is None
