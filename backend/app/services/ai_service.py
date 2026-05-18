import logging
import time
from typing import List, Optional
from google import genai
from google.genai import errors
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.contact import Contact

logger = logging.getLogger(__name__)

class GeminiProvider:
    """
    Provedor especializado em Google Gemini API (SDK Nova).
    Implementa fallbacks, tratamento de erros e desacoplamento.
    """
    
    # Ordem de preferência de modelos (do mais moderno para o mais estável)
    PREFERRED_MODELS = [
        "gemini-3.1-flash-lite",
        "gemini-2.0-flash",
        "gemini-flash-latest",
        "gemini-pro-latest"
    ]

    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("API Key do Gemini não fornecida.")
        self.client = genai.Client(api_key=api_key)

    def list_available_models(self) -> List[str]:
        """Lista modelos disponíveis para a chave atual."""
        try:
            models = self.client.models.list()
            return [m.name for m in models]
        except Exception as e:
            logger.error(f"Erro ao listar modelos Gemini: {e}")
            return []

    def generate_suggestion(self, prompt: str) -> str:
        """
        Gera uma sugestão de texto com sistema de fallback automático.
        """
        last_error = None
        
        for model_id in self.PREFERRED_MODELS:
            try:
                logger.info(f"Tentando gerar sugestão com modelo: {model_id}")
                response = self.client.models.generate_content(
                    model=model_id,
                    contents=prompt
                )
                
                if response and response.text:
                    return response.text.strip()
                
            except errors.ClientError as e:
                # Erro 404: Modelo não encontrado ou obsoleto
                if "404" in str(e) or "not found" in str(e).lower():
                    logger.warning(f"Modelo {model_id} não encontrado. Tentando próximo...")
                    last_error = e
                    continue
                
                # Erro 429: Limite de cota (Rate Limit)
                if "429" in str(e) or "quota" in str(e).lower():
                    logger.error(f"Limite de cota atingido para Gemini ({model_id}).")
                    raise ValueError("Limite de uso da IA atingido. Tente novamente em alguns minutos.")
                
                # Erro 401/403: Chave inválida
                if "401" in str(e) or "403" in str(e) or "invalid api key" in str(e).lower():
                    logger.error("Chave de API do Gemini inválida ou sem permissão.")
                    raise ValueError("Configuração da IA inválida. Verifique sua GEMINI_API_KEY.")
                
                last_error = e
                logger.error(f"Erro de cliente no Gemini ({model_id}): {e}")
                
            except Exception as e:
                logger.error(f"Erro inesperado ao chamar Gemini ({model_id}): {e}")
                last_error = e
                continue

        # Se chegou aqui, todos os modelos falharam
        raise ValueError(f"Não foi possível gerar sugestão. Erro final: {str(last_error)}")

class AIService:
    @staticmethod
    def suggest_reply(db: Session, conversation_id: str) -> str:
        try:
            api_key = settings.GEMINI_API_KEY
            provider = GeminiProvider(api_key)
            
            # Carregar contexto
            conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
            if not conversation:
                raise ValueError("Conversa não encontrada.")
                
            contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
            contact_name = contact.name if contact and contact.name else "Cliente"
            
            messages = db.query(Message).filter(
                Message.conversation_id == conversation_id
            ).order_by(Message.created_at.desc()).limit(20).all()
            messages.reverse()
            
            if not messages:
                return "Olá! Como posso ajudar você hoje?"
                
            # Construção do Prompt
            prompt = (
                "Você é um assistente de atendimento sênior. "
                "Gere uma resposta curta, profissional e amigável em Português do Brasil. "
                "Não use placeholders. Responda apenas com o texto sugerido.\n\n"
                "HISTÓRICO:\n"
            )
            
            for msg in messages:
                sender = "Agente" if msg.direction == "outbound" else contact_name
                content = msg.content if msg.message_type == "text" else f"[{msg.message_type}]"
                prompt += f"{sender}: {content}\n"
                
            prompt += "\nSugestão: "
            
            return provider.generate_suggestion(prompt)
            
        except ValueError as ve:
            # Erros de negócio ou configuração tratada
            raise ve
        except Exception as e:
            logger.exception("Erro crítico no AIService")
            raise ValueError("Ocorreu um erro interno ao processar a sugestão de IA.")

    @staticmethod
    def summarize_conversation(db: Session, conversation_id: str) -> str:
        try:
            api_key = settings.GEMINI_API_KEY
            provider = GeminiProvider(api_key)
            
            # Carregar contexto
            conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
            if not conversation:
                raise ValueError("Conversa não encontrada.")
                
            contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
            contact_name = contact.name if contact and contact.name else "Cliente"
            
            messages = db.query(Message).filter(
                Message.conversation_id == conversation_id
            ).order_by(Message.created_at.desc()).limit(30).all()
            messages.reverse()
            
            if not messages:
                return "Sem histórico de mensagens nesta conversa para gerar um resumo."
                
            # Construção do Prompt
            prompt = (
                "Você é um assistente de inteligência artificial de atendimento especializado em resumir conversas de suporte.\n"
                f"Abaixo está o histórico de mensagens recentes com o cliente {contact_name}.\n"
                "Gere um resumo executivo extremamente conciso e profissional em Português do Brasil contendo:\n"
                "- Um parágrafo de resumo geral (qual é a dor, dúvida ou solicitação do cliente).\n"
                "- Uma lista curta em tópicos (bullet points) com os pontos importantes resolvidos ou pendentes.\n\n"
                "Não use placeholders ou referências ao formato do prompt. Seja direto, focado no cliente e objetivo.\n\n"
                "HISTÓRICO DA CONVERSA:\n"
            )
            
            for msg in messages:
                sender = "Agente" if msg.direction == "outbound" else contact_name
                content = msg.content if msg.message_type == "text" else f"[{msg.message_type}]"
                prompt += f"{sender}: {content}\n"
                
            prompt += "\nRESUMO DA CONVERSA:"
            
            return provider.generate_suggestion(prompt)
            
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.exception("Erro crítico no AIService de resumo")
            raise ValueError("Ocorreu um erro interno ao processar o resumo da conversa com IA.")

    @staticmethod
    def analyze_sentiment(db: Session, conversation_id: str) -> str:
        """
        Dynamically analyzes the sentiment of the last 15 messages in the selected conversation
        from the customer using Google Gemini, returning POSITIVE, NEUTRAL, NEGATIVE, or URGENT.
        """
        from app.models.conversation import Conversation
        from app.models.contact import Contact
        from app.models.message import Message

        # Fetch conversation, contact, and last 15 inbound messages
        conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conversation:
            raise ValueError("Conversa não encontrada")

        contact = db.query(Contact).filter(Contact.id == conversation.contact_id).first()
        contact_name = contact.name if contact and contact.name else (contact.phone if contact else "Cliente")

        # Fetch last 15 messages in this conversation (ordered by created_at)
        messages = (
            db.query(Message)
            .filter(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(15)
            .all()
        )
        # Reverse to get chronological order
        messages.reverse()

        if not messages:
            return "NEUTRAL"

        try:
            # Initialize Gemini provider
            provider = GeminiProvider()
            
            prompt = (
                "Você é um analista de suporte sênior especialista em análise de sentimentos e comportamento do consumidor.\n"
                "Analise o histórico recente de conversação abaixo entre a equipe de suporte e o cliente.\n"
                "Sua tarefa é identificar e classificar o SENTIMENTO e URGÊNCIA predominantes nas falas do CLIENTE.\n\n"
                "Você deve classificar em exatamente um dos seguintes status:\n"
                "- POSITIVE (Se o cliente estiver amigável, satisfeito, elogiando ou muito bem humorado)\n"
                "- NEUTRAL (Se o cliente estiver calmo, objetivo, apenas respondendo perguntas normais sem demonstrar estresse ou alegria excessiva)\n"
                "- NEGATIVE (Se o cliente estiver impaciente, irritado, decepcionado ou reclamando de demora/qualidade)\n"
                "- URGENT (Se o cliente estiver diante de um problema crítico, alegando emergência, cobrando rapidez extrema com termos de urgência ou em situação de impedimento de trabalho)\n\n"
                "CRÍTICO: Responda APENAS E EXCLUSIVAMENTE com uma das 4 palavras chaves acima em letras maiúsculas: POSITIVE, NEUTRAL, NEGATIVE ou URGENT.\n"
                "Qualquer outra palavra, pontuação ou comentário na resposta é estritamente proibido.\n\n"
                "HISTÓRICO DA CONVERSA:\n"
            )
            
            for msg in messages:
                sender = "Agente" if msg.direction == "outbound" else contact_name
                content = msg.content if msg.message_type == "text" else f"[{msg.message_type}]"
                prompt += f"{sender}: {content}\n"
                
            prompt += "\nSENTIMENTO DO CLIENTE:"
            
            response_text = provider.generate_suggestion(prompt)
            if not response_text:
                return "NEUTRAL"
                
            # Clean and sanitize the response
            sentiment = response_text.strip().upper()
            
            # Map or default to NEUTRAL if Gemini returned garbage
            if sentiment in ["POSITIVE", "NEUTRAL", "NEGATIVE", "URGENT"]:
                return sentiment
            
            # Fallback patterns in case it returned some text containing the word
            if "POSITIVE" in sentiment:
                return "POSITIVE"
            if "NEGATIVE" in sentiment:
                return "NEGATIVE"
            if "URGENT" in sentiment:
                return "URGENT"
            if "NEUTRAL" in sentiment:
                return "NEUTRAL"
                
            return "NEUTRAL"
            
        except Exception as e:
            logger.exception("Erro crítico no AIService de sentimento")
            return "NEUTRAL"


