from sqlalchemy.orm import Session
from app.models.agent import Agent
from app.models.conversation import Conversation
from app.core.socket_manager import socket_manager
from typing import List

class ConversationVisibilityService:
    @staticmethod
    def can_access_conversation(db: Session, conversation: Conversation, agent: Agent) -> bool:
        if conversation.workspace_id != agent.workspace_id:
            return False

        if agent.role == "admin":
            return True

        if conversation.assignee_id == agent.id:
            return True

        if conversation.status == "pending":
            if not conversation.queue_id:
                return True

            from app.models.queue import Queue
            queue = db.query(Queue).filter(Queue.id == conversation.queue_id).first()
            if queue:
                return any(queue_agent.id == agent.id for queue_agent in queue.agents)

        return False

    @staticmethod
    def can_act_on_conversation(db: Session, conversation: Conversation, agent: Agent) -> bool:
        if conversation.workspace_id != agent.workspace_id:
            return False

        if agent.role == "admin":
            return True

        return conversation.assignee_id == agent.id

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

        if conversation.status == "pending" and not conversation.queue_id:
            operators = db.query(Agent).filter(
                Agent.workspace_id == conversation.workspace_id,
                Agent.role != "admin"
            ).all()
            for agent in operators:
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
