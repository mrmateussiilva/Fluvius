from datetime import timedelta
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import get_current_agent
from app.core.database import get_db
from app.models.agent import Agent
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.connection import Connection
from app.models.workspace import utcnow
from app.core.socket_manager import socket_manager

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class StatusSummary(BaseModel):
    bot: int = 0
    pending: int = 0
    open: int = 0
    resolved: int = 0


class MessageSummary(BaseModel):
    total: int
    inbound: int
    outbound: int
    today: int
    last_7_days: int


class AgentSummary(BaseModel):
    id: str
    name: str
    open: int
    resolved: int
    unread: int
    is_online: bool


class RecentConversation(BaseModel):
    id: str
    contact_name: str
    contact_phone: str
    status: str
    unread_count: int
    last_message_at: str | None
    assignee_name: str | None


class ConnectionStatusSummary(BaseModel):
    name: str
    status: str
    instance: str

class DashboardResponse(BaseModel):
    totals: dict[str, int]
    statuses: StatusSummary
    messages: MessageSummary
    agents: list[AgentSummary]
    recent_conversations: list[RecentConversation]
    connections: list[ConnectionStatusSummary] = []


def is_valid_whatsapp_destination(destination: str | None) -> bool:
    if not destination:
        return False
    return bool(
        re.fullmatch(r"\d{8,15}", destination)
        or re.fullmatch(r"\d[\d-]{7,}@g\.us", destination)
    )


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    if current_agent.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access dashboard")

    workspace_id = current_agent.workspace_id
    now = utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    last_7_days_start = now - timedelta(days=7)

    contacts = db.query(Contact).filter(Contact.workspace_id == workspace_id).all()
    valid_contact_ids = {
        contact.id
        for contact in contacts
        if is_valid_whatsapp_destination(contact.phone)
    }
    group_count = sum(1 for contact in contacts if contact.phone.endswith("@g.us"))

    conversations = db.query(Conversation).filter(
        Conversation.workspace_id == workspace_id,
        Conversation.contact_id.in_(valid_contact_ids) if valid_contact_ids else False,
    ).all()

    statuses = StatusSummary()
    unread_total = 0
    for conversation in conversations:
        if hasattr(statuses, conversation.status):
            setattr(statuses, conversation.status, getattr(statuses, conversation.status) + 1)
        unread_total += conversation.unread_count or 0

    total_messages = db.query(func.count(Message.id)).filter(Message.workspace_id == workspace_id).scalar() or 0
    inbound_messages = db.query(func.count(Message.id)).filter(
        Message.workspace_id == workspace_id,
        Message.direction == "inbound",
    ).scalar() or 0
    outbound_messages = db.query(func.count(Message.id)).filter(
        Message.workspace_id == workspace_id,
        Message.direction == "outbound",
    ).scalar() or 0
    messages_today = db.query(func.count(Message.id)).filter(
        Message.workspace_id == workspace_id,
        Message.created_at >= today_start,
    ).scalar() or 0
    messages_last_7_days = db.query(func.count(Message.id)).filter(
        Message.workspace_id == workspace_id,
        Message.created_at >= last_7_days_start,
    ).scalar() or 0

    agents = db.query(Agent).filter(Agent.workspace_id == workspace_id).all()
    agent_summaries = []
    for agent in agents:
        agent_conversations = [
            conversation for conversation in conversations
            if conversation.assignee_id == agent.id
        ]
        is_agent_online = False
        if workspace_id in socket_manager.active_connections:
            if agent.id in socket_manager.active_connections[workspace_id]:
                is_agent_online = True

        agent_summaries.append(AgentSummary(
            id=agent.id,
            name=agent.name,
            open=sum(1 for conversation in agent_conversations if conversation.status == "open"),
            resolved=sum(1 for conversation in agent_conversations if conversation.status == "resolved"),
            unread=sum(conversation.unread_count or 0 for conversation in agent_conversations),
            is_online=is_agent_online,
        ))

    contact_by_id = {contact.id: contact for contact in contacts}
    agent_by_id = {agent.id: agent for agent in agents}
    recent_conversations = []
    for conversation in sorted(
        conversations,
        key=lambda item: item.last_message_at or item.updated_at or item.created_at,
        reverse=True,
    )[:8]:
        contact = contact_by_id.get(conversation.contact_id)
        assignee = agent_by_id.get(conversation.assignee_id) if conversation.assignee_id else None
        recent_conversations.append(RecentConversation(
            id=conversation.id,
            contact_name=(contact.name if contact else None) or (contact.phone if contact else "Contato"),
            contact_phone=contact.phone if contact else "",
            status=conversation.status,
            unread_count=conversation.unread_count or 0,
            last_message_at=conversation.last_message_at.isoformat() if conversation.last_message_at else None,
            assignee_name=assignee.name if assignee else None,
        ))

    connections_data = db.query(Connection).filter(Connection.workspace_id == workspace_id).all()
    connection_summaries = [
        ConnectionStatusSummary(
            name=c.name or c.instance_name,
            status=c.status or "unknown",
            instance=c.instance_name
        ) for c in connections_data
    ]

    return DashboardResponse(
        totals={
            "contacts": len(valid_contact_ids),
            "groups": group_count,
            "conversations": len(conversations),
            "unread": unread_total,
            "agents": len(agents),
            "online_agents": sum(1 for a in agent_summaries if a.is_online),
        },
        statuses=statuses,
        messages=MessageSummary(
            total=total_messages,
            inbound=inbound_messages,
            outbound=outbound_messages,
            today=messages_today,
            last_7_days=messages_last_7_days,
        ),
        agents=agent_summaries,
        recent_conversations=recent_conversations,
        connections=connection_summaries,
    )
