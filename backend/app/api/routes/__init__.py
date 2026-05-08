from app.api.routes.health import router as health_router
from app.api.routes.conversations import router as conversations_router
from app.api.routes.messages import router as messages_router
from app.api.routes.webhooks import router as webhooks_router
from app.api.routes.connections import router as connections_router
from app.api.routes.agents import router as agents_router
from app.api.routes.auth import router as auth_router

__all__ = [
    "health_router",
    "conversations_router",
    "messages_router",
    "webhooks_router",
    "connections_router",
    "agents_router",
    "auth_router",
]
