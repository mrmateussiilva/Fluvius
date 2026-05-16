from sqlalchemy import Column, String, ForeignKey, Text
from app.core.database import Base
from app.models.workspace import generate_uuid

class QuickReply(Base):
    __tablename__ = "quick_replies"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False, index=True)
    shortcut = Column(String, nullable=False)
    content = Column(Text, nullable=False)
