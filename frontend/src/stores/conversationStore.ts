import { create } from 'zustand';
import { fetchConversations, fetchMessages } from '../api/client';
import type { Conversation, Message } from '../api/client';

interface ConversationState {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  isLoadingConversations: boolean;
  isLoadingMessages: Record<string, boolean>;
  hasMoreMessages: Record<string, boolean>;
  lastFetchedAt: Record<string, number>; // key: status filter (e.g., 'pending', 'all', etc.), value: timestamp

  // Actions
  setConversations: (conversations: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  loadConversations: (statusFilter: string | undefined, activeTab: string, force?: boolean) => Promise<void>;
  loadMessages: (conversationId: string, force?: boolean) => Promise<void>;
  loadMoreMessages: (conversationId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateConversation: (conversation: Partial<Conversation> & { id: string }) => void;
  markConversationAsReadLocal: (conversationId: string) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: string) => void;
  clearCache: () => void;
}

const STALE_TIME = 30000; // 30 seconds stale time

function mergeConversations(existing: Conversation[], incoming: Conversation[]): Conversation[] {
  const map = new Map<string, Conversation>();
  existing.forEach(c => map.set(c.id, c));
  incoming.forEach(c => {
    const prev = map.get(c.id);
    map.set(c.id, prev ? { ...prev, ...c } : c);
  });
  return Array.from(map.values());
}

function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return timeB - timeA;
  });
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  messages: {},
  isLoadingConversations: false,
  isLoadingMessages: {},
  hasMoreMessages: {},
  lastFetchedAt: {},

  setConversations: (conversations) => {
    set((state) => {
      const nextConversations = typeof conversations === 'function'
        ? conversations(state.conversations)
        : conversations;
      return { conversations: sortConversations(nextConversations) };
    });
  },

  loadConversations: async (statusFilter, activeTab, force = false) => {
    const now = Date.now();
    const lastFetch = get().lastFetchedAt[activeTab] || 0;
    
    // If not forced and data is fresh, skip fetching to preserve UI state instantly
    if (!force && get().conversations.length > 0 && now - lastFetch < STALE_TIME) {
      return;
    }

    set({ isLoadingConversations: true });
    try {
      const data = await fetchConversations(statusFilter);
      set((state) => {
        // Merge conversations to preserve in-memory detail states (like contact details)
        const updatedConvs = sortConversations(mergeConversations(state.conversations, data));
        
        // Filter out conversations that don't match the active status tab anymore (unless it's 'all')
        let filtered = updatedConvs;
        if (activeTab !== 'all') {
          const statusMap: Record<string, string> = {
            pending: 'pending',
            mine: 'open',
            resolved: 'resolved',
          };
          const targetStatus = statusMap[activeTab];
          if (targetStatus) {
            filtered = updatedConvs.filter(c => c.status === targetStatus);
          }
        }

        return {
          conversations: filtered,
          lastFetchedAt: {
            ...state.lastFetchedAt,
            [activeTab]: now,
          },
        };
      });
    } catch (err) {
      console.error('[Zustand] Failed to fetch conversations:', err);
      throw err;
    } finally {
      set({ isLoadingConversations: false });
    }
  },

  loadMessages: async (conversationId, force = false) => {
    // If we already have messages and not forcing, skip fetching
    if (!force && get().messages[conversationId]?.length > 0) {
      return;
    }

    set((state) => ({
      isLoadingMessages: { ...state.isLoadingMessages, [conversationId]: true }
    }));

    try {
      const data = await fetchMessages(conversationId);
      set((state) => ({
        messages: { ...state.messages, [conversationId]: data },
        hasMoreMessages: { ...state.hasMoreMessages, [conversationId]: data.length === 50 }
      }));
    } catch (err) {
      console.error(`[Zustand] Failed to fetch messages for ${conversationId}:`, err);
    } finally {
      set((state) => ({
        isLoadingMessages: { ...state.isLoadingMessages, [conversationId]: false }
      }));
    }
  },

  loadMoreMessages: async (conversationId) => {
    const currentMessages = get().messages[conversationId] || [];
    if (currentMessages.length === 0 || !get().hasMoreMessages[conversationId]) return;

    const oldestMessage = currentMessages[0];
    try {
      const data = await fetchMessages(conversationId, oldestMessage.created_at);
      if (data.length > 0) {
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: [...data, ...(state.messages[conversationId] || [])]
          },
          hasMoreMessages: {
            ...state.hasMoreMessages,
            [conversationId]: data.length === 50
          }
        }));
      } else {
        set((state) => ({
          hasMoreMessages: {
            ...state.hasMoreMessages,
            [conversationId]: false
          }
        }));
      }
    } catch (err) {
      console.error('[Zustand] Failed to load more messages:', err);
    }
  },

  addMessage: (message) => {
    const { conversation_id } = message;
    
    set((state) => {
      // 1. Add message to the messages list
      const prevMsgs = state.messages[conversation_id] || [];
      // Avoid duplicate messages in list
      const exists = prevMsgs.some(m => m.id === message.id);
      const newMsgs = exists ? prevMsgs : [...prevMsgs, message];

      // 2. Find and update the conversation in list, float it to top
      let found = false;
      const updatedConvs = state.conversations.map((c) => {
        if (c.id === conversation_id) {
          found = true;
          return {
            ...c,
            last_message_preview: message.message_type === 'text' ? message.content : 'Anexo',
            last_message_at: message.created_at,
            unread_count: message.direction === 'inbound' ? c.unread_count + 1 : c.unread_count,
          };
        }
        return c;
      });

      // If the conversation is not yet in our active list, it will be added on next sync/event
      return {
        messages: {
          ...state.messages,
          [conversation_id]: newMsgs
        },
        conversations: sortConversations(updatedConvs)
      };
    });
  },

  updateConversation: (convUpdate) => {
    set((state) => {
      let exists = false;
      let updatedConvs = state.conversations.map((c) => {
        if (c.id === convUpdate.id) {
          exists = true;
          return { ...c, ...convUpdate } as Conversation;
        }
        return c;
      });

      if (!exists && convUpdate.status) {
        // If it does not exist but has full info, prepend it
        updatedConvs = [convUpdate as Conversation, ...updatedConvs];
      }

      return {
        conversations: sortConversations(updatedConvs)
      };
    });
  },

  markConversationAsReadLocal: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) => 
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      )
    }));
  },

  updateMessageStatus: (conversationId, messageId, status) => {
    set((state) => {
      const prevMsgs = state.messages[conversationId] || [];
      const updatedMsgs = prevMsgs.map((m) => 
        m.id === messageId ? { ...m, status } : m
      );
      return {
        messages: {
          ...state.messages,
          [conversationId]: updatedMsgs
        }
      };
    });
  },

  clearCache: () => {
    set({
      conversations: [],
      messages: {},
      isLoadingConversations: false,
      isLoadingMessages: {},
      hasMoreMessages: {},
      lastFetchedAt: {}
    });
  }
}));
