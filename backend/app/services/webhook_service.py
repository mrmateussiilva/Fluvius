from sqlalchemy.orm import Session
from app.models.webhook_event import WebhookEvent
from app.models.connection import Connection
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message
from app.core.socket_manager import socket_manager
import logging

logger = logging.getLogger(__name__)

class WebhookService:
    @staticmethod
    async def process_webhook(db: Session, connection_id: str, payload: dict) -> WebhookEvent:
        # Save raw payload
        event = WebhookEvent(
            connection_id=connection_id,
            provider="evolution_api",
            event_type=payload.get("event", "unknown"),
            payload=payload
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        try:
            # Process only message upserts
            if event.event_type == "messages.upsert":
                await WebhookService._handle_message_upsert(db, connection_id, payload)
            else:
                logger.debug(f"Ignoring event type: {event.event_type}")
            
            event.processed = True
            db.commit()
        except Exception as e:
            logger.error(f"Error processing webhook {event.id}: {e}")
            event.error = str(e)
            db.commit()
            
        return event

    @staticmethod
    async def _handle_message_upsert(db: Session, connection_id: str, payload: dict):
        connection = db.query(Connection).filter(Connection.id == connection_id).first()
        if not connection:
            logger.error(f"Connection {connection_id} not found")
            return
            
        data = payload.get("data", {})
        message_info = data.get("message", {})
        key = data.get("key", {})
        
        # Determine if inbound or outbound
        from_me = key.get("fromMe", False)
        direction = "outbound" if from_me else "inbound"
        
        # Phone extraction
        remote_jid = key.get("remoteJid", "")
        phone = remote_jid.split("@")[0] if "@" in remote_jid else remote_jid
        
        # Content and Media extraction
        content = ""
        media_url = None
        mime_type = None
        message_type = "text"

        if "conversation" in message_info:
            content = message_info["conversation"]
            message_type = "text"
        elif "extendedTextMessage" in message_info:
            content = message_info["extendedTextMessage"].get("text", "")
            message_type = "text"
        elif "imageMessage" in message_info:
            img = message_info["imageMessage"]
            content = img.get("caption", "")
            message_type = "image"
            mime_type = img.get("mimetype", "image/jpeg")
            # In Evolution API v2, the media URL might be in 'mediaUrl' or we use a placeholder
            # For now, we store what we find or use a flag to fetch it later
            media_url = data.get("mediaUrl") or img.get("url")
        elif "audioMessage" in message_info:
            aud = message_info["audioMessage"]
            message_type = "audio"
            mime_type = aud.get("mimetype", "audio/ogg")
            media_url = data.get("mediaUrl") or aud.get("url")
        elif "videoMessage" in message_info:
            vid = message_info["videoMessage"]
            content = vid.get("caption", "")
            message_type = "video"
            mime_type = vid.get("mimetype", "video/mp4")
            media_url = data.get("mediaUrl") or vid.get("url")
        elif "documentMessage" in message_info:
            doc = message_info["documentMessage"]
            content = doc.get("title", "Documento")
            message_type = "document"
            mime_type = doc.get("mimetype", "application/pdf")
            media_url = data.get("mediaUrl") or doc.get("url")

        push_name = data.get("pushName", phone)
        external_id = key.get("id", "")
        
        if not phone or not external_id:
            logger.warning("Missing phone or external ID in payload")
            return
            
        # Get or create contact
        contact = db.query(Contact).filter(
            Contact.workspace_id == connection.workspace_id,
            Contact.phone == phone
        ).first()
        
        if not contact:
            contact = Contact(
                workspace_id=connection.workspace_id,
                phone=phone,
                name=push_name
            )
            db.add(contact)
            db.commit()
            db.refresh(contact)
            
        # Get or create conversation
        conversation = db.query(Conversation).filter(
            Conversation.inbox_id == connection.inbox_id,
            Conversation.contact_id == contact.id
        ).first()
        
        if not conversation:
            conversation = Conversation(
                workspace_id=connection.workspace_id,
                inbox_id=connection.inbox_id,
                contact_id=contact.id,
                status="pending"
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            
        # Create message if it doesn't exist
        existing_msg = db.query(Message).filter(Message.external_message_id == external_id).first()
        if not existing_msg:
            msg = Message(
                workspace_id=connection.workspace_id,
                conversation_id=conversation.id,
                contact_id=contact.id,
                direction=direction,
                message_type=message_type,
                content=content,
                media_url=media_url,
                mime_type=mime_type,
                external_message_id=external_id,
                status="delivered" if direction == "inbound" else "sent",
                raw_payload=payload
            )
            db.add(msg)
            
            # Update conversation
            from app.models.workspace import utcnow
            conversation.last_message_at = utcnow()
            
            # If inbound and resolved, re-open
            if direction == "inbound":
                conversation.unread_count += 1
                if conversation.status == "resolved":
                    conversation.status = "pending"
                    conversation.assignee_id = None

            db.commit()
            db.refresh(msg)
            db.refresh(conversation)

            # BROADCAST WS EVENTS
            # 1. New Message
            await socket_manager.broadcast({
                "type": "NEW_MESSAGE",
                "workspace_id": connection.workspace_id,
                "data": {
                    "id": msg.id,
                    "conversation_id": msg.conversation_id,
                    "direction": msg.direction,
                    "message_type": msg.message_type,
                    "content": msg.content,
                    "media_url": msg.media_url,
                    "mime_type": msg.mime_type,
                    "created_at": msg.created_at.isoformat()
                }
            })

            # 2. Conversation Updated (for the list)
            await socket_manager.broadcast({
                "type": "CONVERSATION_UPDATED",
                "workspace_id": connection.workspace_id,
                "data": {
                    "id": conversation.id,
                    "status": conversation.status,
                    "unread_count": conversation.unread_count,
                    "last_message_at": conversation.last_message_at.isoformat() if conversation.last_message_at else None,
                    "assignee_id": conversation.assignee_id
                }
            })
