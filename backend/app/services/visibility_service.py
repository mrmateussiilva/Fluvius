from sqlalchemy.orm import Session
from app.models.agent import Agent
from app.models.conversation import Conversation
from app.core.socket_manager import socket_manager
from typing import List

class ConversationVisibilityService:
    @staticmethod
    def resolve_agents(db: Session, conversation: Conversation) -> List[Agent]:
        # Regra: Admins do workspace sempre podem ver todas as conversas
        admins = db.query(Agent).filter(
            Agent.workspace_id == conversation.workspace_id,
            Agent.role == "admin"
        ).all()

        if not conversation.assignee_id:
            # Sem responsável -> apenas admins
            return admins

        assignee = db.query(Agent).filter(
            Agent.id == conversation.assignee_id
        ).first()

        if not assignee:
            # Responsável não encontrado ou inválido -> apenas admins
            return admins

        if assignee.role == "admin":
            # Se for admin, já está incluído na lista de admins
            return admins

        # Se for operador normal -> admins + operador responsável
        agent_map = {agent.id: agent for agent in admins}
        agent_map[assignee.id] = assignee
        return list(agent_map.values())

    @staticmethod
    async def broadcast_to_allowed_agents(db: Session, conversation: Conversation, message: dict):
        allowed_agents = ConversationVisibilityService.resolve_agents(db, conversation)
        for agent in allowed_agents:
            await socket_manager.send_personal_message(
                message,
                conversation.workspace_id,
                agent.id
            )
