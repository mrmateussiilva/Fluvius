from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth import get_current_agent
from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentRead
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
        avatar_url=agent_in.avatar_url,
        is_online=False,
        created_at=utcnow(),
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent
