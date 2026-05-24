import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Search, MessageSquare, Settings, Shield, LogOut, 
  ChevronRight, Command, Zap, User, Clock, Filter,
  Maximize2, Minimize2, PanelLeft, PanelRight, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CommandAction {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string[];
  action: () => void;
  category: 'NAVIGATION' | 'ACTIONS' | 'SYSTEM';
}

export const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const togglePalette = useCallback(() => {
    setIsOpen(prev => !prev);
    setSearch('');
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        togglePalette();
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, togglePalette]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const actions: CommandAction[] = [
    {
      id: 'go-inbox',
      title: 'GO TO INBOX',
      subtitle: 'Main operational center',
      icon: <MessageSquare size={16} />,
      shortcut: ['G', 'I'],
      category: 'NAVIGATION',
      action: () => { navigate('/'); setIsOpen(false); }
    },
    {
      id: 'go-settings',
      title: 'SYSTEM CONFIG',
      subtitle: 'Preferences & Connections',
      icon: <Settings size={16} />,
      shortcut: ['G', 'S'],
      category: 'NAVIGATION',
      action: () => { navigate('/settings'); setIsOpen(false); }
    },
    {
      id: 'go-admin',
      title: 'ADMIN PANEL',
      subtitle: 'Management & Analytics',
      icon: <Shield size={16} />,
      shortcut: ['G', 'A'],
      category: 'NAVIGATION',
      action: () => { navigate('/admin'); setIsOpen(false); }
    },
    {
      id: 'toggle-left',
      title: 'TOGGLE LEFT SIDEBAR',
      subtitle: 'Show/hide conversation list',
      icon: <PanelLeft size={16} />,
      shortcut: ['['],
      category: 'ACTIONS',
      action: () => { 
        window.dispatchEvent(new CustomEvent('fluvius:toggle-left-sidebar'));
        setIsOpen(false);
      }
    },
    {
      id: 'toggle-right',
      title: 'TOGGLE RIGHT CONTEXT',
      subtitle: 'Show/hide AI & Details',
      icon: <PanelRight size={16} />,
      shortcut: [']'],
      category: 'ACTIONS',
      action: () => { 
        window.dispatchEvent(new CustomEvent('fluvius:toggle-right-sidebar'));
        setIsOpen(false);
      }
    },
    {
      id: 'ai-summarize',
      title: 'AI SUMMARIZE',
      subtitle: 'Generate conversation recap',
      icon: <Sparkles size={16} />,
      shortcut: ['S', 'M'],
      category: 'ACTIONS',
      action: () => { 
        const btn = document.querySelector('[title*="IA Resumo"]') as HTMLButtonElement;
        btn?.click();
        setIsOpen(false);
      }
    },
    {
      id: 'logout',
      title: 'TERMINATE SESSION',
      subtitle: 'Securely logout',
      icon: <LogOut size={16} />,
      category: 'SYSTEM',
      action: () => { 
        // Trigger logout
        const btn = document.querySelector('button[onClick*="logout"]') as HTMLButtonElement;
        if (btn) btn.click();
        else navigate('/login');
        setIsOpen(false);
      }
    }
  ];

  const filteredActions = actions.filter(a => 
    a.title.toLowerCase().includes(search.toLowerCase()) || 
    a.subtitle?.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredActions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        filteredActions[selectedIndex].action();
      }
    }
  };

  const categories = Array.from(new Set(filteredActions.map(a => a.category)));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="cmd-palette-overlay" onClick={() => setIsOpen(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            className="cmd-palette-content"
            onClick={e => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="flex items-center px-4 py-4 border-b border-border-subtle bg-surface-2">
              <Command size={20} className="text-accent-neon mr-3 opacity-80" />
              <input
                ref={inputRef}
                type="text"
                placeholder="TYPE A COMMAND OR SEARCH..."
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedIndex(0); }}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-none outline-none text-[14px] font-mono font-bold text-text-primary placeholder:text-text-muted/30 uppercase tracking-widest"
              />
              <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-3 rounded border border-border-subtle">
                <span className="text-[10px] font-mono font-bold text-text-muted">ESC</span>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto fluvius-scroll pb-2">
              {filteredActions.length === 0 ? (
                <div className="py-12 text-center text-text-muted flex flex-col items-center gap-2">
                  <Search size={24} className="opacity-20 mb-2" />
                  <p className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] opacity-40">No commands found</p>
                </div>
              ) : (
                categories.map(category => (
                  <div key={category} className="mt-2">
                    <div className="px-4 py-2 text-[9px] font-mono font-bold text-text-muted/50 uppercase tracking-[0.3em]">
                      {category}
                    </div>
                    {filteredActions
                      .filter(a => a.category === category)
                      .map((action) => {
                        const globalIndex = filteredActions.indexOf(action);
                        const isSelected = globalIndex === selectedIndex;
                        return (
                          <button
                            key={action.id}
                            onClick={action.action}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={cn(
                              "w-full flex items-center justify-between px-4 py-3 transition-all text-left group",
                              isSelected ? "bg-accent-neon/10 border-l-2 border-accent-neon" : "bg-transparent border-l-2 border-transparent"
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-8 h-8 rounded-md flex items-center justify-center transition-colors border",
                                isSelected ? "bg-accent-neon text-app-bg border-accent-neon" : "bg-surface-3 text-text-muted border-border-subtle"
                              )}>
                                {action.icon}
                              </div>
                              <div className="flex flex-col">
                                <span className={cn(
                                  "text-[12px] font-mono font-bold tracking-wider transition-colors",
                                  isSelected ? "text-accent-neon" : "text-text-primary"
                                )}>
                                  {action.title}
                                </span>
                                {action.subtitle && (
                                  <span className="text-[10px] font-mono text-text-muted opacity-60 tracking-tight">{action.subtitle}</span>
                                )}
                              </div>
                            </div>
                            
                            {action.shortcut && (
                              <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                {action.shortcut.map(key => (
                                  <kbd key={key} className="px-1.5 py-0.5 bg-surface-3 border border-border-subtle rounded text-[9px] font-mono font-bold text-text-muted group-hover:text-accent-neon group-hover:border-accent-neon/30 transition-all">
                                    {key}
                                  </kbd>
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border-subtle bg-surface-2 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="flex items-center gap-1.5">
                   <kbd className="px-1 py-0.5 bg-surface-3 border border-border-subtle rounded text-[8px] font-mono font-bold text-text-muted">↑↓</kbd>
                   <span className="text-[8px] font-mono font-bold text-text-muted uppercase tracking-widest">Navigate</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                   <kbd className="px-1 py-0.5 bg-surface-3 border border-border-subtle rounded text-[8px] font-mono font-bold text-text-muted">↵</kbd>
                   <span className="text-[8px] font-mono font-bold text-text-muted uppercase tracking-widest">Execute</span>
                 </div>
              </div>
              <div className="flex items-center gap-2">
                 <Zap size={10} className="text-accent-neon opacity-40" />
                 <span className="text-[8px] font-mono font-bold text-text-muted/40 uppercase tracking-[0.2em]">Fluvius Power-User Mode</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
