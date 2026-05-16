from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.auth import get_current_agent
from app.models.agent import Agent
from app.models.queue import Queue
from app.schemas.queue import QueueRead, QueueCreate, QueueUpdate, AgentQueueUpdate

router = APIRouter(prefix="/api/queues", tags=["queues"])

@router.get("", response_model=List[QueueRead])
def list_queues(
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    return db.query(Queue).filter(Queue.workspace_id == current_agent.workspace_id).all()

@router.post("", response_model=QueueRead)
def create_queue(
    queue_in: QueueCreate,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    if current_agent.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    queue = Queue(
        workspace_id=current_agent.workspace_id,
        name=queue_in.name,
        description=queue_in.description
    )
    db.add(queue)
    db.commit()
    db.refresh(queue)
    return queue

@router.put("/{queue_id}", response_model=QueueRead)
def update_queue(
    queue_id: str,
    queue_in: QueueUpdate,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    if current_agent.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    queue = db.query(Queue).filter(
        Queue.id == queue_id,
        Queue.workspace_id == current_agent.workspace_id
    ).first()
    
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")
        
    if queue_in.name is not None:
        queue.name = queue_in.name
    if queue_in.description is not None:
        queue.description = queue_in.description
        
    db.commit()
    db.refresh(queue)
    return queue

@router.delete("/{queue_id}")
def delete_queue(
    queue_id: str,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    if current_agent.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    queue = db.query(Queue).filter(
        Queue.id == queue_id,
        Queue.workspace_id == current_agent.workspace_id
    ).first()
    
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")
        
    db.delete(queue)
    db.commit()
    return {"status": "deleted"}

@router.get("/{queue_id}/agents", response_model=List[str])
def get_queue_agents(
    queue_id: str,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    queue = db.query(Queue).filter(
        Queue.id == queue_id,
        Queue.workspace_id == current_agent.workspace_id
    ).first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")
    return [agent.id for agent in queue.agents]

@router.post("/{queue_id}/agents")
def update_queue_agents(
    queue_id: str,
    payload: AgentQueueUpdate,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    if current_agent.role != "admin":
        raise HTTPException(status_code=403, detail="Not enough permissions")
        
    queue = db.query(Queue).filter(
        Queue.id == queue_id,
        Queue.workspace_id == current_agent.workspace_id
    ).first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")
        
    agents = db.query(Agent).filter(
        Agent.id.in_(payload.agent_ids),
        Agent.workspace_id == current_agent.workspace_id
    ).all()
    
    queue.agents = agents
    db.commit()
    return {"status": "success"}
