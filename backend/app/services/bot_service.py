import logging
from sqlalchemy.orm import Session
from app.models.conversation import Conversation
from app.models.inbox import Inbox
from app.models.queue import Queue
from app.services.evolution_service import EvolutionService

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
