from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from jose import jwt
import os
import logging

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
    contacts_router,
    dashboard_router,
    auth_router,
    queues_router,
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
cors_origins = list(dict.fromkeys([*settings.BACKEND_CORS_ORIGINS, settings.FRONTEND_ORIGIN]))
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
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
app.include_router(contacts_router)
app.include_router(dashboard_router)
app.include_router(queues_router)
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

# Create uploads dir if it doesn't exist
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket, 
    token: str | None = Query(default=None),
    db: Session = Depends(get_db)
):
    agent_id = None
    workspace_id = None
    try:
        # Manual JWT Verification for WebSocket
        if not token:
            logger.warning("WS: connection rejected because token is missing")
            await websocket.accept()
            await websocket.close(code=1008)
            return

        logger.info("WS: received connection attempt")
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except Exception as jwt_err:
            logger.warning("WS: token validation failed: %s", jwt_err)
            await websocket.accept()
            await websocket.close(code=1008)
            return

        agent_id: str = payload.get("sub")
        if not agent_id:
            logger.warning("WS: token rejected because subject is missing")
            await websocket.accept()
            await websocket.close(code=1008)
            return
            
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            logger.warning("WS: token rejected because agent %s was not found", agent_id)
            await websocket.accept()
            await websocket.close(code=1008)
            return

        workspace_id = agent.workspace_id
        logger.info("WS: accepted agent %s from workspace %s", agent_id, workspace_id)
        await socket_manager.connect(websocket, workspace_id, agent_id)
        
        try:
            while True:
                # Keep connection alive
                await websocket.receive_text()
        except WebSocketDisconnect:
            logger.info("WS: agent %s disconnected", agent_id)
            socket_manager.disconnect(websocket, workspace_id, agent_id)
        except Exception as e:
            logger.exception("WS: error in message loop for agent %s: %s", agent_id, e)
            socket_manager.disconnect(websocket, workspace_id, agent_id)
            
    except Exception as e:
        logger.exception("WS: general error for agent %s: %s", agent_id, e)
        try:
            await websocket.close(code=1008)
        except Exception:
            pass
