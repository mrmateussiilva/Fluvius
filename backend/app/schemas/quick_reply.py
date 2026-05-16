from pydantic import BaseModel
from typing import Optional

class QuickReplyBase(BaseModel):
    shortcut: str
    content: str

class QuickReplyCreate(QuickReplyBase):
    pass

class QuickReplyUpdate(BaseModel):
    shortcut: Optional[str] = None
    content: Optional[str] = None

class QuickReplyRead(QuickReplyBase):
    id: str
    workspace_id: str

    class Config:
        from_attributes = True
