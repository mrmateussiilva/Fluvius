from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.message import Message

class MessageService:
    @staticmethod
    def get_messages_by_conversation(db: Session, conversation_id: str, limit: int = 50, before_date: Optional[str] = None) -> List[Message]:
        query = db.query(Message).filter(Message.conversation_id == conversation_id)
        if before_date:
            from datetime import datetime
            dt = datetime.fromisoformat(before_date.replace('Z', '+00:00'))
            query = query.filter(Message.created_at < dt)
            
        # We need to order by created_at desc to get the most recent ones before the cursor,
        # but then we want to return them in ascending order for the chat UI.
        messages = query.order_by(Message.created_at.desc()).limit(limit).all()
        return list(reversed(messages))

    @staticmethod
    def create_message(db: Session, message_data: dict) -> Message:
        message = Message(**message_data)
        db.add(message)
        db.commit()
        db.refresh(message)
        return message
        
    @staticmethod
    def update_message_status(db: Session, message_id: str, status: str, external_message_id: Optional[str] = None) -> Optional[Message]:
        message = db.query(Message).filter(Message.id == message_id).first()
        if message:
            message.status = status
            if external_message_id:
                message.external_message_id = external_message_id
            db.commit()
            db.refresh(message)
        return message
