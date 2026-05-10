from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_agent
from app.models.connection import Connection
from app.models.agent import Agent
from app.schemas.connection import ConnectionRead
from app.services.evolution_service import EvolutionService
from app.services.sync_service import SyncService

router = APIRouter(prefix="/api/connections", tags=["connections"])

@router.get("", response_model=List[ConnectionRead])
def get_connections(
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    connections = db.query(Connection).filter(Connection.workspace_id == current_agent.workspace_id).all()
    return connections

class ConnectionCreate(BaseModel):
    name: str
    instance_name: Optional[str] = None

@router.post("", response_model=ConnectionRead)
async def create_connection(
    body: ConnectionCreate,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    import uuid
    instance_name = body.instance_name or f"fluvius_{uuid.uuid4().hex[:8]}"
    
    # We should probably have a default evolution URL and API key in settings
    from app.core.config import settings
    
    # Check if instance already exists in DB
    existing = db.query(Connection).filter(Connection.instance_name == instance_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Instance name already exists")

    try:
        # 1. Create instance in Evolution API
        await EvolutionService.create_instance(
            instance_name=instance_name,
            # For MVP, we use the global credentials from settings
            # In a real SaaS, you might have different clusters
        )
        
        # 2. Save in DB
        # We need an inbox_id too. For now, let's create a placeholder inbox or link it
        # Actually, in this model, Connection belongs to an Inbox.
        # Let's create an Inbox first or simplify.
        from app.models.inbox import Inbox
        inbox = Inbox(workspace_id=current_agent.workspace_id, name=body.name, channel_type="whatsapp")
        db.add(inbox)
        db.commit()
        db.refresh(inbox)

        new_conn = Connection(
            workspace_id=current_agent.workspace_id,
            inbox_id=inbox.id,
            name=body.name,
            provider="evolution_api",
            instance_name=instance_name,
            status="disconnected",
            base_url=settings.evolution_base_url,
            api_key=settings.EVOLUTION_API_KEY
        )
        db.add(new_conn)
        db.commit()
        db.refresh(new_conn)
        
        # 3. Set Webhook in Evolution API
        webhook_url = f"{settings.webhook_public_base_url.rstrip('/')}/webhooks/evolution/{new_conn.id}"
        await EvolutionService.set_webhook(instance_name=instance_name, webhook_url=webhook_url)
        
        return new_conn
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create connection: {str(e)}")

@router.get("/{connection_id}/qr")
async def get_connection_qr(
    connection_id: str, 
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.workspace_id == current_agent.workspace_id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        qr_data = await EvolutionService.get_qrcode(
            base_url=connection.base_url,
            api_key=connection.api_key,
            instance_name=connection.instance_name
        )
        return qr_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{connection_id}/status")
async def get_connection_status(
    connection_id: str, 
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.workspace_id == current_agent.workspace_id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        state_data = await EvolutionService.get_connection_state(
            base_url=connection.base_url,
            api_key=connection.api_key,
            instance_name=connection.instance_name
        )
        
        # Update local status if it changed
        new_status = state_data.get("instance", {}).get("state", connection.status)
        if new_status != connection.status:
            connection.status = new_status
            db.commit()
            
        return state_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{connection_id}")
async def delete_connection(
    connection_id: str,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.workspace_id == current_agent.workspace_id
    ).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        # Try to delete from Evolution API (best-effort, don't fail if already gone)
        try:
            await EvolutionService.delete_instance(instance_name=connection.instance_name)
        except Exception:
            pass
        
        db.delete(connection)
        db.commit()
        return {"status": "deleted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{connection_id}/logout")
async def logout_connection(
    connection_id: str,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.workspace_id == current_agent.workspace_id
    ).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        await EvolutionService.logout_instance(instance_name=connection.instance_name)
        connection.status = "disconnected"
        db.commit()
        return {"status": "logged_out"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{connection_id}/restart")
async def restart_connection(
    connection_id: str,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    """Restart instance to generate a fresh QR Code for reconnection."""
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.workspace_id == current_agent.workspace_id
    ).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    try:
        await EvolutionService.restart_instance(instance_name=connection.instance_name)
        connection.status = "disconnected"
        db.commit()
        return {"status": "restarted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{connection_id}/sync")
async def sync_connection(
    connection_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent)
):
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.workspace_id == current_agent.workspace_id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
        
    # Run sync in background
    background_tasks.add_task(SyncService.sync_connection, connection_id)
    
    return {"status": "sync_started", "message": "Synchronization started in background"}

