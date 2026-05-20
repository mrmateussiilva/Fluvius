import pytest
from unittest.mock import AsyncMock, MagicMock
from app.core.socket_manager import socket_manager

@pytest.mark.asyncio
async def test_socket_manager_connect_and_disconnect():
    websocket = MagicMock()
    websocket.accept = AsyncMock()
    
    workspace_id = "ws1"
    agent_id = "agent1"
    
    await socket_manager.connect(websocket, workspace_id, agent_id)
    websocket.accept.assert_called_once()
    assert workspace_id in socket_manager.active_connections
    assert agent_id in socket_manager.active_connections[workspace_id]
    
    socket_manager.disconnect(websocket, workspace_id, agent_id)
    assert agent_id not in socket_manager.active_connections.get(workspace_id, {})

@pytest.mark.asyncio
async def test_socket_manager_broadcast():
    websocket1 = MagicMock()
    websocket1.send_json = AsyncMock()
    websocket2 = MagicMock()
    websocket2.send_json = AsyncMock()
    
    workspace_id = "ws1"
    
    # Adiciona na "mão" para simular
    socket_manager.active_connections[workspace_id] = {
        "agent1": [websocket1],
        "agent2": [websocket2]
    }
    
    message = {"type": "TEST", "workspace_id": workspace_id, "data": {}}
    await socket_manager.broadcast(message)
    
    import json
    expected = json.dumps(message)
    websocket1.send_text.assert_called_once_with(expected)
    websocket2.send_text.assert_called_once_with(expected)
    
    # Clean up
    socket_manager.active_connections.clear()
