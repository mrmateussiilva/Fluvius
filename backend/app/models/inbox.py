from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.workspace import generate_uuid, utcnow


class Inbox(Base):
    __tablename__ = "inboxes"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    welcome_message = Column(String, nullable=True)
    default_bot_active = Column(Boolean, default=True, nullable=False)
    channel_type = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    conversations = relationship("Conversation", back_populates="inbox")
