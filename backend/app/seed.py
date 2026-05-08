from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.models.workspace import Workspace
from app.models.inbox import Inbox
from app.models.connection import Connection
from app.models.contact import Contact
from app.models.conversation import Conversation
from app.models.message import Message

def seed_db():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("Seeding database...")
        
        # Check if already seeded
        workspace = db.query(Workspace).filter(Workspace.slug == "default").first()
        if not workspace:
            workspace = Workspace(name="Default Workspace", slug="default")
            db.add(workspace)
            db.commit()
            db.refresh(workspace)
            
            inbox = Inbox(
                workspace_id=workspace.id,
                name="WhatsApp Evolution",
                channel_type="whatsapp"
            )
            db.add(inbox)
            db.commit()
            db.refresh(inbox)
            
            connection = Connection(
                workspace_id=workspace.id,
                inbox_id=inbox.id,
                name="Evolution API Dev",
                provider="evolution_api",
                instance_name="dev_instance",
                base_url="http://localhost:8080",
                api_key="dev_api_key_123",
                status="online"
            )
            db.add(connection)
            db.commit()
            
            # Create a mock contact and conversation for development
            contact = Contact(
                workspace_id=workspace.id,
                phone="5511999999999",
                name="John Doe"
            )
            db.add(contact)
            db.commit()
            db.refresh(contact)
            
            conversation = Conversation(
                workspace_id=workspace.id,
                inbox_id=inbox.id,
                contact_id=contact.id
            )
            db.add(conversation)
            db.commit()
            db.refresh(conversation)
            
            message = Message(
                workspace_id=workspace.id,
                conversation_id=conversation.id,
                contact_id=contact.id,
                direction="inbound",
                message_type="text",
                content="Hello from the other side!",
                status="delivered",
                external_message_id="mock_id_1"
            )
            db.add(message)
            db.commit()
            
            print("Database seeded successfully!")
        else:
            print("Database already seeded.")
            
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
