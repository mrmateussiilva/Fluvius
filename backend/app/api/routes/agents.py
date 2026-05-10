from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth import get_current_agent, get_password_hash
from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentRead, AgentUpdate
from app.models.workspace import generate_uuid, utcnow

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("", response_model=List[AgentRead])
def get_agents(
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    return db.query(Agent).filter(Agent.workspace_id == current_agent.workspace_id).all()


@router.post("", response_model=AgentRead, status_code=201)
def create_agent(
    agent_in: AgentCreate, 
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    existing = db.query(Agent).filter(Agent.email == agent_in.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Agent with this email already exists")

    agent = Agent(
        id=generate_uuid(),
        workspace_id=current_agent.workspace_id,
        name=agent_in.name,
        email=agent_in.email,
        role=agent_in.role,
        avatar_url=agent_in.avatar_url,
        is_online=False,
        created_at=utcnow(),
        hashed_password=get_password_hash(agent_in.password) if agent_in.password else None,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent

@router.patch("/{agent_id}", response_model=AgentRead)
def update_agent(
    agent_id: str,
    agent_in: AgentUpdate,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    if current_agent.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update agents")

    agent = db.query(Agent).filter(
        Agent.id == agent_id, 
        Agent.workspace_id == current_agent.workspace_id
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if agent_in.name is not None:
        agent.name = agent_in.name
    if agent_in.email is not None:
        agent.email = agent_in.email
    if agent_in.role is not None:
        agent.role = agent_in.role
    if agent_in.avatar_url is not None:
        agent.avatar_url = agent_in.avatar_url
    if agent_in.password:
        agent.hashed_password = get_password_hash(agent_in.password)
    
    db.commit()
    db.refresh(agent)
    return agent

@router.delete("/{agent_id}")
def delete_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    if current_agent.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete agents")

    if agent_id == current_agent.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    agent = db.query(Agent).filter(
        Agent.id == agent_id, 
        Agent.workspace_id == current_agent.workspace_id
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    db.delete(agent)
    db.commit()
    return {"status": "success"}
