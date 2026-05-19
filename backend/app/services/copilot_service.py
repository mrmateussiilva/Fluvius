"""
Copilot Service — Bot Observador Semiautomático

Analisa automaticamente TODAS as conversas inbound em tempo real e:
  1. Detecta sentimento e intenção do cliente
  2. Gera sugestão de resposta contextual
  3. Calcula urgência (sentiment + tempo sem resposta)
  4. Emite COPILOT_ALERT via WebSocket para o(s) agente(s) responsável(is)
  5. Salva uma nota interna com a análise (visível só para agentes)

Triggers:
  - Chamado pelo webhook_service após cada mensagem inbound
  - Chamado pelo health_check para SLA breach
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Sentimentos que requerem alerta imediato
ALERT_SENTIMENTS = {"NEGATIVE", "URGENT"}

# Intenções mapeadas por palavras-chave
INTENT_KEYWORDS = {
    "complaint": ["errado", "problema", "defeito", "reclamação", "péssimo", "horrível", "raiva", "indignado", "absurdo", "vergonha"],
    "cancellation": ["cancelar", "cancelamento", "desistir", "quero sair", "encerrar contrato", "não quero mais"],
    "purchase_intent": ["quero comprar", "tenho interesse", "quanto custa", "valor", "preço", "promoção", "desconto"],
    "urgent_support": ["parado", "não funciona", "travado", "urgente", "emergência", "bloqueado", "impedido", "sistema caiu"],
    "escalation_request": ["gerente", "supervisor", "responsável", "falar com alguém", "atendente", "humano"],
}


def _detect_intent(message: str) -> Optional[str]:
    """Detecta a intenção principal da mensagem por palavras-chave."""
    msg_lower = message.lower()
    for intent, keywords in INTENT_KEYWORDS.items():
        if any(kw in msg_lower for kw in keywords):
            return intent
    return None


def _minutes_without_response(last_message_at: Optional[datetime]) -> float:
    """Retorna quantos minutos se passaram desde a última mensagem do cliente."""
    if not last_message_at:
        return 0.0
    now = datetime.now(timezone.utc)
    if last_message_at.tzinfo is None:
        last_message_at = last_message_at.replace(tzinfo=timezone.utc)
    delta = now - last_message_at
    return delta.total_seconds() / 60


class CopilotService:

    @staticmethod
    async def analyze_conversation(
        db: Session,
        conversation_id: str,
        trigger_message: str,
        trigger: str = "inbound_message",  # "inbound_message" | "sla_breach"
    ) -> None:
        """
        Ponto de entrada principal.
        Executa análise, gera alerta WS e salva nota interna.
        """
        from app.core.config import settings
        from app.core.socket_manager import socket_manager
        from app.models.conversation import Conversation
        from app.models.message import Message
        from app.models.contact import Contact
        from app.models.queue import Queue
        from app.services.ai_service import GeminiProvider

        if not settings.GEMINI_API_KEY:
            logger.debug("[Copilot] GEMINI_API_KEY não configurado — pulando análise.")
            return

        try:
            conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
            if not conversation:
                return

            contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
            contact_name = (contact.name if contact and contact.name else contact.phone) if contact else "Cliente"

            # --- 1. Detectar intenção por palavras-chave (rápido, sem IA) ---
            intent = _detect_intent(trigger_message)
            minutes_waiting = _minutes_without_response(conversation.last_message_at)

            # --- 2. Análise de sentimento via IA ---
            sentiment = "NEUTRAL"
            try:
                from app.services.ai_service import AIService
                sentiment = AIService.analyze_sentiment(db, conversation_id)
            except Exception as e:
                logger.warning(f"[Copilot] Falha na análise de sentimento: {e}")

            # --- 3. Decidir se deve gerar alerta ---
            should_alert = (
                sentiment in ALERT_SENTIMENTS
                or intent in ("complaint", "cancellation", "urgent_support", "escalation_request")
                or trigger == "sla_breach"
            )

            if not should_alert:
                logger.debug(f"[Copilot] Conversa {conversation_id}: sem alerta necessário (sentiment={sentiment}, intent={intent})")
                return

            # --- 4. Gerar sugestão de intervenção ---
            suggestion = await CopilotService._generate_intervention_suggestion(
                provider=GeminiProvider(settings.GEMINI_API_KEY),
                conversation=conversation,
                contact_name=contact_name,
                sentiment=sentiment,
                intent=intent,
                trigger=trigger,
                minutes_waiting=minutes_waiting,
                db=db,
            )

            # --- 5. Determinar nível de urgência ---
            urgency = CopilotService._calc_urgency(sentiment, intent, minutes_waiting, trigger)

            # --- 6. Emitir COPILOT_ALERT via WebSocket ---
            alert_payload = {
                "type": "COPILOT_ALERT",
                "workspace_id": conversation.workspace_id,
                "data": {
                    "conversation_id": conversation_id,
                    "contact_name": contact_name,
                    "sentiment": sentiment,
                    "intent": intent,
                    "urgency": urgency,             # "low" | "medium" | "high" | "critical"
                    "trigger": trigger,
                    "minutes_waiting": round(minutes_waiting, 1),
                    "suggestion": suggestion,
                    "assignee_id": conversation.assignee_id,
                },
            }
            await socket_manager.broadcast(alert_payload)
            logger.info(
                f"[Copilot] Alerta emitido para conversa {conversation_id} "
                f"(sentiment={sentiment}, intent={intent}, urgency={urgency})"
            )

            # --- 7. Salvar nota interna com a análise ---
            await CopilotService._save_internal_note(
                db=db,
                conversation=conversation,
                sentiment=sentiment,
                intent=intent,
                urgency=urgency,
                trigger=trigger,
                minutes_waiting=minutes_waiting,
                suggestion=suggestion,
            )

        except Exception as e:
            logger.error(f"[Copilot] Erro na análise da conversa {conversation_id}: {e}")

    @staticmethod
    async def _generate_intervention_suggestion(
        provider,
        conversation,
        contact_name: str,
        sentiment: str,
        intent: Optional[str],
        trigger: str,
        minutes_waiting: float,
        db: Session,
    ) -> str:
        """Gera uma sugestão curta para o agente sobre como intervir."""
        from app.models.message import Message

        # Busca as últimas 5 mensagens para contexto
        recent = (
            db.query(Message)
            .filter(Message.conversation_id == conversation.id, Message.is_internal == False)
            .order_by(Message.created_at.desc())
            .limit(5)
            .all()
        )
        recent.reverse()

        history = "\n".join(
            f"{'Cliente' if m.direction == 'inbound' else 'Agente'}: {m.content or '[mídia]'}"
            for m in recent
        )

        sla_note = f" O cliente está aguardando há {minutes_waiting:.0f} minutos sem resposta." if minutes_waiting > 5 else ""

        prompt = (
            f"Você é um coordenador de atendimento monitorando conversas em tempo real.\n"
            f"Cliente: {contact_name} | Sentimento detectado: {sentiment} | Intenção: {intent or 'Não detectada'}\n"
            f"{sla_note}\n\n"
            f"ÚLTIMAS MENSAGENS:\n{history}\n\n"
            f"Em 1-2 frases curtas, oriente o agente humano sobre como deve agir AGORA nessa conversa. "
            f"Seja direto e objetivo. Responda em Português do Brasil."
        )

        try:
            return provider.generate_suggestion(prompt)
        except Exception as e:
            logger.warning(f"[Copilot] Falha ao gerar sugestão: {e}")
            # Fallback sem IA
            if trigger == "sla_breach":
                return f"⏱️ Atenção: {contact_name} está aguardando há {minutes_waiting:.0f} min. Responda agora para evitar abandono."
            if sentiment == "URGENT":
                return f"🚨 Cliente em situação urgente. Assuma a conversa e ofereça solução imediata."
            if sentiment == "NEGATIVE":
                return f"⚠️ Cliente insatisfeito detectado. Intervenha com empatia e ofereça resolução rápida."
            return f"💡 Cliente precisa de atenção. Considere intervir agora."

    @staticmethod
    def _calc_urgency(
        sentiment: str,
        intent: Optional[str],
        minutes_waiting: float,
        trigger: str,
    ) -> str:
        if trigger == "sla_breach" and minutes_waiting > 60:
            return "critical"
        if sentiment == "URGENT" or intent == "urgent_support":
            return "critical"
        if sentiment == "NEGATIVE" or intent in ("complaint", "cancellation", "escalation_request"):
            return "high"
        if trigger == "sla_breach":
            return "medium"
        return "low"

    @staticmethod
    async def _save_internal_note(
        db: Session,
        conversation,
        sentiment: str,
        intent: Optional[str],
        urgency: str,
        trigger: str,
        minutes_waiting: float,
        suggestion: str,
    ) -> None:
        """Salva a análise do copiloto como nota interna na conversa."""
        from app.models.message import Message
        from app.models.workspace import generate_uuid, utcnow

        icons = {"critical": "🚨", "high": "⚠️", "medium": "💡", "low": "ℹ️"}
        icon = icons.get(urgency, "💡")

        lines = [
            f"{icon} **Análise do Copiloto** ({trigger.replace('_', ' ').title()})",
            f"• Sentimento: **{sentiment}**",
        ]
        if intent:
            lines.append(f"• Intenção: **{intent.replace('_', ' ').title()}**")
        if minutes_waiting > 1:
            lines.append(f"• Aguardando: **{minutes_waiting:.0f} min**")
        lines.append(f"\n💬 {suggestion}")

        note_content = "\n".join(lines)

        note = Message(
            id=generate_uuid(),
            workspace_id=conversation.workspace_id,
            conversation_id=conversation.id,
            contact_id=conversation.contact_id,
            direction="outbound",
            message_type="text",
            content=note_content,
            is_internal=True,
            status="sent",
            created_at=utcnow(),
        )
        db.add(note)
        db.commit()
        logger.debug(f"[Copilot] Nota interna salva na conversa {conversation.id}")

    @staticmethod
    async def check_sla_breaches(db: Session) -> None:
        """
        Verifica conversas pendentes sem resposta além do SLA configurado.
        Chamado pelo health-check periódico.
        """
        from app.models.conversation import Conversation
        from app.models.queue import Queue
        from datetime import datetime, timezone, timedelta

        # Busca conversas pendentes (não resolvidas, não em bot)
        pending_conversations = (
            db.query(Conversation)
            .filter(Conversation.status.in_(["pending", "open"]))
            .filter(Conversation.last_message_at.isnot(None))
            .all()
        )

        for conv in pending_conversations:
            # Determina SLA: usa o da fila se houver, senão 30 minutos padrão
            sla_minutes = 30
            if conv.queue_id:
                queue = db.query(Queue).filter(Queue.id == conv.queue_id).first()
                if queue and queue.sla_minutes:
                    sla_minutes = queue.sla_minutes

            minutes_elapsed = _minutes_without_response(conv.last_message_at)

            if minutes_elapsed >= sla_minutes:
                logger.info(
                    f"[Copilot] SLA breach: conversa {conv.id} — "
                    f"{minutes_elapsed:.0f}min >= {sla_minutes}min"
                )
                # Roda análise em background sem bloquear o health-check
                asyncio.create_task(
                    CopilotService.analyze_conversation(
                        db=db,
                        conversation_id=conv.id,
                        trigger_message="",
                        trigger="sla_breach",
                    )
                )
