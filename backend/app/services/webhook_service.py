from sqlalchemy.orm import Session
from app.models.webhook_event import WebhookEvent
from app.models.connection import Connection
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.inbox import Inbox
from app.models.message import Message
from app.core.socket_manager import socket_manager
from app.services.evolution_service import EvolutionService
from app.services.sync_service import SyncService
import logging
import asyncio

logger = logging.getLogger(__name__)


def contact_phone_from_remote_jid(remote_jid: str) -> str:
    if not remote_jid:
        return ""
    if remote_jid.endswith("@g.us"):
        return remote_jid
    # Handle phone:device@s.whatsapp.net or LID
    phone_part = remote_jid.split("@")[0]
    return phone_part.split(":")[0]

class WebhookService:
    @staticmethod
    async def _send_conversation_event(conversation: Conversation, message: dict):
        if conversation.assignee_id:
            await socket_manager.send_personal_message(
                message,
                conversation.workspace_id,
                conversation.assignee_id,
            )
            return

        await socket_manager.broadcast(message)

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
            # Route events to handlers
            if event.event_type in ["messages.upsert", "send.message"]:
                await WebhookService._handle_message_upsert(db, connection_id, payload)
            elif event.event_type == "messages.update":
                await WebhookService._handle_message_update(db, connection_id, payload)
            elif event.event_type == "connection.update":
                await WebhookService._handle_connection_update(db, connection_id, payload)
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
        
        external_id = key.get("id", "")
        if external_id:
            # Idempotência: verifica imediatamente se a mensagem já foi processada na MESMA conexão (inbox)
            existing_msg = db.query(Message).join(Conversation).filter(
                Message.external_message_id == external_id,
                Conversation.inbox_id == connection.inbox_id
            ).first()
            if existing_msg:
                # Se for mensagem duplicada (já existe), verifica se é uma atualização de status disfarçada de upsert
                new_status_raw = data.get("status") or message_info.get("status")
                if new_status_raw:
                    status_map = {
                        "SERVER_ACK": "sent",
                        "DELIVERY_ACK": "delivered",
                        "READ": "read",
                        "PLAYED": "read",
                        "2": "sent",
                        "3": "delivered",
                        "4": "read"
                    }
                    new_status = status_map.get(str(new_status_raw).upper())
                    if new_status and existing_msg.status != new_status:
                        status_order = {"pending": 0, "sent": 1, "delivered": 2, "read": 3, "failed": -1}
                        if status_order.get(new_status, 0) > status_order.get(existing_msg.status, 0):
                            existing_msg.status = new_status
                            db.commit()
                            import asyncio
                            asyncio.create_task(socket_manager.broadcast({
                                "type": "MESSAGE_STATUS_UPDATED",
                                "workspace_id": existing_msg.workspace_id,
                                "data": {
                                    "id": existing_msg.id,
                                    "conversation_id": existing_msg.conversation_id,
                                    "status": existing_msg.status
                                }
                            }))
                logger.debug(f"Message {external_id} already exists. Ignoring duplicate webhook.")
                return

        # Determine if inbound or outbound
        from_me = key.get("fromMe", False)
        direction = "outbound" if from_me else "inbound"
        
        # Phone extraction
        remote_jid = key.get("remoteJid", "")
        remote_jid_alt = key.get("remoteJidAlt")
        
        # If remoteJid is a LID (Linked ID), try to use the alternative JID which is usually the real phone number
        if "@lid" in remote_jid and remote_jid_alt and "@s.whatsapp.net" in remote_jid_alt:
            remote_jid = remote_jid_alt
            
        phone = contact_phone_from_remote_jid(remote_jid)
        
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
            
        # Handle Base64 media directly from Evolution API
        base64_data = message_info.get("base64") or data.get("base64")
        from app.utils.media import save_base64_to_disk, download_media
        from app.services.evolution_service import EvolutionService
        
        # If no base64 in webhook but it is a media message, request decryption
        if not base64_data and message_type in ["image", "audio", "video", "document"] and "message" in data:
            try:
                base64_data = await EvolutionService.get_base64_from_media_message(
                    base_url=connection.base_url,
                    api_key=connection.api_key,
                    instance_name=connection.instance_name,
                    message=data["message"]
                )
            except Exception as e:
                logger.error(f"Failed to decrypt inbound media: {e}")

        if base64_data and mime_type:
            try:
                media_url = save_base64_to_disk(base64_data, mime_type)
            except Exception as e:
                logger.error(f"Failed to save incoming base64 media: {e}")
        elif media_url and mime_type and ("localhost" in media_url or "host.docker.internal" in media_url or "/message/download" in media_url):
            # If it's an Evolution API download URL, download it locally
            try:
                media_url = await download_media(media_url, connection.api_key, mime_type)
            except Exception as e:
                logger.error(f"Failed to download inbound media: {e}")
            
        # Check contextInfo for quoted message
        context_info = message_info.get("extendedTextMessage", {}).get("contextInfo", {})
        if not context_info:
            for msg_type in ["imageMessage", "videoMessage", "audioMessage", "documentMessage"]:
                if msg_type in message_info and "contextInfo" in message_info[msg_type]:
                    context_info = message_info[msg_type]["contextInfo"]
                    break
        if not context_info:
            context_info = data.get("contextInfo", {}) or message_info.get("contextInfo", {})

        quoted_external_id = context_info.get("stanzaId")
        quoted_message_id = None
        quoted_content = None

        if quoted_external_id:
            quoted_msg = db.query(Message).filter(Message.external_message_id == quoted_external_id).first()
            if quoted_msg:
                quoted_message_id = quoted_msg.id
            
            q_message = context_info.get("quotedMessage", {})
            if "conversation" in q_message:
                quoted_content = q_message["conversation"]
            elif "extendedTextMessage" in q_message:
                quoted_content = q_message["extendedTextMessage"].get("text", "Mensagem")
            elif "imageMessage" in q_message:
                quoted_content = q_message["imageMessage"].get("caption", "Imagem")
            elif "audioMessage" in q_message:
                quoted_content = "Áudio"
            elif "videoMessage" in q_message:
                quoted_content = "Vídeo"
            elif "documentMessage" in q_message:
                quoted_content = "Documento"

        # Handle Base64 media directly from Evolution API
        # (REMOVED OLD DUPLICATE BLOCK HERE)
        
        push_name = (
            data.get("groupName")
            or data.get("subject")
            or (phone if remote_jid.endswith("@g.us") else data.get("pushName", phone))
        )
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
        elif push_name and (not contact.name or contact.name == contact.phone):
            contact.name = push_name
            db.commit()

        if not contact.avatar_url:
            avatar_url = await EvolutionService.fetch_profile_picture_url(
                base_url=connection.base_url,
                api_key=connection.api_key,
                instance_name=connection.instance_name,
                number=phone
            )
            if avatar_url:
                contact.avatar_url = avatar_url
                db.commit()
            
        # Get or create conversation
        conversation = db.query(Conversation).filter(
            Conversation.inbox_id == connection.inbox_id,
            Conversation.contact_id == contact.id
        ).first()
        
        inbox = db.query(Inbox).filter(Inbox.id == connection.inbox_id).first()
        
        if not conversation:
            conversation = Conversation(
                workspace_id=connection.workspace_id,
                inbox_id=connection.inbox_id,
                contact_id=contact.id,
                status="bot" if (inbox and inbox.default_bot_active) else "pending"
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            
        # At this point we know the external_id does not exist in the DB (due to idempotency check at the top).
        msg = None
        is_new_message = False
        
        if direction == "outbound":
            # This is a webhook echo of a message already sent via Fluvius.
            # Try to find the existing pending message in this conversation to avoid duplicates.
            # Match by content and pending status — the background task hasn't set the external_id yet.
            existing_pending = db.query(Message).filter(
                Message.conversation_id == conversation.id,
                Message.direction == "outbound",
                Message.status == "pending",
                Message.external_message_id == None,
                Message.content == content,
            ).order_by(Message.created_at.desc()).first()

            if existing_pending:
                # Update the existing message instead of creating a duplicate
                existing_pending.external_message_id = external_id
                existing_pending.status = "sent"
                db.commit()
                db.refresh(existing_pending)
                msg = existing_pending
                # No need to broadcast — the background task will emit MESSAGE_STATUS_UPDATED
                return

        # Truly a new message (inbound, or outbound initiated from another WhatsApp device)
        is_new_message = True
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
            quoted_message_id=quoted_message_id,
            quoted_content=quoted_content,
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

        # Process Bot Logic if applicable
        if direction == "inbound" and conversation.status == "bot":
            from app.services.bot_service import BotService
            await BotService.process_bot_message(db, conversation, content, inbox, phone, connection)

        if is_new_message:
            # BROADCAST WS EVENTS
            # 1. New Message
            await WebhookService._send_conversation_event(conversation, {
                "type": "NEW_MESSAGE",
                "workspace_id": connection.workspace_id,
                "data": {
                    "id": msg.id,
                    "workspace_id": msg.workspace_id,
                    "conversation_id": msg.conversation_id,
                    "contact_id": msg.contact_id,
                    "direction": msg.direction,
                    "message_type": msg.message_type,
                    "content": msg.content,
                    "media_url": msg.media_url,
                    "mime_type": msg.mime_type,
                    "external_message_id": msg.external_message_id,
                    "status": msg.status,
                    "created_at": msg.created_at.isoformat() + "Z" if msg.created_at.tzinfo is None else msg.created_at.isoformat(),
                    "quoted_message_id": msg.quoted_message_id,
                    "quoted_content": msg.quoted_content
                }
            })

            # 2. Conversation Updated (for the list)
            await WebhookService._send_conversation_event(conversation, {
                "type": "CONVERSATION_UPDATED",
                "workspace_id": connection.workspace_id,
                "data": {
                    "id": conversation.id,
                    "status": conversation.status,
                    "unread_count": conversation.unread_count,
                    "last_message_at": (conversation.last_message_at.isoformat() + "Z" if conversation.last_message_at.tzinfo is None else conversation.last_message_at.isoformat()) if conversation.last_message_at else None,
                    "assignee_id": conversation.assignee_id
                }
            })

    @staticmethod
    async def _handle_message_update(db: Session, connection_id: str, payload: dict):
        connection = db.query(Connection).filter(Connection.id == connection_id).first()
        if not connection:
            return

        data = payload.get("data", {})
        # Evolution structure for messages.update is often an array or single object
        if isinstance(data, list) and len(data) > 0:
            update_data = data[0]
        else:
            update_data = data
            
        key = update_data.get("key", {})
        external_id = update_data.get("keyId") or key.get("id")
        
        update_info = update_data.get("update", {})
        new_status_raw = update_data.get("status") or update_info.get("status")
        
        if not external_id or not new_status_raw:
            return

        # Evolution status maps: 2=SERVER_ACK, 3=DELIVERY_ACK, 4=READ
        # Or it might send string "PENDING", "SERVER_ACK", "DELIVERY_ACK", "READ", "PLAYED"
        status_map = {
            "SERVER_ACK": "sent",
            "DELIVERY_ACK": "delivered",
            "READ": "read",
            "PLAYED": "read",
            "2": "sent",
            "3": "delivered",
            "4": "read"
        }
        
        new_status = status_map.get(str(new_status_raw).upper())
        
        if not new_status:
             return
             
        message = db.query(Message).join(Conversation).filter(
            Message.external_message_id == external_id,
            Conversation.inbox_id == connection.inbox_id
        ).first()
        
        if not message:
            return
            
        status_order = {"pending": 0, "sent": 1, "delivered": 2, "read": 3, "failed": -1}
        if status_order.get(new_status, 0) <= status_order.get(message.status, 0):
             # Ignora se o status for igual ou mais antigo
             return

        message.status = new_status
        db.commit()
        
        await socket_manager.broadcast({
            "type": "MESSAGE_STATUS_UPDATED",
            "workspace_id": message.workspace_id,
            "data": {
                "id": message.id,
                "conversation_id": message.conversation_id,
                "status": message.status
            }
        })

    @staticmethod
    async def _handle_connection_update(db: Session, connection_id: str, payload: dict):
        connection = db.query(Connection).filter(Connection.id == connection_id).first()
        if not connection:
            return

        data = payload.get("data", {})
        state = data.get("state")
        
        if not state:
            return
            
        status_map = {
            "open": "connected",
            "connecting": "connecting",
            "close": "disconnected",
            "qr": "qrcode"
        }
        
        new_status = status_map.get(state.lower())
        if new_status:
            connection.status = new_status
            db.commit()
            
            await socket_manager.broadcast({
                "type": "CONNECTION_STATUS_UPDATED",
                "workspace_id": connection.workspace_id,
                "data": {
                    "id": connection.id,
                    "status": connection.status
                }
            })
            
            if new_status == "connected":
                # Trigger historical sync in the background
                asyncio.create_task(SyncService.sync_connection(connection.id))
