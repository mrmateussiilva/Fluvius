import logging
from sqlalchemy.orm import Session
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.inbox import Inbox
from app.models.queue import Queue
from app.services.evolution_service import EvolutionService
from app.services.ai_service import GeminiProvider
from app.core.config import settings

logger = logging.getLogger(__name__)

class BotService:
    @staticmethod
    async def process_bot_message(db: Session, conversation: Conversation, message_content: str, inbox: Inbox, phone: str, connection: dict):
        """
        Process a message when the conversation is in 'bot' status.
        """
        # If no bot is active, just move to pending
        if not inbox.default_bot_active:
            conversation.status = "pending"
            db.commit()
            return

        # NEW: AI Bot Logic
        if inbox.bot_type == "ai":
            await BotService._handle_ai_bot(db, conversation, message_content, inbox, phone, connection)
            return
            
        # Existing Menu Bot Logic
        await BotService._handle_menu_bot(db, conversation, message_content, inbox, phone, connection)

    @staticmethod
    async def _handle_ai_bot(db: Session, conversation: Conversation, message_content: str, inbox: Inbox, phone: str, connection: any):
        # 1. Build prompt with instructions and context
        instructions = inbox.ai_instructions or "Você é um assistente virtual prestativo."
        
        # Detect if user wants a human
        human_keywords = ["atendente", "humano", "pessoa", "falar com alguém", "suporte", "ajuda", "agente"]
        if any(keyword in message_content.lower() for keyword in human_keywords):
            conversation.status = "pending"
            db.commit()
            
            # Access connection as object, not dict
            base_url = connection.base_url
            api_key = connection.api_key
            instance_name = connection.instance_name

            await EvolutionService.send_text_message(
                base_url=base_url,
                api_key=api_key,
                instance_name=instance_name,
                phone=phone,
                text="Entendido! Estou transferindo você para um de nossos atendentes. Aguarde um momento."
            )
            return

        # Fetch last 10 messages for better context
        history = db.query(Message).filter(
            Message.conversation_id == conversation.id
        ).order_by(Message.created_at.desc()).limit(10).all()
        history.reverse()

        # 2. Get Gemini response
        try:
            provider = GeminiProvider(settings.GEMINI_API_KEY)
            
            context_str = ""
            for msg in history:
                role = "Cliente" if msg.direction == "inbound" else "Bot"
                context_str += f"{role}: {msg.content}\n"

            prompt = (
                f"INSTRUÇÕES DO SISTEMA: {instructions}\n\n"
                "CONTEXTO DA CONVERSA:\n"
                f"{context_str}"
                f"Cliente: {message_content}\n\n"
                "REGRAS DE RESPOSTA:\n"
                "- Responda de forma curta, natural e direta em Português do Brasil.\n"
                "- Use o histórico acima para manter a continuidade da conversa.\n"
                "- Não repita saudações se já tiver cumprimentado.\n"
                "- Se o cliente parecer frustrado ou pedir explicitamente por um humano, responda apenas: [TRANSFER_HUMAN]\n"
                "- Se não souber a resposta, peça para aguardar um atendente.\n\n"
                "RESPOSTA DO BOT:"
            )
            
            response_text = provider.generate_suggestion(prompt)
            
            # Handle AI-driven transfer
            if "[TRANSFER_HUMAN]" in response_text:
                conversation.status = "pending"
                db.commit()
                response_text = "Estou te transferindo agora mesmo para um atendente humano que poderá te ajudar melhor."

            # 3. Send response
            await EvolutionService.send_text_message(
                base_url=connection.base_url,
                api_key=connection.api_key,
                instance_name=connection.instance_name,
                phone=phone,
                text=response_text
            )
        except Exception as e:
            logger.error(f"Erro no AI Bot: {e}")
            # Fallback to pending if AI fails
            conversation.status = "pending"
            db.commit()

    @staticmethod
    async def _handle_menu_bot(db: Session, conversation: Conversation, message_content: str, inbox: Inbox, phone: str, connection: dict):
        queues = db.query(Queue).filter(Queue.workspace_id == inbox.workspace_id).all()
        
        # If there are no queues, the bot has nowhere to route to. Just move to pending.
        if not queues:
            conversation.status = "pending"
            db.commit()
            return

        # Simple heuristic: try to find if the user typed a number matching the queue list
        selected_queue = None
        try:
            choice = int(message_content.strip())
            if 1 <= choice <= len(queues):
                selected_queue = queues[choice - 1]
        except ValueError:
            pass
            
        if selected_queue:
            # Route to the selected queue
            conversation.queue_id = selected_queue.id
            conversation.status = "pending"
            db.commit()
            
            # Optionally send a confirmation
            await EvolutionService.send_text_message(
                base_url=connection.base_url,
                api_key=connection.api_key,
                instance_name=connection.instance_name,
                phone=f"{phone}",
                text=f"Entendido! Você será transferido para o setor de *{selected_queue.name}*. Aguarde um momento."
            )
            return
            
        # If not a valid choice (or it's the first message), send the menu
        menu_text = ""
        if inbox.welcome_message:
            menu_text += f"{inbox.welcome_message}\n\n"
        
        menu_text += "Por favor, escolha uma das opções abaixo digitando o número correspondente:\n"
        for idx, queue in enumerate(queues, 1):
            menu_text += f"{idx} - {queue.name}\n"
            
        await EvolutionService.send_text_message(
            base_url=connection.base_url,
            api_key=connection.api_key,
            instance_name=connection.instance_name,
            phone=f"{phone}",
            text=menu_text
        )


