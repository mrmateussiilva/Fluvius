from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from pydantic import BaseModel
import re
from app.core.database import get_db
from app.core.auth import get_current_agent
from app.schemas.conversation import ConversationResponse, KanbanResponse, AgentKanbanData, TransferRequest
from app.services.conversation_service import ConversationService
from app.services.ai_service import AIService
from app.schemas.agent import AgentRead
from app.models.contact import Contact
from app.models.agent import Agent
from app.models.connection import Connection
from app.models.conversation import Conversation
from app.models.inbox import Inbox
from app.models.workspace import utcnow
from app.core.socket_manager import socket_manager
from app.services.visibility_service import ConversationVisibilityService

class StartConversationRequest(BaseModel):
    phone: str
    name: Optional[str] = None
    inbox_id: Optional[str] = None

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def is_valid_whatsapp_destination(destination: str | None) -> bool:
    if not destination:
        return False
    # Accept plain phone numbers (8-15 digits), group JIDs, or individual WA JIDs
    return bool(
        re.fullmatch(r"\d{8,15}(:\d+)?", destination)
        or re.fullmatch(r"\d[\d-]{7,}@g\.us", destination)
        or re.fullmatch(r"\d{8,15}(:\d+)?@s\.whatsapp\.net", destination)
    )


def attach_contact_and_assignee(db: Session, conversation: Conversation, assignee: Agent | None = None) -> bool:
    conversation.contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
    if not conversation.contact or not is_valid_whatsapp_destination(conversation.contact.phone):
        return False

    if assignee is not None:
        conversation.assignee = assignee
    elif conversation.assignee_id:
        conversation.assignee = db.query(Agent).filter(Agent.id == conversation.assignee_id).first()
    else:
        conversation.assignee = None

    return True


@router.get("", response_model=List[ConversationResponse])
def get_conversations(
    status: Optional[str] = None, 
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    query = db.query(Conversation).join(
        Connection, Connection.inbox_id == Conversation.inbox_id
    ).filter(
        Conversation.workspace_id == current_agent.workspace_id
    )
    
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
        if attach_contact_and_assignee(db, conv):
            results.append(conv)

    return results


@router.post("/{conversation_id}/suggest-reply")
def suggest_reply(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    # Check if conversation belongs to workspace
    conversation = ConversationService.get_conversation_by_id(db, conversation_id)
    if not conversation or conversation.workspace_id != current_agent.workspace_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    try:
        suggestions = AIService.suggest_reply(db, conversation_id)
        return {
            "suggestion": suggestions[0] if suggestions else "",
            "suggestions": suggestions
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error in AI Service")


@router.post("/{conversation_id}/summarize")
def summarize_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    # Check if conversation belongs to workspace
    conversation = ConversationService.get_conversation_by_id(db, conversation_id)
    if not conversation or conversation.workspace_id != current_agent.workspace_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    try:
        summary = AIService.summarize_conversation(db, conversation_id)
        return {"summary": summary}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error in AI Service")


@router.post("/{conversation_id}/sentiment")
def analyze_sentiment(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    # Check if conversation belongs to workspace
    conversation = ConversationService.get_conversation_by_id(db, conversation_id)
    if not conversation or conversation.workspace_id != current_agent.workspace_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    try:
        sentiment = AIService.analyze_sentiment(db, conversation_id)
        return {"sentiment": sentiment}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error in AI Service")




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

    await ConversationVisibilityService.broadcast_to_allowed_agents(db, conversation, {
        "type": "CONVERSATION_UPDATED",
        "workspace_id": current_agent.workspace_id,
        "data": {
            "id": conversation.id,
            "status": conversation.status,
            "last_message_at": (conversation.last_message_at.isoformat() + "Z" if conversation.last_message_at.tzinfo is None else conversation.last_message_at.isoformat()) if conversation.last_message_at else None,
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


@router.post("/{conversation_id}/transfer", response_model=ConversationResponse)
async def transfer_conversation(
    conversation_id: str,
    body: TransferRequest,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.workspace_id == current_agent.workspace_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    if body.queue_id:
        from app.models.queue import Queue
        queue = db.query(Queue).filter(Queue.id == body.queue_id, Queue.workspace_id == current_agent.workspace_id).first()
        if not queue:
            raise HTTPException(status_code=404, detail="Queue not found")
        conversation.queue_id = queue.id
        
    if body.agent_id:
        agent = db.query(Agent).filter(Agent.id == body.agent_id, Agent.workspace_id == current_agent.workspace_id).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        conversation.assignee_id = agent.id
        
    conversation.updated_at = utcnow()
    db.commit()
    db.refresh(conversation)

    await ConversationVisibilityService.broadcast_to_allowed_agents(db, conversation, {
        "type": "CONVERSATION_UPDATED",
        "workspace_id": current_agent.workspace_id,
        "data": {
            "id": conversation.id,
            "status": conversation.status,
            "queue_id": conversation.queue_id,
            "assignee_id": conversation.assignee_id
        }
    })

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
    await ConversationVisibilityService.broadcast_to_allowed_agents(db, conversation, {
        "type": "CONVERSATION_UPDATED",
        "workspace_id": current_agent.workspace_id,
        "data": {
            "id": conversation.id,
            "status": conversation.status,
            "last_message_at": (conversation.last_message_at.isoformat() + "Z" if conversation.last_message_at.tzinfo is None else conversation.last_message_at.isoformat()) if conversation.last_message_at else None,
            "assignee_id": conversation.assignee_id
        }
    })

    conversation.contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
    if conversation.assignee_id:
        conversation.assignee = db.query(Agent).filter(Agent.id == conversation.assignee_id).first()
    return conversation


@router.post("/start", response_model=ConversationResponse)
async def start_conversation(
    body: StartConversationRequest,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    import re
    # Sanitize phone (only numbers)
    phone = re.sub(r"\D", "", body.phone)
    if not phone:
        raise HTTPException(status_code=400, detail="Invalid phone number")

    # Find or create contact
    contact = db.query(Contact).filter(
        Contact.workspace_id == current_agent.workspace_id,
        Contact.phone == phone
    ).first()

    if not contact:
        contact = Contact(
            workspace_id=current_agent.workspace_id,
            phone=phone,
            name=body.name or phone
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)

    # Determine inbox_id
    inbox_id = body.inbox_id
    if not inbox_id:
        # Default to the first active inbox in the workspace
        inbox = db.query(Inbox).filter(Inbox.workspace_id == current_agent.workspace_id).first()
        if not inbox:
            raise HTTPException(status_code=400, detail="No active WhatsApp connections found in this workspace.")
        inbox_id = inbox.id

    # Check if conversation already exists for this inbox and contact
    conversation = db.query(Conversation).filter(
        Conversation.workspace_id == current_agent.workspace_id,
        Conversation.inbox_id == inbox_id,
        Conversation.contact_id == contact.id
    ).first()

    if not conversation:
        conversation = Conversation(
            workspace_id=current_agent.workspace_id,
            inbox_id=inbox_id,
            contact_id=contact.id,
            status="open",
            assignee_id=current_agent.id, # Automatically assign to the agent who started it
            assigned_at=utcnow()
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)

        # Broadcast the new conversation
        conversation.contact = contact
        conversation.assignee = current_agent
        
        await ConversationVisibilityService.broadcast_to_allowed_agents(db, conversation, {
            "type": "NEW_CONVERSATION",
            "workspace_id": current_agent.workspace_id,
            "data": {
                "id": conversation.id,
                "status": conversation.status,
                "contact": {
                    "id": contact.id,
                    "name": contact.name,
                    "phone": contact.phone,
                    "avatar_url": contact.avatar_url
                },
                "unread_count": 0,
                "last_message_at": None
            }
        })

    conversation.contact = contact
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
    await ConversationVisibilityService.broadcast_to_allowed_agents(db, conversation, {
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
    await ConversationVisibilityService.broadcast_to_allowed_agents(db, conversation, {
        "type": "CONVERSATION_UPDATED",
        "workspace_id": current_agent.workspace_id,
        "data": {
            "id": conversation.id,
            "status": conversation.status,
            "last_message_at": (conversation.last_message_at.isoformat() + "Z" if conversation.last_message_at.tzinfo is None else conversation.last_message_at.isoformat()) if conversation.last_message_at else None,
            "assignee_id": None
        }
    })

    conversation.contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
    conversation.assignee = None
    return conversation

@router.get("/admin/kanban", response_model=KanbanResponse)
def get_kanban(
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    if current_agent.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access Kanban")

    workspace_id = current_agent.workspace_id
    
    # 1. Queue (Pending, no assignee)
    queue_conversations = db.query(Conversation).join(
        Connection, Connection.inbox_id == Conversation.inbox_id
    ).filter(
        Conversation.workspace_id == workspace_id,
        Conversation.status == "pending",
        Conversation.assignee_id == None
    ).all()

    queue_conversations = [
        conv for conv in queue_conversations
        if attach_contact_and_assignee(db, conv)
    ]

    # 2. By Agent
    agents = db.query(Agent).filter(Agent.workspace_id == workspace_id).all()
    by_agent = []
    
    for agent in agents:
        agent_open = db.query(Conversation).join(
            Connection, Connection.inbox_id == Conversation.inbox_id
        ).filter(
            Conversation.workspace_id == workspace_id,
            Conversation.assignee_id == agent.id,
            Conversation.status == "open"
        ).all()
        agent_open = [
            conv for conv in agent_open
            if attach_contact_and_assignee(db, conv, agent)
        ]
            
        agent_resolved = db.query(Conversation).join(
            Connection, Connection.inbox_id == Conversation.inbox_id
        ).filter(
            Conversation.workspace_id == workspace_id,
            Conversation.assignee_id == agent.id,
            Conversation.status == "resolved"
        ).all()
        agent_resolved = [
            conv for conv in agent_resolved
            if attach_contact_and_assignee(db, conv, agent)
        ]
            
        # Update is_online dynamically from socket_manager
        is_agent_online = False
        if workspace_id in socket_manager.active_connections:
            if agent.id in socket_manager.active_connections[workspace_id]:
                is_agent_online = True
        
        agent.is_online = is_agent_online

        by_agent.append(AgentKanbanData(
            agent=AgentRead.model_validate(agent),
            open=agent_open,
            resolved=agent_resolved
        ))
        
    return KanbanResponse(
        queue=queue_conversations,
        by_agent=by_agent
    )
