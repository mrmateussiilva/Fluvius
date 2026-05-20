import pytest
from app.services.visibility_service import ConversationVisibilityService
from app.models.agent import Agent
from app.models.conversation import Conversation
from app.models.queue import Queue
from app.models.workspace import generate_uuid

def test_resolve_agents_no_assignee(db_session, workspace_seed):
    workspace_id = workspace_seed["workspace_id"]
    
    # workspace_seed already creates an admin
    
    # Create conversation
    conv = Conversation(
        id=generate_uuid(),
        workspace_id=workspace_id,
        inbox_id=generate_uuid(),
        contact_id=generate_uuid()
    )
    
    agents = ConversationVisibilityService.resolve_agents(db_session, conv)
    assert len(agents) == 1
    assert agents[0].id == workspace_seed["agent_id"]

def test_resolve_agents_with_operator_assignee(db_session, workspace_seed):
    workspace_id = workspace_seed["workspace_id"]
    
    operator = Agent(
        id=generate_uuid(),
        workspace_id=workspace_id,
        name="Op",
        email="op@test.com",
        role="agent",
        hashed_password="hash"
    )
    db_session.add(operator)
    db_session.commit()
    
    conv = Conversation(
        id=generate_uuid(),
        workspace_id=workspace_id,
        inbox_id=generate_uuid(),
        contact_id=generate_uuid(),
        assignee_id=operator.id
    )
    
    agents = ConversationVisibilityService.resolve_agents(db_session, conv)
    assert len(agents) == 2
    agent_ids = [a.id for a in agents]
    assert workspace_seed["agent_id"] in agent_ids
    assert operator.id in agent_ids

def test_resolve_agents_with_queue(db_session, workspace_seed):
    workspace_id = workspace_seed["workspace_id"]
    
    operator1 = Agent(
        id=generate_uuid(),
        workspace_id=workspace_id,
        name="Op1",
        email="op1@test.com",
        role="agent",
        hashed_password="hash"
    )
    db_session.add(operator1)
    
    queue = Queue(
        id=generate_uuid(),
        workspace_id=workspace_id,
        name="Test Q",
        agents=[operator1]
    )
    db_session.add(queue)
    db_session.commit()
    
    conv = Conversation(
        id=generate_uuid(),
        workspace_id=workspace_id,
        inbox_id=generate_uuid(),
        contact_id=generate_uuid(),
        queue_id=queue.id
    )
    
    agents = ConversationVisibilityService.resolve_agents(db_session, conv)
    assert len(agents) == 2
    agent_ids = [a.id for a in agents]
    assert operator1.id in agent_ids
    assert workspace_seed["agent_id"] in agent_ids
