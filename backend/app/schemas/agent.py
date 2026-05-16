from pydantic import BaseModel, field_serializer
from datetime import datetime, timezone
from typing import Optional


class AgentBase(BaseModel):
    name: str
    email: str
    avatar_url: Optional[str] = None
    role: str = "operator"


class AgentCreate(AgentBase):
    workspace_id: Optional[str] = None
    password: Optional[str] = None


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


class AgentRead(AgentBase):
    id: str
    workspace_id: str
    is_online: bool
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("created_at")
    def serialize_dt(self, dt: datetime, _info):
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
