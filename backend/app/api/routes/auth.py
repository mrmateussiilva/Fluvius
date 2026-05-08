import re
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.auth import create_access_token, verify_password, get_password_hash, get_current_agent
from app.models.agent import Agent
from app.models.workspace import Workspace
from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid

router = APIRouter()

def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

class Token(BaseModel):
    access_token: str
    token_type: str
    agent: dict

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    company_name: str
    agent_name: str
    email: EmailStr
    password: str

@router.post("/register", response_model=Token)
async def register(
    register_data: RegisterRequest,
    db: Session = Depends(get_db)
):
    if len(register_data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve conter no mínimo 6 caracteres"
        )

    # Check if email is already in use
    existing_agent = db.query(Agent).filter(Agent.email == register_data.email).first()
    if existing_agent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este e-mail já está em uso"
        )
        
    # Generate slug for workspace
    base_slug = slugify(register_data.company_name)
    slug = base_slug
    # Handle slug collisions
    while db.query(Workspace).filter(Workspace.slug == slug).first() is not None:
        slug = f"{base_slug}-{str(uuid.uuid4())[:6]}"
        
    # Create workspace
    workspace = Workspace(name=register_data.company_name, slug=slug)
    db.add(workspace)
    db.flush() # flush to get the workspace.id
    
    # Create admin agent
    hashed_pw = get_password_hash(register_data.password)
    admin_agent = Agent(
        workspace_id=workspace.id,
        name=register_data.agent_name,
        email=register_data.email,
        hashed_password=hashed_pw,
        role="admin"
    )
    db.add(admin_agent)
    db.commit()
    db.refresh(admin_agent)
    
    # Generate token for immediate login
    access_token = create_access_token(data={"sub": admin_agent.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "agent": {
            "id": admin_agent.id,
            "name": admin_agent.name,
            "email": admin_agent.email,
            "role": admin_agent.role,
            "avatar_url": admin_agent.avatar_url
        }
    }

@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    agent = db.query(Agent).filter(Agent.email == login_data.email).first()
    
    if not agent or not verify_password(login_data.password, agent.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": agent.id})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "agent": {
            "id": agent.id,
            "name": agent.name,
            "email": agent.email,
            "role": agent.role,
            "avatar_url": agent.avatar_url
        }
    }

@router.get("/me")
async def get_me(current_agent: Agent = Depends(get_current_agent)):
    return {
        "id": current_agent.id,
        "name": current_agent.name,
        "email": current_agent.email,
        "role": current_agent.role,
        "avatar_url": current_agent.avatar_url,
        "workspace_id": current_agent.workspace_id
    }
