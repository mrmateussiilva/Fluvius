from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Integer
from app.core.database import Base
from app.models.workspace import generate_uuid, utcnow


class Media(Base):
    __tablename__ = "media"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    message_id = Column(String, ForeignKey("messages.id"), nullable=True, index=True)
    media_type = Column(String, nullable=False)  # image, audio, video, document, sticker, avatar
    mime_type = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    downloaded = Column(Boolean, default=False, nullable=False)
    failed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
