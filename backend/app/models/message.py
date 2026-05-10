from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from app.core.database import Base
from app.models.workspace import generate_uuid, utcnow


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False, index=True)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=False, index=True)
    
    direction = Column(String, nullable=False)  # inbound, outbound
    message_type = Column(String, nullable=False)  # text, image, audio, video, document, unknown
    content = Column(String, nullable=True)
    external_message_id = Column(String, nullable=True, index=True)
    status = Column(String, nullable=False, default="pending")  # received, pending, sent, delivered, read, failed
    media_url = Column(String, nullable=True)
    mime_type = Column(String, nullable=True)
    
    quoted_message_id = Column(String, ForeignKey("messages.id"), nullable=True, index=True)
    quoted_content = Column(String, nullable=True)
    
    raw_payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
