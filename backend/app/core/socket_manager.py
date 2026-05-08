from typing import Dict, List, Set, Tuple
from fastapi import WebSocket
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # active_connections: { workspace_id: { agent_id: [WebSocket, ...] } }
        self.active_connections: Dict[str, Dict[str, List[WebSocket]]] = {}

    async def connect(self, websocket: WebSocket, workspace_id: str, agent_id: str):
        await websocket.accept()
        
        if workspace_id not in self.active_connections:
            self.active_connections[workspace_id] = {}
        
        if agent_id not in self.active_connections[workspace_id]:
            self.active_connections[workspace_id][agent_id] = []
            
        self.active_connections[workspace_id][agent_id].append(websocket)
        logger.info(f"Agent {agent_id} connected from workspace {workspace_id}")

    def disconnect(self, websocket: WebSocket, workspace_id: str, agent_id: str):
        if workspace_id in self.active_connections:
            if agent_id in self.active_connections[workspace_id]:
                if websocket in self.active_connections[workspace_id][agent_id]:
                    self.active_connections[workspace_id][agent_id].remove(websocket)
                
                if not self.active_connections[workspace_id][agent_id]:
                    del self.active_connections[workspace_id][agent_id]
            
            if not self.active_connections[workspace_id]:
                del self.active_connections[workspace_id]

    async def broadcast(self, message: dict):
        """
        Broadcasts a message to all agents in a specific workspace.
        Expects 'workspace_id' in the message dict.
        """
        workspace_id = message.get("workspace_id")
        if not workspace_id:
            logger.warning("Broadcast called without workspace_id")
            return

        # We can remove workspace_id from the payload sent to the client to save bandwidth
        # but for now we'll keep it for debugging.
        
        if workspace_id in self.active_connections:
            for agent_id, connections in self.active_connections[workspace_id].items():
                for connection in connections:
                    try:
                        await connection.send_text(json.dumps(message))
                    except Exception:
                        pass

    async def send_personal_message(self, message: dict, workspace_id: str, agent_id: str):
        if workspace_id in self.active_connections:
            if agent_id in self.active_connections[workspace_id]:
                for connection in self.active_connections[workspace_id][agent_id]:
                    try:
                        await connection.send_text(json.dumps(message))
                    except Exception:
                        pass

socket_manager = ConnectionManager()
