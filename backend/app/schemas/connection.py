from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ConnectionBase(BaseModel):
    name: str
    provider: str
    instance_name: str
    status: str

class ConnectionRead(ConnectionBase):
    id: str
    workspace_id: str
    inbox_id: str
    created_at: datetime
    
    # Inbox fields
    welcome_message: Optional[str] = None
    default_bot_active: bool = True
    bot_type: str = "menu"
    ai_instructions: Optional[str] = None

    class Config:
        from_attributes = True

class ConnectionUpdate(BaseModel):
    status: Optional[str] = None
    instance_name: Optional[str] = None
    api_key: Optional[str] = None
