from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import logging

from app.core.database import get_db, SessionLocal
from app.core.auth import get_current_agent
from app.schemas.message import MessageCreate, MessageResponse, MediaMessageCreate
from app.services.message_service import MessageService
from app.services.conversation_service import ConversationService
from app.services.evolution_service import EvolutionService
from app.models.connection import Connection
from app.models.agent import Agent
from app.models.conversation import Conversation
from app.models.workspace import utcnow
from app.models.contact import Contact
from app.core.socket_manager import socket_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/conversations/{conversation_id}/messages", tags=["messages"])


@router.get("", response_model=List[MessageResponse])
def get_messages(
    conversation_id: str, 
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    # Check if conversation belongs to workspace
    conversation = ConversationService.get_conversation_by_id(db, conversation_id)
    if not conversation or conversation.workspace_id != current_agent.workspace_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    messages = MessageService.get_messages_by_conversation(db, conversation_id)
    return messages

async def send_message_task(message_id: str, conversation_id: str, text: str, workspace_id: str):
    with SessionLocal() as db:
        conversation = ConversationService.get_conversation_by_id(db, conversation_id)
        if not conversation:
            MessageService.update_message_status(db, message_id, "failed")
            return
        
        connection = db.query(Connection).filter(Connection.inbox_id == conversation.inbox_id).first()
        contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
        
        if not connection or not contact:
            MessageService.update_message_status(db, message_id, "failed")
            return
        
        try:
            await EvolutionService.send_text_message(
                base_url=connection.base_url,
                api_key=connection.api_key,
                instance_name=connection.instance_name,
                phone=contact.phone,
                text=text
            )
            MessageService.update_message_status(db, message_id, "sent")
            
            await socket_manager.broadcast({
                "type": "MESSAGE_STATUS_UPDATED",
                "workspace_id": workspace_id,
                "data": {
                    "id": message_id,
                    "conversation_id": conversation_id,
                    "status": "sent"
                }
            })
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            MessageService.update_message_status(db, message_id, "failed")
            await socket_manager.broadcast({
                "type": "MESSAGE_STATUS_UPDATED",
                "workspace_id": workspace_id,
                "data": {
                    "id": message_id,
                    "conversation_id": conversation_id,
                    "status": "failed"
                }
            })

@router.post("", response_model=MessageResponse)
async def create_message(
    conversation_id: str,
    message_in: MessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.workspace_id == current_agent.workspace_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    message_data = {
        "workspace_id": current_agent.workspace_id,
        "conversation_id": conversation.id,
        "contact_id": conversation.contact_id,
        "direction": "outbound",
        "message_type": "text",
        "content": message_in.content,
        "status": "pending"
    }
    
    message = MessageService.create_message(db, message_data)
    conversation.last_message_at = utcnow()
    db.commit()
    db.refresh(message)
    
    await socket_manager.broadcast({
        "type": "NEW_MESSAGE",
        "workspace_id": current_agent.workspace_id,
        "data": {
            "id": message.id,
            "conversation_id": message.conversation_id,
            "direction": message.direction,
            "content": message.content,
            "created_at": message.created_at.isoformat(),
            "status": message.status
        }
    })

    background_tasks.add_task(send_message_task, message.id, conversation.id, message_in.content, current_agent.workspace_id)
    return message


async def send_media_task(message_id: str, conversation_id: str, media: str, media_type: str, mimetype: str, caption: str, workspace_id: str):
    with SessionLocal() as db:
        conversation = ConversationService.get_conversation_by_id(db, conversation_id)
        if not conversation:
            MessageService.update_message_status(db, message_id, "failed")
            return
            
        connection = db.query(Connection).filter(Connection.inbox_id == conversation.inbox_id).first()
        contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
        
        if not connection or not contact:
            MessageService.update_message_status(db, message_id, "failed")
            return
            
        try:
            await EvolutionService.send_media_message(
                base_url=connection.base_url,
                api_key=connection.api_key,
                instance_name=connection.instance_name,
                phone=contact.phone,
                media=media,
                media_type=media_type,
                mimetype=mimetype,
                caption=caption
            )
            MessageService.update_message_status(db, message_id, "sent")
            await socket_manager.broadcast({
                "type": "MESSAGE_STATUS_UPDATED",
                "workspace_id": workspace_id,
                "data": {"id": message_id, "conversation_id": conversation_id, "status": "sent"}
            })
        except Exception as e:
            logger.exception(f"Error in send_media_task: {e}")
            MessageService.update_message_status(db, message_id, "failed")
            await socket_manager.broadcast({
                "type": "MESSAGE_STATUS_UPDATED",
                "workspace_id": workspace_id,
                "data": {"id": message_id, "conversation_id": conversation_id, "status": "failed"}
            })


@router.post("/media", response_model=MessageResponse)
async def create_media_message(
    conversation_id: str,
    media_in: MediaMessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.workspace_id == current_agent.workspace_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    message_data = {
        "workspace_id": current_agent.workspace_id,
        "conversation_id": conversation.id,
        "contact_id": conversation.contact_id,
        "direction": "outbound",
        "message_type": media_in.media_type,
        "content": media_in.caption,
        "media_url": media_in.media,
        "mime_type": media_in.mimetype,
        "status": "pending"
    }
    
    message = MessageService.create_message(db, message_data)
    conversation.last_message_at = utcnow()
    db.commit()
    db.refresh(message)
    
    await socket_manager.broadcast({
        "type": "NEW_MESSAGE",
        "workspace_id": current_agent.workspace_id,
        "data": {
            "id": message.id,
            "conversation_id": message.conversation_id,
            "direction": message.direction,
            "message_type": message.message_type,
            "content": message.content,
            "media_url": message.media_url,
            "mime_type": message.mime_type,
            "created_at": message.created_at.isoformat(),
            "status": message.status
        }
    })

    background_tasks.add_task(send_media_task, message.id, conversation.id, media_in.media, media_in.media_type, media_in.mimetype, media_in.caption, current_agent.workspace_id)
    return message
