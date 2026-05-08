from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from jose import jwt
import os

from app.core.config import settings
from app.core.socket_manager import socket_manager
from app.core.database import get_db
from app.core.auth import SECRET_KEY, ALGORITHM
from app.models.agent import Agent

from app.api.routes import (
    health_router,
    conversations_router,
    messages_router,
    webhooks_router,
    connections_router,
    agents_router,
    auth_router,
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(health_router)
app.include_router(conversations_router)
app.include_router(messages_router)
app.include_router(webhooks_router)
app.include_router(connections_router)
app.include_router(agents_router)
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket, 
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        # Manual JWT Verification for WebSocket
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        agent_id: str = payload.get("sub")
        if not agent_id:
            await websocket.close(code=1008) # Policy Violation
            return
            
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            await websocket.close(code=1008)
            return

        workspace_id = agent.workspace_id
        await socket_manager.connect(websocket, workspace_id, agent_id)
        
        try:
            while True:
                # Keep connection alive
                await websocket.receive_text()
        except WebSocketDisconnect:
            socket_manager.disconnect(websocket, workspace_id, agent_id)
        except Exception:
            socket_manager.disconnect(websocket, workspace_id, agent_id)
            
    except Exception as e:
        print(f"WS Auth Error: {e}")
        await websocket.close(code=1008)
