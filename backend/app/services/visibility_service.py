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

        agent_map = {agent.id: agent for agent in admins}

        if conversation.assignee_id:
            assignee = db.query(Agent).filter(
                Agent.id == conversation.assignee_id
            ).first()
            if assignee:
                agent_map[assignee.id] = assignee

        if conversation.queue_id:
            from app.models.queue import Queue
            queue = db.query(Queue).filter(Queue.id == conversation.queue_id).first()
            if queue:
                for agent in queue.agents:
                    agent_map[agent.id] = agent

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
