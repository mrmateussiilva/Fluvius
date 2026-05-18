import logging
import re
from sqlalchemy.orm import Session
from app.models.connection import Connection
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message
from app.services.evolution_service import EvolutionService

logger = logging.getLogger(__name__)


def is_whatsapp_chat_jid(remote_jid: str) -> bool:
    """Accept individual WA chats (@s.whatsapp.net, @c.us, @lid) and groups (@g.us)."""
    if not remote_jid or not isinstance(remote_jid, str):
        return False
    if "@" not in remote_jid:
        # If it's just digits, it's a valid phone number format from Evolution
        return remote_jid.isdigit()
    return "@s.whatsapp.net" in remote_jid or "@c.us" in remote_jid or "@g.us" in remote_jid or "@lid" in remote_jid


def contact_phone_from_jid(remote_jid: str) -> str:
    if not remote_jid:
        return ""
    if "@g.us" in remote_jid:
        return remote_jid
    prefix = remote_jid.split("@")[0]
    return prefix.split(":")[0]


async def sync_chat_record(db: Session, connection: Connection, chat: dict) -> tuple[bool, int]:
    # Evolution API v2 uses 'remoteJid' as primary field; 'id' is the DB record ID
    remote_jid = chat.get("remoteJid") or chat.get("id")
    if not remote_jid or not is_whatsapp_chat_jid(remote_jid):
        logger.debug(f"Skipping invalid JID: {remote_jid}")
        return False, 0

    phone = contact_phone_from_jid(remote_jid)
    name = chat.get("pushName") or chat.get("name") or chat.get("subject") or phone
    avatar_url = chat.get("profilePicUrl") or chat.get("pictureUrl")

    # Find or Create Contact
    contact = db.query(Contact).filter(
        Contact.workspace_id == connection.workspace_id,
        Contact.phone == phone
    ).first()

    if not contact:
        contact = Contact(
            workspace_id=connection.workspace_id,
            phone=phone,
            name=name,
            avatar_url=avatar_url
        )
        db.add(contact)
        db.commit()
        db.refresh(contact)
    else:
        changed = False
        if name and (not contact.name or contact.name == contact.phone):
            contact.name = name
            changed = True
        if avatar_url and not contact.avatar_url:
            contact.avatar_url = avatar_url
            changed = True
        if changed:
            db.commit()

    if not contact.avatar_url and not phone.endswith("@g.us"):
        profile_avatar_url = await EvolutionService.fetch_profile_picture_url(
            base_url=connection.base_url,
            api_key=connection.api_key,
            instance_name=connection.instance_name,
            number=phone
        )
        if profile_avatar_url:
            contact.avatar_url = profile_avatar_url
            db.commit()

    # Find or Create Conversation
    conversation = db.query(Conversation).filter(
        Conversation.workspace_id == connection.workspace_id,
        Conversation.inbox_id == connection.inbox_id,
        Conversation.external_id == remote_jid
    ).first()

    if not conversation:
        # We might have one without external_id if they already talked via webhook
        conversation = db.query(Conversation).filter(
            Conversation.workspace_id == connection.workspace_id,
            Conversation.inbox_id == connection.inbox_id,
            Conversation.contact_id == contact.id
        ).first()

        if conversation:
            conversation.external_id = remote_jid
            db.commit()
        else:
            conversation = Conversation(
                workspace_id=connection.workspace_id,
                inbox_id=connection.inbox_id,
                contact_id=contact.id,
                external_id=remote_jid,
                status="pending"
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

    messages = await EvolutionService.fetch_messages(
        base_url=connection.base_url,
        api_key=connection.api_key,
        instance_name=connection.instance_name,
        remote_jid=remote_jid,
        limit=30
    )

    synced_messages = 0
    for msg_data in messages:
        key = msg_data.get("key", {})
        msg_id = key.get("id")

        if not msg_id:
            continue

        # Check if already exists
        existing_msg = db.query(Message).filter(Message.external_message_id == msg_id).first()
        if existing_msg:
            continue

        # Process message details
        from_me = key.get("fromMe", False)
        direction = "outbound" if from_me else "inbound"
        message_info = msg_data.get("message", {})

        # Support message structure differences
        if not message_info and "message" in msg_data:
            message_info = msg_data["message"]

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
            media_url = msg_data.get("mediaUrl") or img.get("url")
        elif "audioMessage" in message_info:
            aud = message_info["audioMessage"]
            message_type = "audio"
            mime_type = aud.get("mimetype", "audio/ogg")
            media_url = msg_data.get("mediaUrl") or aud.get("url")
        elif "videoMessage" in message_info:
            vid = message_info["videoMessage"]
            content = vid.get("caption", "")
            message_type = "video"
            mime_type = vid.get("mimetype", "video/mp4")
            media_url = msg_data.get("mediaUrl") or vid.get("url")
        elif "documentMessage" in message_info:
            doc = message_info["documentMessage"]
            content = doc.get("title", "Documento")
            message_type = "document"
            mime_type = doc.get("mimetype", "application/pdf")
            media_url = msg_data.get("mediaUrl") or doc.get("url")
        else:
            message_type = "unknown"

        # Save new message
        new_msg = Message(
            workspace_id=connection.workspace_id,
            conversation_id=conversation.id,
            contact_id=contact.id,
            direction=direction,
            message_type=message_type,
            content=content,
            external_message_id=msg_id,
            status="delivered" if from_me else "received",
            media_url=media_url,
            mime_type=mime_type,
            raw_payload=msg_data
        )
        db.add(new_msg)
        synced_messages += 1

    db.commit()
    return True, synced_messages


from app.core.database import SessionLocal

class SyncService:
    @staticmethod
    async def sync_connection(connection_id: str) -> dict:
        # CRITICAL FIX: do NOT close the db session before using it in sync_chat_record.
        # The 'with' block was closing the session prematurely.
        db = SessionLocal()
        try:
            connection = db.query(Connection).filter(Connection.id == connection_id).first()
            if not connection:
                logger.error(f"Sync failed: Connection {connection_id} not found.")
                return {"error": "Connection not found"}

            logger.info(f"Starting sync for connection {connection_id} ({connection.instance_name})")

            # 1. Fetch individual chats (contacts you've talked to)
            chats = await EvolutionService.fetch_chats(
                base_url=connection.base_url,
                api_key=connection.api_key,
                instance_name=connection.instance_name
            )

            # Fallback: if findChats returns empty, use findContacts
            if not chats:
                logger.warning("fetch_chats returned 0 results, trying fetch_contacts as fallback...")
                raw_contacts = await EvolutionService.fetch_contacts(
                    base_url=connection.base_url,
                    api_key=connection.api_key,
                    instance_name=connection.instance_name
                )
                # Normalize contact format to match chat format expected by sync_chat_record
                # Contacts have: {"id": "...", "remoteJid": "...", "pushName": "...", ...}
                chats = []
                for c in raw_contacts:
                    jid = c.get("id") or c.get("remoteJid")
                    if jid:
                        chats.append({
                            "id": jid,
                            "pushName": c.get("pushName") or c.get("name"),
                            "name": c.get("name") or c.get("pushName"),
                            "pictureUrl": c.get("profilePictureUrl") or c.get("pictureUrl")
                        })
                logger.info(f"Normalized {len(chats)} contacts for sync")

            # 2. Fetch group chats
            groups = await EvolutionService.fetch_groups(
                base_url=connection.base_url,
                api_key=connection.api_key,
                instance_name=connection.instance_name
            )

            logger.info(f"Fetched {len(chats)} chats and {len(groups)} groups from Evolution API for {connection.instance_name}")

            synced_chats = 0
            synced_groups = 0
            synced_messages = 0
            skipped_chats = 0

            for chat in chats:
                try:
                    synced, message_count = await sync_chat_record(db, connection, chat)
                    if synced:
                        synced_chats += 1
                        synced_messages += message_count
                    else:
                        skipped_chats += 1
                except Exception as e:
                    logger.error(f"Error syncing chat {chat.get('id')}: {e}")
                    db.rollback()

            for group in groups:
                try:
                    synced, message_count = await sync_chat_record(db, connection, group)
                    if synced:
                        synced_groups += 1
                        synced_messages += message_count
                except Exception as e:
                    logger.error(f"Error syncing group {group.get('id')}: {e}")
                    db.rollback()

            logger.info(
                f"Sync complete for {connection_id}. "
                f"Synced {synced_chats} chats, {synced_groups} groups and {synced_messages} messages. "
                f"Skipped {skipped_chats} chats."
            )
            return {
                "synced_chats": synced_chats,
                "synced_groups": synced_groups,
                "synced_messages": synced_messages,
                "skipped_chats": skipped_chats,
            }
        finally:
            db.close()
