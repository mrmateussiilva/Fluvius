from sqlalchemy import Column, String, DateTime, ForeignKey, JSON

from app.core.database import Base
from app.models.workspace import generate_uuid, utcnow


class ConversationAuditLog(Base):
    __tablename__ = "conversation_audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False, index=True)
    actor_agent_id = Column(String, ForeignKey("agents.id"), nullable=True, index=True)
    action = Column(String, nullable=False, index=True)
    before = Column(JSON, nullable=True)
    after = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
