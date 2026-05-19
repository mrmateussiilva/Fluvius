from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Table, Integer
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
from app.core.database import Base

# Association table for Agent <-> Queue many-to-many relationship
agent_queue_association = Table(
    "agent_queues",
    Base.metadata,
    Column("agent_id", String, ForeignKey("agents.id"), primary_key=True),
    Column("queue_id", String, ForeignKey("queues.id"), primary_key=True)
)

class Queue(Base):
    __tablename__ = "queues"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    sla_minutes = Column(Integer, nullable=True, default=30)  # Tempo máximo sem resposta (minutos)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    workspace = relationship("Workspace")
    agents = relationship("Agent", secondary=agent_queue_association, back_populates="queues")
    conversations = relationship("Conversation", back_populates="queue")
