from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.workspace import generate_uuid, utcnow


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    inbox_id = Column(String, ForeignKey("inboxes.id"), nullable=False, index=True)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=False, index=True)
    assignee_id = Column(String, ForeignKey("agents.id"), nullable=True, index=True)
    queue_id = Column(String, ForeignKey("queues.id"), nullable=True, index=True)
    external_id = Column(String, nullable=True, index=True)
    status = Column(String, nullable=False, default="bot")  # bot, pending, open, resolved
    unread_count = Column(Integer, default=0, nullable=False)
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    assigned_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    workspace = relationship("Workspace")
    inbox = relationship("Inbox", back_populates="conversations")
    contact = relationship("Contact", back_populates="conversations")
    assignee = relationship("Agent")
    queue = relationship("Queue", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
