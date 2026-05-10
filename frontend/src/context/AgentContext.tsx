import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchAgents } from '../api/client';
import type { Agent } from '../api/client';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'fluvius_current_agent_id';

interface AgentContextType {
  currentAgent: Agent | null;
  agents: Agent[];
  setCurrentAgent: (agent: Agent) => void;
  reloadAgents: () => Promise<void>;
  isAdmin: boolean;
  isLoading: boolean;
}

const AgentContext = createContext<AgentContextType>({
  currentAgent: null,
  agents: [],
  setCurrentAgent: () => {},
  reloadAgents: async () => {},
  isAdmin: false,
  isLoading: true,
});

export const useAgent = () => useContext(AgentContext);

export const AgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentAgent, setCurrentAgentState] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const reloadAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchAgents();
      setAgents(data);

      // If we have a logged-in user, use it as current agent unless another one was manually selected
      const savedId = localStorage.getItem(STORAGE_KEY);
      const saved = data.find(a => a.id === (savedId || user?.id)) || data[0] || null;
      setCurrentAgentState(saved);
    } catch (err) {
      console.error('Failed to load agents', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      reloadAgents();
    }
  }, [reloadAgents, user]);

  const setCurrentAgent = (agent: Agent) => {
    setCurrentAgentState(agent);
    localStorage.setItem(STORAGE_KEY, agent.id);
  };

  const isAdmin = currentAgent?.role === 'admin';

  return (
    <AgentContext.Provider value={{ currentAgent, agents, setCurrentAgent, reloadAgents, isAdmin, isLoading }}>
      {children}
    </AgentContext.Provider>
  );
};
