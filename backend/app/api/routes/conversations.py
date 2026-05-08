from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.auth import get_current_agent
from app.schemas.conversation import ConversationResponse
from app.services.conversation_service import ConversationService
from app.models.contact import Contact
from app.models.agent import Agent
from app.models.conversation import Conversation
from app.models.workspace import utcnow
from app.core.socket_manager import socket_manager

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("", response_model=List[ConversationResponse])
def get_conversations(
    status: Optional[str] = None, 
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    query = db.query(Conversation).filter(Conversation.workspace_id == current_agent.workspace_id)
    
    # Role-based visibility: Non-admins only see pending or their own conversations
    if current_agent.role != "admin":
        query = query.filter(
            or_(
                Conversation.status == "pending",
                Conversation.assignee_id == current_agent.id
            )
        )

    if status:
        query = query.filter(Conversation.status == status)
    
    conversations = query.order_by(Conversation.last_message_at.desc().nullslast()).all()

    results = []
    for conv in conversations:
        conv.contact = db.query(Contact).filter(Contact.id == conv.contact_id).first()
        if conv.assignee_id:
            conv.assignee = db.query(Agent).filter(Agent.id == conv.assignee_id).first()
        else:
            conv.assignee = None
        results.append(conv)

    return results


class AssignRequest(BaseModel):
    agent_id: str


@router.patch("/{conversation_id}/assign", response_model=ConversationResponse)
async def assign_conversation(
    conversation_id: str, 
    body: AssignRequest, 
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    # Scope to workspace
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.workspace_id == current_agent.workspace_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found in your workspace")

    agent = db.query(Agent).filter(
        Agent.id == body.agent_id,
        Agent.workspace_id == current_agent.workspace_id
    ).first()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found in your workspace")

    conversation.assignee_id = body.agent_id
    conversation.status = "open"
    conversation.assigned_at = utcnow()
    conversation.updated_at = utcnow()
    db.commit()
    db.refresh(conversation)

    # BROADCAST (Scoping to workspace in SocketManager later)
    await socket_manager.broadcast({
        "type": "CONVERSATION_UPDATED",
        "workspace_id": current_agent.workspace_id,
        "data": {
            "id": conversation.id,
            "status": conversation.status,
            "last_message_at": conversation.last_message_at.isoformat() if conversation.last_message_at else None,
            "assignee_id": conversation.assignee_id,
            "assignee": {
                "id": agent.id,
                "name": agent.name,
                "email": agent.email
            }
        }
    })

    conversation.contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
    conversation.assignee = agent
    return conversation


@router.patch("/{conversation_id}/resolve", response_model=ConversationResponse)
async def resolve_conversation(
    conversation_id: str, 
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.workspace_id == current_agent.workspace_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation.status = "resolved"
    conversation.resolved_at = utcnow()
    conversation.updated_at = utcnow()
    db.commit()
    db.refresh(conversation)

    # BROADCAST
    await socket_manager.broadcast({
        "type": "CONVERSATION_UPDATED",
        "workspace_id": current_agent.workspace_id,
        "data": {
            "id": conversation.id,
            "status": conversation.status,
            "last_message_at": conversation.last_message_at.isoformat() if conversation.last_message_at else None,
            "assignee_id": conversation.assignee_id
        }
    })

    conversation.contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
    if conversation.assignee_id:
        conversation.assignee = db.query(Agent).filter(Agent.id == conversation.assignee_id).first()
    return conversation


@router.patch("/{conversation_id}/read", response_model=ConversationResponse)
async def mark_as_read(
    conversation_id: str, 
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.workspace_id == current_agent.workspace_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation.unread_count = 0
    db.commit()
    db.refresh(conversation)

    # BROADCAST
    await socket_manager.broadcast({
        "type": "CONVERSATION_UPDATED",
        "workspace_id": current_agent.workspace_id,
        "data": {
            "id": conversation.id,
            "unread_count": 0
        }
    })

    conversation.contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
    if conversation.assignee_id:
        conversation.assignee = db.query(Agent).filter(Agent.id == conversation.assignee_id).first()
    return conversation


@router.patch("/{conversation_id}/pending", response_model=ConversationResponse)
async def pending_conversation(
    conversation_id: str, 
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.workspace_id == current_agent.workspace_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation.status = "pending"
    conversation.assignee_id = None
    conversation.assigned_at = None
    conversation.updated_at = utcnow()
    db.commit()
    db.refresh(conversation)

    # BROADCAST
    await socket_manager.broadcast({
        "type": "CONVERSATION_UPDATED",
        "workspace_id": current_agent.workspace_id,
        "data": {
            "id": conversation.id,
            "status": conversation.status,
            "last_message_at": conversation.last_message_at.isoformat() if conversation.last_message_at else None,
            "assignee_id": None
        }
    })

    conversation.contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
    conversation.assignee = None
    return conversation
