from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Boolean
from app.core.database import Base
from app.models.workspace import generate_uuid, utcnow


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    connection_id = Column(String, ForeignKey("connections.id"), nullable=True, index=True)
    provider = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    payload = Column(JSON, nullable=False)
    processed = Column(Boolean, nullable=False, default=False)
    error = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
