from sqlalchemy import Column, String, DateTime, ForeignKey
from app.core.database import Base
from app.models.workspace import generate_uuid, utcnow


class Inbox(Base):
    __tablename__ = "inboxes"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    channel_type = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
