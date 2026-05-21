import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ConversationList } from '../components/ConversationList';
import { MessagePanel } from '../components/MessagePanel';
import { TransferModal } from '../components/TransferModal';
import {
  fetchConversations, fetchMessages, sendMessage, sendMediaMessage, sendInternalNote,
  assignConversation, resolveConversation, pendingConversation, markAsRead
} from '../api/client';
import type { Conversation, Message } from '../api/client';
import type { Contact } from '../api/client';
import { MessageSquare, Lock } from 'lucide-react';
import { useAgent } from '../context/AgentContext';
import { useAuth } from '../context/AuthContext';
import { useWebSocket, type WSEvent } from '../hooks/useWebSocket';
import { CopilotPanel, type CopilotAlert } from '../components/CopilotPanel';


type TabFilter = 'all' | 'pending' | 'mine' | 'resolved';

function mergeConversations(conversations: Conversation[]): Conversation[] {
  const map = new Map<string, Conversation>();
  conversations.forEach(c => {
    map.set(c.id, c);
  });
  return Array.from(map.values());
}

export const InboxPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(searchParams.get('c'));
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('pending');
  const [connectionStatus, setConnectionStatus] = useState<string>('connecting');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  // Copilot alerts state
  const [copilotAlerts, setCopilotAlerts] = useState<CopilotAlert[]>([]);
  const [typingState, setTypingState] = useState<Record<string, boolean>>({});

  const { currentAgent } = useAgent();
  const { token } = useAuth();
  const navigate = useNavigate();

  const conversationsRef = useRef<Conversation[]>([]);
  const selectedConversationIdRef = useRef<string | null>(selectedConversationId);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  // Request notification permissions on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const statusMap: Record<TabFilter, string | undefined> = {
        all: undefined,
        pending: 'pending',
        mine: 'open',
        resolved: 'resolved',
      };
      const data = await fetchConversations(statusMap[activeTab]);
      // For "mine", filter client-side by assignee
      const filtered = activeTab === 'mine' && currentAgent
        ? data.filter(c => c.assignee_id === currentAgent.id)
        : data;
      setConversations(mergeConversations(filtered));
      if (selectedConversationIdRef.current) {
        const selected = data.find(c => c.id === selectedConversationIdRef.current);
        if (selected) {
          setSelectedConversation(selected);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeTab, currentAgent]);

  const loadMessages = useCallback(async () => {
    if (!selectedConversationId) return;
    try {
      const data = await fetchMessages(selectedConversationId);
      setMessages(data);
      setHasMoreMessages(data.length === 50);
    } catch (err) {
      console.error(err);
    }
  }, [selectedConversationId]);

  const handleLoadMoreMessages = useCallback(async () => {
    if (!selectedConversationId || isLoadingMore || !hasMoreMessages || messages.length === 0) return;
    
    setIsLoadingMore(true);
    try {
      const oldestMessage = messages[0];
      const data = await fetchMessages(selectedConversationId, oldestMessage.created_at);
      if (data.length > 0) {
        setMessages(prev => [...data, ...prev]);
        setHasMoreMessages(data.length === 50);
      } else {
        setHasMoreMessages(false);
      }
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedConversationId, messages, isLoadingMore, hasMoreMessages]);

  // Initial loads
  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { loadMessages(); }, [loadMessages]);

  // WebSocket Event Handler
  const handleWSEvent = useCallback(async (event: WSEvent) => {
    console.log('WS Event Received:', event);

    switch (event.type) {
      case 'NEW_MESSAGE':
        const newMsg = event.data;
        
        // Play notification sound if message is inbound
        if (newMsg.direction === 'inbound') {
          const audio = new Audio('/sounds/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
          
          if (document.hidden) {
            document.title = '(1) Nova Mensagem | Fluvius';
            setTimeout(() => { document.title = 'Fluvius'; }, 5000);
            
            // Push Notification
            if ('Notification' in window && Notification.permission === 'granted') {
               const contactName = conversationsRef.current.find(c => c.id === newMsg.conversation_id)?.contact?.name || 'Cliente';
               new Notification(`Mensagem de ${contactName}`, {
                 body: newMsg.message_type === 'text' ? newMsg.content : 'Enviou um anexo',
                 icon: '/logo.png'
               });
            }
          }
          
          if (newMsg.conversation_id !== selectedConversationId) {
             toast((t) => (
                <div className="flex items-center gap-3">
                   <span className="text-sm font-medium">💬 Nova mensagem recebida!</span>
                   <button 
                     onClick={() => {
                        toast.dismiss(t.id);
                        handleSelectConversation(newMsg.conversation_id);
                     }}
                     className="px-3 py-1.5 bg-fluvius-blue-main hover:bg-fluvius-blue-dark text-white rounded-lg text-xs font-bold transition-colors"
                   >
                     Abrir
                   </button>
                </div>
             ), { duration: 5000, id: `new_msg_${newMsg.id}` });
          }
        }

        // If this message belongs to the open conversation, add it directly.
        // Do NOT call loadMessages() here — it creates a race condition where
        // the fetch can return before the DB transaction commits, wiping the new message.
        if (newMsg.conversation_id === selectedConversationId) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg as Message];
          });
          // Mark as read immediately if it's inbound
          if (newMsg.direction === 'inbound') {
            markAsRead(newMsg.conversation_id).catch(console.error);
          }
        }
        // Always refresh the conversation list to update previews and unread counts
        await loadConversations();
        break;

      case 'NEW_CONVERSATION':
        await loadConversations();
        break;

      case 'CONVERSATION_UPDATED':
        // Someone assigned, resolved or re-queued a conversation
        await loadConversations();
        // If the updated conversation is the one we have open, we might need to refresh it
        if (event.data.id === selectedConversationId) {
          setSelectedConversation(prev => prev ? { ...prev, ...event.data } : prev);
        }
        break;

      case 'MESSAGE_STATUS_UPDATED':
        if (event.data.conversation_id === selectedConversationId) {
          setMessages(prev => prev.map(m =>
            m.id === event.data.id ? { ...m, status: event.data.status } : m
          ));
        }
        break;

      case 'CONNECTION_STATUS_UPDATED':
        setConnectionStatus(event.data.status);
        break;

      case 'COPILOT_ALERT':
        setCopilotAlerts(prev => {
          // Deduplicar por conversation_id — substitui alerta anterior da mesma conversa
          const filtered = prev.filter(a => a.conversation_id !== event.data.conversation_id);
          return [...filtered, { ...event.data, timestamp: Date.now() }];
        });
        break;

      case 'TYPING_STATUS':
        setTypingState(prev => ({
          ...prev,
          [event.data.conversation_id]: event.data.is_typing
        }));
        
        // Auto-clear typing status after 5 seconds
        if (event.data.is_typing) {
           setTimeout(() => {
              setTypingState(current => {
                 if (current[event.data.conversation_id]) {
                    return { ...current, [event.data.conversation_id]: false };
                 }
                 return current;
              });
           }, 5000);
        }
        break;
    }
  }, [selectedConversationId, loadConversations, loadMessages]);

  // Connect WebSocket — captura o estado de reconexão
  const wsStatus = useWebSocket(token, handleWSEvent);


  const handleSendMessage = async (content: string) => {
    if (!selectedConversationId) return;
    try {
      await sendMessage(selectedConversationId, content, replyingTo?.id);
      setReplyingTo(null);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleSendInternalNote = async (content: string) => {
    if (!selectedConversationId) return;
    try {
      await sendInternalNote(selectedConversationId, content);
      setReplyingTo(null);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleSendMedia = async (media: string, mediaType: string, mimetype: string, caption?: string) => {
    if (!selectedConversationId) return;
    try {
      await sendMediaMessage(selectedConversationId, media, mediaType, mimetype, caption, replyingTo?.id);
      setReplyingTo(null);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleAssign = async (conversationId: string) => {
    if (!currentAgent) return;
    try {
      await assignConversation(conversationId, currentAgent.id);
      await loadConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolve = async (conversationId: string) => {
    try {
      await resolveConversation(conversationId);
      handleSelectConversation(null);
      await loadConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePending = async (conversationId: string) => {
    try {
      await pendingConversation(conversationId);
      await loadConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectConversation = async (id: string | null) => {
    if (id) {
      setSearchParams({ c: id });
    } else {
      setSearchParams({});
    }
    setSelectedConversationId(id);
    setReplyingTo(null); // Clear reply state when changing conversation
    
    if (!id) {
      setSelectedConversation(null);
      return;
    }
    
    const conv = conversations.find(c => c.id === id);
    setSelectedConversation(conv || null);
    
    // Do not mark as read if the conversation is assigned to someone else (Spectator Mode)
    const isAssignedToOther = conv?.assignee_id && currentAgent && conv.assignee_id !== currentAgent.id;
    
    if (conv && conv.unread_count > 0 && !isAssignedToOther) {
      try {
        await markAsRead(id);
        // Optimistic update
        setConversations(prev => prev.map(c => c.id === id ? { ...c, unread_count: 0 } : c));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleContactUpdated = (contact: Contact) => {
    setSelectedConversation(prev => (
      prev && prev.contact_id === contact.id ? { ...prev, contact } : prev
    ));
    setConversations(prev => prev.map(conversation => (
      conversation.contact_id === contact.id ? { ...conversation, contact } : conversation
    )));
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-fluvius-bg text-fluvius-text-main">
      {/* Banner: WhatsApp desconectado (via evento CONNECTION_UPDATE) */}
      {connectionStatus === 'disconnected' && (
        <div className="bg-red-500 text-white text-center py-2 text-sm font-medium shrink-0 flex items-center justify-center gap-2">
          <span>⚠️ Atenção: O WhatsApp foi desconectado. Verifique a Evolution API.</span>
        </div>
      )}

      {/* Banner: WebSocket do Fluvius perdeu conexão com o backend */}
      {(wsStatus === 'reconnecting' || wsStatus === 'closed') && connectionStatus !== 'disconnected' && (
        <div className={`text-white text-center py-1.5 text-xs font-medium shrink-0 flex items-center justify-center gap-2 ${
          wsStatus === 'reconnecting' ? 'bg-amber-500' : 'bg-red-600'
        }`}>
          {wsStatus === 'reconnecting' ? (
            <><span className="animate-spin inline-block">↻</span> Reconectando ao servidor...</>
          ) : (
            <>🔴 Sem conexão com o servidor. Recarregue a página.</>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isCollapsed={isLeftSidebarCollapsed}
          onToggleCollapse={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
          copilotAlerts={copilotAlerts}
          onSelectCopilotConversation={handleSelectConversation}
          onDismissCopilotAlert={(conversationId) => {
            setCopilotAlerts(prev => prev.filter(a => a.conversation_id !== conversationId));
          }}
          onClearAllCopilotAlerts={() => setCopilotAlerts([])}
        />
      {selectedConversation ? (
        <MessagePanel
          messages={messages}
          onSendMessage={handleSendMessage}
          onSendInternalNote={handleSendInternalNote}
          onSendMedia={handleSendMedia}
          conversation={selectedConversation}
          onAssign={() => handleAssign(selectedConversation.id)}
          onResolve={() => handleResolve(selectedConversation.id)}
          onPending={() => handlePending(selectedConversation.id)}
          onTransfer={() => setIsTransferModalOpen(true)}
          onContactUpdated={handleContactUpdated}
          replyingTo={replyingTo}
          onSetReplyingTo={setReplyingTo}
          onLoadMore={handleLoadMoreMessages}
          hasMore={hasMoreMessages}
          isLoadingMore={isLoadingMore}
          isTyping={typingState[selectedConversation.id] || false}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-whatsapp-doodle border-l border-slate-200/60 relative overflow-hidden">
          {/* Conteúdo central */}
          <div className="flex flex-col items-center text-center px-8 max-w-sm">
            {/* Ícone animado estilo WA Web */}
            <div className="relative mb-8">
              <div className="w-44 h-44 rounded-full bg-white/60 backdrop-blur-sm flex items-center justify-center shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-white/80">
                <div className="w-24 h-24 rounded-full bg-[#00a884]/10 flex items-center justify-center">
                  <MessageSquare size={48} strokeWidth={1.2} className="text-[#00a884]" />
                </div>
              </div>
              {/* Dot pulsante */}
              <div className="absolute bottom-3 right-3 w-4 h-4 bg-[#00a884] rounded-full border-4 border-white shadow-sm animate-pulse" />
            </div>

            <h2 className="text-[26px] font-light text-[#41525d] mb-3 tracking-tight leading-tight">
              Fluvius Business
            </h2>
            <p className="text-[13.5px] text-[#667781] leading-relaxed">
              Selecione uma conversa na lista ao lado para começar a atender.
            </p>

            {/* Dica de atalho */}
            <div className="mt-8 flex items-center gap-2 px-4 py-2.5 bg-white/60 rounded-xl border border-white/80 shadow-sm backdrop-blur-sm">
              <span className="text-[11px] font-semibold text-[#54656f] uppercase tracking-wider">Dica</span>
              <span className="w-px h-3 bg-slate-300" />
              <span className="text-[12px] text-[#667781]">
                Digite <kbd className="px-1.5 py-0.5 bg-[#efeae2] rounded text-[11px] font-mono font-bold text-[#41525d]">{"/atalho"}</kbd> para respostas rápidas
              </span>
            </div>
          </div>

          {/* Rodapé estilo WA */}
          <div className="absolute bottom-6 flex items-center gap-1.5 text-[12px] text-[#8696a0]">
            <Lock size={12} className="opacity-60" />
            Suas mensagens pessoais são seguras com este sistema
          </div>
        </div>
      )}
      </div>

      {isTransferModalOpen && selectedConversationId && (
        <TransferModal 
          conversationId={selectedConversationId}
          onClose={() => setIsTransferModalOpen(false)}
          onTransferred={() => {
            setIsTransferModalOpen(false);
            setSelectedConversationId(null);
            loadConversations();
          }}
        />
      )}
    </div>
  );
};
