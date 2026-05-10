from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel

class MessageBase(BaseModel):
    content: str

class MessageCreate(MessageBase):
    quoted_message_id: Optional[str] = None

class MediaMessageCreate(BaseModel):
    media: str  # Base64 or URL
    media_type: str  # image, audio, video, document
    mimetype: str  # image/jpeg, etc.
    caption: Optional[str] = ""
    quoted_message_id: Optional[str] = None

class MessageResponse(BaseModel):
    id: str
    workspace_id: str
    conversation_id: str
    contact_id: str
    direction: str
    message_type: str
    content: Optional[str]
    media_url: Optional[str] = None
    mime_type: Optional[str] = None
    external_message_id: Optional[str]
    status: str
    created_at: datetime
    quoted_message_id: Optional[str] = None
    quoted_content: Optional[str] = None

    model_config = {"from_attributes": True}
