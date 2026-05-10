from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.schemas.agent import AgentRead


class ContactResponse(BaseModel):
    id: str
    phone: str
    name: Optional[str]
    avatar_url: Optional[str]

    model_config = {"from_attributes": True}


class ConversationBase(BaseModel):
    status: str


class ConversationResponse(ConversationBase):
    id: str
    workspace_id: str
    inbox_id: str
    contact_id: str
    assignee_id: Optional[str] = None
    unread_count: int = 0
    last_message_at: Optional[datetime]
    assigned_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    contact: Optional[ContactResponse] = None
    assignee: Optional[AgentRead] = None

    model_config = {"from_attributes": True}

class AgentKanbanData(BaseModel):
    agent: AgentRead
    open: list[ConversationResponse]
    resolved: list[ConversationResponse]

class KanbanResponse(BaseModel):
    queue: list[ConversationResponse]
    by_agent: list[AgentKanbanData]
