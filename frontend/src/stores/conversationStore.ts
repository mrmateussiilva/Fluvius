import { create } from 'zustand';
import { fetchConversations, fetchMessages } from '../api/client';
import type { Conversation, ConversationPage, Message } from '../api/client';

interface ConversationState {
  currentAgentId: string | null;
  conversations: Conversation[];
  conversationsByTab: Record<string, Conversation[]>;
  messages: Record<string, Message[]>;
  isLoadingConversations: boolean;
  isLoadingMessages: Record<string, boolean>;
  hasMoreMessages: Record<string, boolean>;
  lastFetchedAt: Record<string, number>; // key: status filter (e.g., 'pending', 'all', etc.), value: timestamp
  lastFetchedIso: Record<string, string>;
  conversationNextOffset: Record<string, number | null>;
  conversationNextCursor: Record<string, string | null>;
  hasMoreConversations: Record<string, boolean>;

  // Actions
  setCurrentAgentId: (agentId: string | null) => void;
  setConversations: (conversations: Conversation[] | ((prev: Conversation[]) => Conversation[]), activeTab?: string) => void;
  loadConversations: (statusFilter: string | undefined, activeTab: string, force?: boolean) => Promise<void>;
  loadMoreConversations: (statusFilter: string | undefined, activeTab: string) => Promise<void>;
  loadMessages: (conversationId: string, force?: boolean) => Promise<void>;
  loadMoreMessages: (conversationId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateConversation: (conversation: Partial<Conversation> & { id: string }) => void;
  markConversationAsReadLocal: (conversationId: string) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: string) => void;
  clearCache: () => void;
}

const STALE_TIME = 30000; // 30 seconds stale time
const CONVERSATION_PAGE_SIZE = 50;

function isConversationPage(data: Conversation[] | ConversationPage): data is ConversationPage {
  return !Array.isArray(data) && Array.isArray(data.items);
}

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

function tabMatchesConversation(tab: string, conversation: Partial<Conversation>, currentAgentId?: string | null): boolean {
  if (tab === 'all') return true;
  if (tab === 'pending') return conversation.status === 'pending';
  if (tab === 'resolved') return conversation.status === 'resolved';
  if (tab === 'mine') return conversation.status === 'open' && Boolean(currentAgentId) && conversation.assignee_id === currentAgentId;
  return true;
}

function mergeConversationIntoTabs(
  conversationsByTab: Record<string, Conversation[]>,
  conversation: Partial<Conversation> & { id: string },
  currentAgentId?: string | null
): Record<string, Conversation[]> {
  const next: Record<string, Conversation[]> = {};
  const tabs = new Set([...Object.keys(conversationsByTab), 'all', 'pending', 'mine', 'resolved']);

  tabs.forEach((tab) => {
    const existing = conversationsByTab[tab] || [];
    const current = existing.find(c => c.id === conversation.id);
    const merged = current ? { ...current, ...conversation } as Conversation : conversation as Conversation;
    const shouldInclude = current
      ? tabMatchesConversation(tab, merged, currentAgentId)
      : Boolean(conversation.status && tabMatchesConversation(tab, conversation, currentAgentId));
    const withoutCurrent = existing.filter(c => c.id !== conversation.id);
    next[tab] = shouldInclude ? sortConversations([merged, ...withoutCurrent]) : withoutCurrent;
  });

  return next;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  currentAgentId: null,
  conversations: [],
  conversationsByTab: {},
  messages: {},
  isLoadingConversations: false,
  isLoadingMessages: {},
  hasMoreMessages: {},
  lastFetchedAt: {},
  lastFetchedIso: {},
  conversationNextOffset: {},
  conversationNextCursor: {},
  hasMoreConversations: {},

  setCurrentAgentId: (agentId) => set({ currentAgentId: agentId }),

  setConversations: (conversations, activeTab) => {
    set((state) => {
      const previousConversations = activeTab
        ? state.conversationsByTab[activeTab] ?? state.conversations
        : state.conversations;
      const nextConversations = typeof conversations === 'function'
        ? conversations(previousConversations)
        : conversations;
      const sorted = sortConversations(nextConversations);
      return {
        conversations: sorted,
        conversationsByTab: activeTab
          ? { ...state.conversationsByTab, [activeTab]: sorted }
          : state.conversationsByTab,
      };
    });
  },

  loadConversations: async (statusFilter, activeTab, force = false) => {
    const now = Date.now();
    const lastFetch = get().lastFetchedAt[activeTab] || 0;
    
    // If not forced and data is fresh, skip fetching to preserve UI state instantly
    const cachedConversations = get().conversationsByTab[activeTab] || [];
    if (!force && cachedConversations.length > 0 && now - lastFetch < STALE_TIME) {
      set({ conversations: cachedConversations });
      return;
    }

    set({ isLoadingConversations: true });
    try {
      const previousFetchIso = get().lastFetchedIso[activeTab];
      const shouldFetchIncremental = !force && cachedConversations.length > 0 && Boolean(previousFetchIso);
      const data = await fetchConversations(statusFilter, {
        limit: CONVERSATION_PAGE_SIZE,
        offset: 0,
        updatedAfter: shouldFetchIncremental ? previousFetchIso : undefined,
      });
      const incoming = isConversationPage(data) ? data.items : data;
      set((state) => {
        // Merge conversations to preserve in-memory detail states (like contact details)
        const previousTabConversations = force || !shouldFetchIncremental ? [] : state.conversationsByTab[activeTab] || [];
        const filtered = sortConversations(
          mergeConversations(previousTabConversations, incoming)
            .filter(c => tabMatchesConversation(activeTab, c, state.currentAgentId))
        );

        return {
          conversations: filtered,
          conversationsByTab: {
            ...state.conversationsByTab,
            [activeTab]: filtered,
          },
          lastFetchedAt: {
            ...state.lastFetchedAt,
            [activeTab]: now,
          },
          lastFetchedIso: {
            ...state.lastFetchedIso,
            [activeTab]: new Date(now).toISOString(),
          },
          conversationNextOffset: {
            ...state.conversationNextOffset,
            [activeTab]: shouldFetchIncremental
              ? state.conversationNextOffset[activeTab] ?? null
              : isConversationPage(data) ? data.next_offset : null,
          },
          conversationNextCursor: {
            ...state.conversationNextCursor,
            [activeTab]: shouldFetchIncremental
              ? state.conversationNextCursor[activeTab] ?? null
              : isConversationPage(data) ? data.next_cursor : null,
          },
          hasMoreConversations: {
            ...state.hasMoreConversations,
            [activeTab]: shouldFetchIncremental
              ? state.hasMoreConversations[activeTab] ?? false
              : isConversationPage(data) ? data.has_more : false,
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

  loadMoreConversations: async (statusFilter, activeTab) => {
    const nextCursor = get().conversationNextCursor[activeTab];
    const nextOffset = get().conversationNextOffset[activeTab];
    if (!nextCursor && (nextOffset === null || nextOffset === undefined)) return;
    if (!get().hasMoreConversations[activeTab] || get().isLoadingConversations) return;

    set({ isLoadingConversations: true });
    try {
      const data = await fetchConversations(statusFilter, {
        limit: CONVERSATION_PAGE_SIZE,
        cursor: nextCursor,
        offset: nextCursor ? undefined : nextOffset ?? undefined,
      });
      const incoming = isConversationPage(data) ? data.items : data;
      set((state) => {
        const merged = sortConversations(
          mergeConversations(state.conversationsByTab[activeTab] || [], incoming)
            .filter(c => tabMatchesConversation(activeTab, c, state.currentAgentId))
        );
        return {
          conversations: merged,
          conversationsByTab: {
            ...state.conversationsByTab,
            [activeTab]: merged,
          },
          conversationNextOffset: {
            ...state.conversationNextOffset,
            [activeTab]: isConversationPage(data) ? data.next_offset : null,
          },
          conversationNextCursor: {
            ...state.conversationNextCursor,
            [activeTab]: isConversationPage(data) ? data.next_cursor : null,
          },
          hasMoreConversations: {
            ...state.hasMoreConversations,
            [activeTab]: isConversationPage(data) ? data.has_more : false,
          },
        };
      });
    } catch (err) {
      console.error('[Zustand] Failed to fetch more conversations:', err);
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
      const updatedConvs = state.conversations.map((c) => {
        if (c.id === conversation_id) {
          return {
            ...c,
            last_message_preview: message.message_type === 'text' ? message.content : 'Anexo',
            last_message_at: message.created_at,
            unread_count: message.direction === 'inbound' ? c.unread_count + 1 : c.unread_count,
          };
        }
        return c;
      });
      const updatedCurrent = sortConversations(updatedConvs);
      const updatedTabs = Object.fromEntries(
        Object.entries(state.conversationsByTab).map(([tab, list]) => [
          tab,
          sortConversations(list.map((c) => (
            c.id === conversation_id
              ? {
                  ...c,
                  last_message_preview: message.message_type === 'text' ? message.content : 'Anexo',
                  last_message_at: message.created_at,
                  unread_count: message.direction === 'inbound' ? c.unread_count + 1 : c.unread_count,
                }
              : c
          ))),
        ])
      );

      // If the conversation is not yet in our active list, it will be added on next sync/event
      return {
        messages: {
          ...state.messages,
          [conversation_id]: newMsgs
        },
        conversations: updatedCurrent,
        conversationsByTab: updatedTabs
      };
    });
  },

  updateConversation: (convUpdate) => {
    set((state) => {
      let updatedConvs = state.conversations.map((c) => {
        if (c.id === convUpdate.id) {
          return { ...c, ...convUpdate } as Conversation;
        }
        return c;
      });

      const existsInCurrent = state.conversations.some(c => c.id === convUpdate.id);
      if (!existsInCurrent && convUpdate.status) {
        // If it does not exist but has full info, prepend it
        updatedConvs = [convUpdate as Conversation, ...updatedConvs];
      }
      updatedConvs = updatedConvs.filter(c => !convUpdate.status || tabMatchesConversation('all', c));

      return {
        conversations: sortConversations(updatedConvs),
        conversationsByTab: mergeConversationIntoTabs(state.conversationsByTab, convUpdate, state.currentAgentId),
      };
    });
  },

  markConversationAsReadLocal: (conversationId) => {
    set((state) => ({
      conversations: state.conversations.map((c) => 
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      ),
      conversationsByTab: Object.fromEntries(
        Object.entries(state.conversationsByTab).map(([tab, list]) => [
          tab,
          list.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c),
        ])
      ),
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
      currentAgentId: null,
      conversationsByTab: {},
      messages: {},
      isLoadingConversations: false,
      isLoadingMessages: {},
      hasMoreMessages: {},
      lastFetchedAt: {},
      lastFetchedIso: {},
      conversationNextOffset: {},
      conversationNextCursor: {},
      hasMoreConversations: {}
    });
  }
}));
