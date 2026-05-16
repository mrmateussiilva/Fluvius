from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.auth import get_current_agent
from app.models.quick_reply import QuickReply
from app.models.agent import Agent
from app.schemas.quick_reply import QuickReplyRead, QuickReplyCreate, QuickReplyUpdate

router = APIRouter(prefix="/api/quick-replies", tags=["quick-replies"])

@router.get("", response_model=List[QuickReplyRead])
def get_quick_replies(
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    return db.query(QuickReply).filter(QuickReply.workspace_id == current_agent.workspace_id).all()

@router.post("", response_model=QuickReplyRead)
def create_quick_reply(
    body: QuickReplyCreate,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    new_qr = QuickReply(
        workspace_id=current_agent.workspace_id,
        shortcut=body.shortcut.lstrip('/'),
        content=body.content
    )
    db.add(new_qr)
    db.commit()
    db.refresh(new_qr)
    return new_qr

@router.put("/{qr_id}", response_model=QuickReplyRead)
def update_quick_reply(
    qr_id: str,
    body: QuickReplyUpdate,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    qr = db.query(QuickReply).filter(
        QuickReply.id == qr_id,
        QuickReply.workspace_id == current_agent.workspace_id
    ).first()
    if not qr:
        raise HTTPException(status_code=404, detail="Quick reply not found")
    
    if body.shortcut is not None:
        qr.shortcut = body.shortcut.lstrip('/')
    if body.content is not None:
        qr.content = body.content
        
    db.commit()
    db.refresh(qr)
    return qr

@router.delete("/{qr_id}")
def delete_quick_reply(
    qr_id: str,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    qr = db.query(QuickReply).filter(
        QuickReply.id == qr_id,
        QuickReply.workspace_id == current_agent.workspace_id
    ).first()
    if not qr:
        raise HTTPException(status_code=404, detail="Quick reply not found")
    
    db.delete(qr)
    db.commit()
    return {"detail": "Deleted"}
