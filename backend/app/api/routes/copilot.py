"""
Copilot API — Análise sob demanda

O agente solicita análise do copilot para uma conversa específica.
O copilot NÃO roda automaticamente — só quando chamado por esta rota.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import get_current_agent
from app.models.agent import Agent
from app.models.conversation import Conversation
from app.models.message import Message
from app.services.copilot_service import CopilotService

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["copilot"])


class CopilotAnalyzeRequest(BaseModel):
    conversation_id: str


class CopilotAnalyzeResponse(BaseModel):
    status: str
    message: str


@router.post("/analyze", response_model=CopilotAnalyzeResponse)
async def analyze_conversation(
    request: CopilotAnalyzeRequest,
    db: Session = Depends(get_db),
    current_agent: Agent = Depends(get_current_agent),
):
    """
    Solicita que o Copilot analise uma conversa específica.
    Só roda quando o agente pede explicitamente.
    """
    conversation = db.query(Conversation).filter(
        Conversation.id == request.conversation_id,
        Conversation.workspace_id == current_agent.workspace_id,
    ).first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")

    # Busca a última mensagem inbound como trigger
    last_inbound = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation.id,
            Message.direction == "inbound",
            Message.is_internal == False,
        )
        .order_by(Message.created_at.desc())
        .first()
    )

    trigger_message = last_inbound.content if last_inbound and last_inbound.content else ""

    logger.info(
        f"[Copilot] Análise solicitada por agente {current_agent.name} "
        f"para conversa {conversation.id}"
    )

    await CopilotService.analyze_conversation(
        db=db,
        conversation_id=conversation.id,
        trigger_message=trigger_message,
        trigger="agent_request",
    )

    return CopilotAnalyzeResponse(
        status="ok",
        message="Análise do copilot concluída. Verifique o painel de alertas.",
    )
