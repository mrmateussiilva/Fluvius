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


class SLASummary(BaseModel):
    avg_response_minutes: int = 0
    avg_resolution_minutes: int = 0


class SentimentDistribution(BaseModel):
    POSITIVE: int = 0
    NEUTRAL: int = 0
    NEGATIVE: int = 0
    URGENT: int = 0


class DashboardResponse(BaseModel):
    totals: dict[str, int]
    statuses: StatusSummary
    messages: MessageSummary
    agents: list[AgentSummary]
    recent_conversations: list[RecentConversation]
    connections: list[ConnectionStatusSummary] = []
    sla: SLASummary
    sentiments: SentimentDistribution


def is_valid_whatsapp_destination(destination: str | None) -> bool:
    if not destination:
        return False
    return bool(
        re.fullmatch(r"\d{8,15}(:\d+)?", destination)
        or re.fullmatch(r"\d[\d-]{7,}@g\.us", destination)
        or re.fullmatch(r"\d{8,15}(:\d+)?@s\.whatsapp\.net", destination)
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

    # 1. SLA - Resolution time
    resolved_conversations = [
        c for c in conversations 
        if c.status == "resolved" and c.resolved_at and c.created_at
    ]
    avg_resolution = 0
    if resolved_conversations:
        total_resolution_seconds = sum(
            (c.resolved_at - c.created_at).total_seconds() 
            for c in resolved_conversations
        )
        avg_resolution = round(total_resolution_seconds / (60 * len(resolved_conversations)))

    # 2. SLA - First response time (TMR)
    recent_conv_ids = [c.id for c in sorted(
        conversations,
        key=lambda item: item.last_message_at or item.updated_at or item.created_at,
        reverse=True
    )[:50]]

    avg_response_minutes = 0
    if recent_conv_ids:
        # Fetch messages for these conversations ordered chronologically
        recent_messages = (
            db.query(Message)
            .filter(Message.conversation_id.in_(recent_conv_ids))
            .order_by(Message.created_at.asc())
            .all()
        )
        # Map conversation_id to list of messages
        conv_messages = {}
        for m in recent_messages:
            conv_messages.setdefault(m.conversation_id, []).append(m)

        # For each conversation, find the first inbound message, then the first outbound message after it
        latencies = []
        for cid, msgs in conv_messages.items():
            first_inbound_time = None
            for m in msgs:
                if m.direction == "inbound" and first_inbound_time is None:
                    first_inbound_time = m.created_at
                elif m.direction == "outbound" and first_inbound_time is not None:
                    latencies.append((m.created_at - first_inbound_time).total_seconds())
                    break

        if latencies:
            avg_response_minutes = round(sum(latencies) / (60 * len(latencies)))

    # 3. Sentiment Distribution NLP Scanner
    sentiments = {"POSITIVE": 0, "NEUTRAL": 0, "NEGATIVE": 0, "URGENT": 0}
    recent_active_convs = sorted(
        conversations,
        key=lambda item: item.last_message_at or item.updated_at or item.created_at,
        reverse=True
    )[:30]
    recent_active_ids = [c.id for c in recent_active_convs]
    
    if recent_active_ids:
        recent_inbounds = (
            db.query(Message)
            .filter(
                Message.conversation_id.in_(recent_active_ids),
                Message.direction == "inbound"
            )
            .order_by(Message.created_at.desc())
            .all()
        )
        
        last_inbound_per_conv = {}
        for m in recent_inbounds:
            if m.conversation_id not in last_inbound_per_conv:
                last_inbound_per_conv[m.conversation_id] = m

        def get_message_sentiment(content: str) -> str:
            if not content:
                return "NEUTRAL"
            content_lower = content.lower()
            if any(k in content_lower for k in ["urgente", "emergencia", "emergência", "rápido", "atrasado", "socorro", "critico", "crítico", "prioridade", "agora"]):
                return "URGENT"
            if any(k in content_lower for k in ["erro", "falha", "ruim", "problema", "não funciona", "droga", "espera", "reclamar", "pessimo", "péssimo", "demora", "incompetente"]):
                return "NEGATIVE"
            if any(k in content_lower for k in ["obrigado", "obrigada", "agradeço", "excelente", "ótimo", "otimo", "perfeito", "parabéns", "lindo", "bom", "parabens", "top", "amei"]):
                return "POSITIVE"
            return "NEUTRAL"

        for cid in recent_active_ids:
            msg = last_inbound_per_conv.get(cid)
            if msg and msg.content:
                s_type = get_message_sentiment(msg.content)
                sentiments[s_type] += 1
            else:
                sentiments["NEUTRAL"] += 1

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
        sla=SLASummary(
            avg_response_minutes=avg_response_minutes,
            avg_resolution_minutes=avg_resolution
        ),
        sentiments=SentimentDistribution(**sentiments)
    )
