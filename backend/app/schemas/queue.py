from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class QueueBase(BaseModel):
    name: str
    description: Optional[str] = None

class QueueCreate(QueueBase):
    pass

class QueueUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class QueueRead(QueueBase):
    id: str
    workspace_id: str
    created_at: datetime

    model_config = {"from_attributes": True}

class AgentQueueUpdate(BaseModel):
    agent_ids: List[str]
