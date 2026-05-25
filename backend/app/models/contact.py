from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Float, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.workspace import generate_uuid, utcnow


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    phone = Column(String, nullable=False, index=True)
    name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    tags = Column(JSON, default=list, nullable=False)
    email = Column(String, nullable=True)
    company = Column(String, nullable=True)
    lead_source = Column(String, nullable=True)
    lifecycle_stage = Column(String, nullable=True)
    estimated_value = Column(Float, nullable=True)
    crm_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    conversations = relationship("Conversation", back_populates="contact")
