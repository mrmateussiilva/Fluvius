from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.conversation import Conversation
from app.models.contact import Contact

class ConversationService:
    @staticmethod
    def get_conversations(db: Session) -> List[Conversation]:
        return db.query(Conversation).all()
        
    @staticmethod
    def get_conversation_by_id(db: Session, conversation_id: str) -> Optional[Conversation]:
        return db.query(Conversation).filter(Conversation.id == conversation_id).first()
