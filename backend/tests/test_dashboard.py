import pytest
from datetime import datetime, timedelta, timezone
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.connection import Connection
from app.models.inbox import Inbox

@pytest.fixture
def dashboard_setup(db_session, workspace_seed):
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
        base_url="http://localhost",
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
    
    now = datetime.now(timezone.utc)
    
    conversation = Conversation(
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        contact_id=contact.id,
        status="resolved",
        unread_count=2,
        assignee_id=workspace_seed["agent_id"],
        created_at=now - timedelta(days=2),
        resolved_at=now,
        last_message_at=now - timedelta(hours=1)
    )
    db_session.add(conversation)
    db_session.flush()
    
    # Inbound message
    msg1 = Message(
        workspace_id=workspace_id,
        conversation_id=conversation.id,
        contact_id=contact.id,
        direction="inbound",
        message_type="text",
        content="Isso é urgente!",
        created_at=now - timedelta(days=1)
    )
    db_session.add(msg1)
    
    # Outbound message
    msg2 = Message(
        workspace_id=workspace_id,
        conversation_id=conversation.id,
        contact_id=contact.id,
        direction="outbound",
        message_type="text",
        content="Resolvido",
        created_at=now - timedelta(hours=23)
    )
    db_session.add(msg2)
    
    db_session.commit()
    return workspace_id

def test_get_dashboard_admin(client, auth_headers, dashboard_setup):
    response = client.get("/api/dashboard", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    
    # Totals
    assert data["totals"]["contacts"] == 1
    assert data["totals"]["conversations"] == 1
    assert data["totals"]["unread"] == 2
    
    # Messages
    assert data["messages"]["total"] == 2
    assert data["messages"]["inbound"] == 1
    assert data["messages"]["outbound"] == 1
    
    # Agents
    assert len(data["agents"]) >= 1
    
    # Recent Conversations
    assert len(data["recent_conversations"]) == 1
    assert data["recent_conversations"][0]["contact_name"] == "John Customer"
    
    # Connections
    assert len(data["connections"]) == 1
    assert data["connections"][0]["status"] == "connected"
    
    # SLA
    assert data["sla"]["avg_resolution_minutes"] > 0
    assert data["sla"]["avg_response_minutes"] > 0
    
    # Sentiment
    assert data["sentiments"]["URGENT"] == 1

def test_get_dashboard_non_admin(client, db_session, workspace_seed):
    from app.models.agent import Agent
    operator = Agent(
        workspace_id=workspace_seed["workspace_id"],
        name="Op",
        email="op@test.com",
        role="agent",
        hashed_password="hash"
    )
    db_session.add(operator)
    db_session.commit()
    db_session.refresh(operator)
    
    from app.core.auth import create_access_token
    token = create_access_token({"sub": operator.id, "type": "agent"})
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.get("/api/dashboard", headers=headers)
    assert response.status_code == 403
