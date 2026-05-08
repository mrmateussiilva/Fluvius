from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from app.core.database import Base
from app.models.workspace import generate_uuid, utcnow


class Agent(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    hashed_password = Column(String, nullable=True)  # Nullable for now to support existing agents
    role = Column(String, default="agent", nullable=False) # admin, agent
    avatar_url = Column(String, nullable=True)
    is_online = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
