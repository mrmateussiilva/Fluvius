from app.api.routes.health import router as health_router
from app.api.routes.conversations import router as conversations_router
from app.api.routes.messages import router as messages_router
from app.api.routes.webhooks import router as webhooks_router
from app.api.routes.connections import router as connections_router
from app.api.routes.agents import router as agents_router
from app.api.routes.contacts import router as contacts_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.auth import router as auth_router
from app.api.routes.queues import router as queues_router
from app.api.routes.quick_replies import router as quick_replies_router
from app.api.routes.copilot import router as copilot_router
from app.api.routes.media import router as media_router

__all__ = [
    "health_router",
    "conversations_router",
    "messages_router",
    "webhooks_router",
    "connections_router",
    "agents_router",
    "contacts_router",
    "dashboard_router",
    "auth_router",
    "queues_router",
    "quick_replies_router",
    "copilot_router",
    "media_router",
]
