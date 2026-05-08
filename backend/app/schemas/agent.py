from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class AgentBase(BaseModel):
    name: str
    email: str
    avatar_url: Optional[str] = None


class AgentCreate(AgentBase):
    workspace_id: str


class AgentRead(AgentBase):
    id: str
    workspace_id: str
    is_online: bool
    created_at: datetime

    model_config = {"from_attributes": True}
