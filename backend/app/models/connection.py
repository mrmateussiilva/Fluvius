from sqlalchemy import Column, String, DateTime, ForeignKey
from app.core.database import Base
from app.models.workspace import generate_uuid, utcnow


class Connection(Base):
    __tablename__ = "connections"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    inbox_id = Column(String, ForeignKey("inboxes.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    provider = Column(String, nullable=False)  # e.g., 'evolution_api'
    instance_name = Column(String, nullable=False)
    base_url = Column(String, nullable=False)
    api_key = Column(String, nullable=False)
    status = Column(String, nullable=False, default="offline")
    created_at = Column(DateTime, default=utcnow, nullable=False)
