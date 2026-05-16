from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, field_serializer
from app.schemas.agent import AgentRead


class ContactResponse(BaseModel):
    id: str
    phone: str
    name: Optional[str]
    avatar_url: Optional[str]
    tags: list[str] = []

    model_config = {"from_attributes": True}


class ConversationBase(BaseModel):
    status: str


class ConversationResponse(ConversationBase):
    id: str
    workspace_id: str
    inbox_id: str
    contact_id: str
    assignee_id: Optional[str] = None
    queue_id: Optional[str] = None
    unread_count: int = 0
    last_message_at: Optional[datetime]
    assigned_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    contact: Optional[ContactResponse] = None
    assignee: Optional[AgentRead] = None

    model_config = {"from_attributes": True}
    
    @field_serializer("last_message_at", "assigned_at", "resolved_at", "created_at", "updated_at")
    def serialize_dt(self, dt: datetime | None, _info):
        if dt is None:
            return None
        # Ensure it's treated as UTC if it has no timezone, and format with Z
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class TransferRequest(BaseModel):
    agent_id: Optional[str] = None
    queue_id: Optional[str] = None


class AgentKanbanData(BaseModel):
    agent: AgentRead
    open: list[ConversationResponse]
    resolved: list[ConversationResponse]

    model_config = {"from_attributes": True}

class KanbanResponse(BaseModel):
    queue: list[ConversationResponse]
    by_agent: list[AgentKanbanData]
