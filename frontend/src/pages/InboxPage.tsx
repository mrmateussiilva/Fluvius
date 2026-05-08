import React, { useEffect, useState, useCallback } from 'react';
import { ConversationList } from '../components/ConversationList';
import { MessagePanel } from '../components/MessagePanel';
import {
  fetchConversations, fetchMessages, sendMessage, sendMediaMessage,
  assignConversation, resolveConversation, pendingConversation, markAsRead
} from '../api/client';
import type { Conversation, Message } from '../api/client';
import { MessageSquare } from 'lucide-react';
import { useAgent } from '../context/AgentContext';
import { useAuth } from '../context/AuthContext';
import { useWebSocket, type WSEvent } from '../hooks/useWebSocket';

type TabFilter = 'all' | 'pending' | 'mine' | 'resolved';

export const InboxPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<TabFilter>('pending');
  const { currentAgent } = useAgent();
  const { token } = useAuth();

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
      setConversations(filtered);
      if (selectedConversationId) {
        const selected = data.find(c => c.id === selectedConversationId);
        if (selected) {
          setSelectedConversation(selected);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeTab, currentAgent, selectedConversationId]);

  const loadMessages = useCallback(async () => {
    if (!selectedConversationId) return;
    try {
      const data = await fetchMessages(selectedConversationId);
      setMessages(data);
    } catch (err) {
      console.error(err);
    }
  }, [selectedConversationId]);

  // Initial loads
  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { loadMessages(); }, [loadMessages]);

  // WebSocket Event Handler
  const handleWSEvent = useCallback((event: WSEvent) => {
    console.log('WS Event Received:', event);

    switch (event.type) {
      case 'NEW_MESSAGE':
        const newMsg = event.data;
        
        // Play notification sound if message is inbound
        if (newMsg.direction === 'inbound') {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
          audio.play().catch(err => console.log('Autoplay blocked or audio error:', err));
          document.title = '(1) Nova Mensagem | Fluvius';
          setTimeout(() => { document.title = 'Fluvius'; }, 5000);
        }

        // 1. If this message is for the currently open chat, add it
        if (newMsg.conversation_id === selectedConversationId) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg as Message];
          });
          loadMessages();
          // Mark as read immediately if it's inbound
          if (newMsg.direction === 'inbound') {
             markAsRead(newMsg.conversation_id).catch(console.error);
          }
        }
        // 2. Trigger a list refresh to update previews
        loadConversations();
        break;

      case 'CONVERSATION_UPDATED':
        // Someone assigned, resolved or re-queued a conversation
        loadConversations();
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
    }
  }, [selectedConversationId, loadConversations, loadMessages]);

  // Connect WebSocket
  useWebSocket(token, handleWSEvent);


  const handleSendMessage = async (content: string) => {
    if (!selectedConversationId) return;
    try {
      await sendMessage(selectedConversationId, content);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMedia = async (media: string, mediaType: string, mimetype: string, caption?: string) => {
    if (!selectedConversationId) return;
    try {
      await sendMediaMessage(selectedConversationId, media, mediaType, mimetype, caption);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssign = async (conversationId: string) => {
    if (!currentAgent) return;
    try {
      await assignConversation(conversationId, currentAgent.id);
      // WS will handle the "CONVERSATION_UPDATED" event
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolve = async (conversationId: string) => {
    try {
      await resolveConversation(conversationId);
      setSelectedConversationId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePending = async (conversationId: string) => {
    try {
      await pendingConversation(conversationId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectConversation = async (id: string) => {
    setSelectedConversationId(id);
    const conv = conversations.find(c => c.id === id);
    setSelectedConversation(conv || null);
    if (conv && conv.unread_count > 0) {
      try {
        await markAsRead(id);
        // Optimistic update
        setConversations(prev => prev.map(c => c.id === id ? { ...c, unread_count: 0 } : c));
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-800">
      <ConversationList
        conversations={conversations}
        selectedId={selectedConversationId}
        onSelect={handleSelectConversation}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      {selectedConversation ? (
        <MessagePanel
          messages={messages}
          onSendMessage={handleSendMessage}
          onSendMedia={handleSendMedia}
          conversation={selectedConversation}
          onAssign={() => handleAssign(selectedConversation.id)}
          onResolve={() => handleResolve(selectedConversation.id)}
          onPending={() => handlePending(selectedConversation.id)}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 border-l border-slate-200">
          <div className="bg-white p-6 rounded-full shadow-sm mb-6">
            <MessageSquare size={48} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-light text-slate-700 mb-2">Fluvius Inbox</h2>
          <p className="text-slate-500 max-w-md text-center">
            Selecione uma conversa para começar a atender.
          </p>
        </div>
      )}
    </div>
  );
};
