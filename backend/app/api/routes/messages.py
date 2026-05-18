from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
import re

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


def is_valid_whatsapp_destination(destination: str | None) -> bool:
    if not destination:
        return False
    return bool(
        re.fullmatch(r"\d{8,15}(:\d+)?", destination)
        or re.fullmatch(r"\d[\d-]{7,}@g\.us", destination)
        or re.fullmatch(r"\d{8,15}(:\d+)?@s\.whatsapp\.net", destination)
    )


@router.get("", response_model=List[MessageResponse])
def get_messages(
    conversation_id: str, 
    before_date: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    # Check if conversation belongs to workspace
    conversation = ConversationService.get_conversation_by_id(db, conversation_id)
    if not conversation or conversation.workspace_id != current_agent.workspace_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    messages = MessageService.get_messages_by_conversation(
        db, 
        conversation_id, 
        limit=limit, 
        before_date=before_date
    )
    return messages

async def send_message_task(message_id: str, conversation_id: str, text: str, workspace_id: str, quoted_external_id: str = None):
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

        if not is_valid_whatsapp_destination(contact.phone):
            logger.warning("Refusing to send message to invalid WhatsApp destination: %s", contact.phone)
            MessageService.update_message_status(db, message_id, "failed")
            return
        
        try:
            result = await EvolutionService.send_text_message(
                base_url=connection.base_url,
                api_key=connection.api_key,
                instance_name=connection.instance_name,
                phone=contact.phone,
                text=text,
                quoted_external_id=quoted_external_id
            )
            
            external_id = None
            if result and isinstance(result, dict):
                external_id = result.get("key", {}).get("id")
                
            MessageService.update_message_status(db, message_id, "sent", external_message_id=external_id)
            
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

    contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
    if not contact or not is_valid_whatsapp_destination(contact.phone):
        raise HTTPException(status_code=400, detail="Contact does not have a valid WhatsApp destination")
        
    message_data = {
        "workspace_id": current_agent.workspace_id,
        "conversation_id": conversation.id,
        "contact_id": conversation.contact_id,
        "direction": "outbound",
        "message_type": "text",
        "content": message_in.content,
        "status": "pending"
    }
    
    quoted_external_id = None
    if message_in.quoted_message_id:
        from app.models.message import Message
        quoted_msg = db.query(Message).filter(Message.id == message_in.quoted_message_id).first()
        if quoted_msg:
            quoted_external_id = quoted_msg.external_message_id
            message_data["quoted_message_id"] = quoted_msg.id
            message_data["quoted_content"] = quoted_msg.content or "Mídia"
    
    message = MessageService.create_message(db, message_data)
    conversation.last_message_at = utcnow()
    db.commit()
    db.refresh(message)
    
    await socket_manager.broadcast({
        "type": "NEW_MESSAGE",
        "workspace_id": current_agent.workspace_id,
        "data": {
            "id": message.id,
            "workspace_id": message.workspace_id,
            "conversation_id": message.conversation_id,
            "contact_id": message.contact_id,
            "direction": message.direction,
            "message_type": message.message_type,
            "content": message.content,
            "media_url": message.media_url,
            "mime_type": message.mime_type,
            "external_message_id": message.external_message_id,
            "status": message.status,
            "created_at": message.created_at.isoformat() + "Z" if message.created_at.tzinfo is None else message.created_at.isoformat(),
            "quoted_message_id": message.quoted_message_id,
            "quoted_content": message.quoted_content
        }
    })

    background_tasks.add_task(send_message_task, message.id, conversation.id, message_in.content, current_agent.workspace_id, quoted_external_id)
    return message


async def send_media_task(message_id: str, conversation_id: str, media: str, media_type: str, mimetype: str, caption: str, workspace_id: str, quoted_external_id: str = None):
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

        if not is_valid_whatsapp_destination(contact.phone):
            logger.warning("Refusing to send media to invalid WhatsApp destination: %s", contact.phone)
            MessageService.update_message_status(db, message_id, "failed")
            return
            
        try:
            if media_type == 'audio':
                result = await EvolutionService.send_audio_message(
                    base_url=connection.base_url,
                    api_key=connection.api_key,
                    instance_name=connection.instance_name,
                    phone=contact.phone,
                    audio_base64=media,
                    mimetype=mimetype,
                    quoted_external_id=quoted_external_id
                )
            else:
                result = await EvolutionService.send_media_message(
                    base_url=connection.base_url,
                    api_key=connection.api_key,
                    instance_name=connection.instance_name,
                    phone=contact.phone,
                    media=media,
                    media_type=media_type,
                    mimetype=mimetype,
                    caption=caption,
                    quoted_external_id=quoted_external_id
                )
            
            external_id = None
            if result and isinstance(result, dict):
                external_id = result.get("key", {}).get("id")
                
            MessageService.update_message_status(db, message_id, "sent", external_message_id=external_id)
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

    contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
    if not contact or not is_valid_whatsapp_destination(contact.phone):
        raise HTTPException(status_code=400, detail="Contact does not have a valid WhatsApp destination")
        
    from app.utils.media import save_base64_to_disk
    
    local_media_url = media_in.media
    if media_in.media.startswith("data:") or len(media_in.media) > 1000:
        try:
            local_media_url = save_base64_to_disk(media_in.media, media_in.mimetype)
        except Exception as e:
            logger.error(f"Failed to save outbound media: {e}")

    message_data = {
        "workspace_id": current_agent.workspace_id,
        "conversation_id": conversation.id,
        "contact_id": conversation.contact_id,
        "direction": "outbound",
        "message_type": media_in.media_type,
        "content": media_in.caption,
        "media_url": local_media_url,
        "mime_type": media_in.mimetype,
        "status": "pending"
    }
    
    quoted_external_id = None
    if media_in.quoted_message_id:
        from app.models.message import Message
        quoted_msg = db.query(Message).filter(Message.id == media_in.quoted_message_id).first()
        if quoted_msg:
            quoted_external_id = quoted_msg.external_message_id
            message_data["quoted_message_id"] = quoted_msg.id
            message_data["quoted_content"] = quoted_msg.content or "Mídia"
    
    message = MessageService.create_message(db, message_data)
    conversation.last_message_at = utcnow()
    db.commit()
    db.refresh(message)
    
    await socket_manager.broadcast({
        "type": "NEW_MESSAGE",
        "workspace_id": current_agent.workspace_id,
        "data": {
            "id": message.id,
            "workspace_id": message.workspace_id,
            "conversation_id": message.conversation_id,
            "contact_id": message.contact_id,
            "direction": message.direction,
            "message_type": message.message_type,
            "content": message.content,
            "media_url": message.media_url,
            "mime_type": message.mime_type,
            "external_message_id": message.external_message_id,
            "status": message.status,
            "created_at": message.created_at.isoformat() + "Z" if message.created_at.tzinfo is None else message.created_at.isoformat(),
            "quoted_message_id": message.quoted_message_id,
            "quoted_content": message.quoted_content
        }
    })

    background_tasks.add_task(send_media_task, message.id, conversation.id, media_in.media, media_in.media_type, media_in.mimetype, media_in.caption, current_agent.workspace_id, quoted_external_id)
    return message
