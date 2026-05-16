import sys
import os

# Add backend to path
os.chdir('backend')
sys.path.append(os.getcwd())

from app.core.database import SessionLocal
from app.models.workspace import Workspace
from app.models.agent import Agent
from app.core.auth import get_password_hash
from app.models.workspace import generate_uuid, utcnow

def create_finderbit_admin():
    db = SessionLocal()
    try:
        # 1. Find workspace "finderbit"
        workspace = db.query(Workspace).filter(Workspace.name == 'finderbit').first()
        if not workspace:
            # Maybe it's registered under a different name but the user refers to it as finderbit
            # Let's list all workspaces to be sure
            workspaces = db.query(Workspace).all()
            print(f"Workspaces available: {[w.name for w in workspaces]}")
            return

        print(f"Found workspace: {workspace.name} (ID: {workspace.id})")

        # 2. Check if admin already exists
        email = "admin@finderbit.com.br" # Professional email suggestion
        existing = db.query(Agent).filter(Agent.email == email).first()
        if existing:
            print(f"Agent {email} already exists. Updating password to 'finder123'.")
            existing.hashed_password = get_password_hash("finder123")
            existing.role = "admin"
            db.commit()
            return

        # 3. Create admin
        new_admin = Agent(
            id=generate_uuid(),
            workspace_id=workspace.id,
            name="Admin Finderbit",
            email=email,
            hashed_password=get_password_hash("finder123"),
            role="admin",
            is_online=False,
            created_at=utcnow()
        )
        db.add(new_admin)
        db.commit()
        print(f"Admin created successfully!")
        print(f"Login: {email}")
        print(f"Senha: finder123")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_finderbit_admin()
