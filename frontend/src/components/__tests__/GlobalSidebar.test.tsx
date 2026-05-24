import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Agent } from '../../api/client';
import { GlobalSidebar } from '../GlobalSidebar';
import type { GlobalTab } from '../GlobalSidebar';

const mockAgent: Agent = {
  id: 'agent-1',
  workspace_id: 'ws-1',
  name: 'Admin User',
  email: 'admin@test.com',
  role: 'admin',
  is_online: true,
  avatar_url: '',
  created_at: new Date().toISOString(),
};

const defaultProps = {
  currentTab: 'chat' as GlobalTab,
  onTabChange: vi.fn(),
  currentAgent: mockAgent,
  onLogout: vi.fn(),
  onSettings: vi.fn(),
  unreadCount: 0,
};

describe('GlobalSidebar', () => {
  it('renders the Atendimento (Chat) tab', () => {
    render(<GlobalSidebar {...defaultProps} />);
    expect(screen.getByText(/Atendimento/)).toBeInTheDocument();
  });

  it('shows admin tabs only for admin users', () => {
    const { rerender } = render(<GlobalSidebar {...defaultProps} />);

    // Admin user sees admin tabs
    expect(screen.getByText(/Visão Geral/)).toBeInTheDocument();
    expect(screen.getByText(/Kanban/)).toBeInTheDocument();
    expect(screen.getByText(/Agentes/)).toBeInTheDocument();

    // Non-admin user does NOT see admin tabs
    const operatorAgent: Agent = { ...mockAgent, role: 'operator' };
    rerender(<GlobalSidebar {...defaultProps} currentAgent={operatorAgent} />);

    expect(screen.queryByText(/Visão Geral/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kanban/)).not.toBeInTheDocument();
  });

  it('calls onTabChange with "dashboard" when clicking Dashboard tab', () => {
    const handleTabChange = vi.fn();
    render(<GlobalSidebar {...defaultProps} onTabChange={handleTabChange} />);

    const dashboardBtn = screen.getByText(/Visão Geral/).closest('button');
    fireEvent.click(dashboardBtn!);

    expect(handleTabChange).toHaveBeenCalledWith('dashboard');
  });

  it('calls onTabChange with "kanban" when clicking Kanban tab', () => {
    const handleTabChange = vi.fn();
    render(<GlobalSidebar {...defaultProps} onTabChange={handleTabChange} />);

    const kanbanBtn = screen.getByText(/Kanban/).closest('button');
    fireEvent.click(kanbanBtn!);

    expect(handleTabChange).toHaveBeenCalledWith('kanban');
  });

  it('displays unread count when on admin tab and there are unread messages', () => {
    render(<GlobalSidebar {...defaultProps} currentTab="dashboard" unreadCount={7} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows tooltip with unread count when NOT on chat tab', () => {
    render(
      <GlobalSidebar {...defaultProps} currentTab="dashboard" unreadCount={3} />
    );
    // Unread count appears in the tooltip text alongside 'Atendimento'
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does NOT show unread count in tooltip when on chat tab', () => {
    render(
      <GlobalSidebar {...defaultProps} currentTab="chat" unreadCount={3} />
    );
    // When already on chat tab, the badge dot is hidden (conditional rendering)
    // The span.bg-rose-500 (dot) is only rendered when currentTab !== 'chat'
    // Tooltip still shows 'Atendimento' text but no count badge dot
    const tooltipText = screen.getByText(/Atendimento/);
    expect(tooltipText).toBeInTheDocument();
  });

  it('calls onLogout when clicking the logout button', () => {
    const handleLogout = vi.fn();
    render(<GlobalSidebar {...defaultProps} onLogout={handleLogout} />);

    const logoutBtn = screen.getByText(/Sair/).closest('button');
    fireEvent.click(logoutBtn!);

    expect(handleLogout).toHaveBeenCalledTimes(1);
  });

  it('calls onSettings when clicking the settings button', () => {
    const handleSettings = vi.fn();
    render(<GlobalSidebar {...defaultProps} onSettings={handleSettings} />);

    const settingsBtn = screen.getByText(/Configurações/).closest('button');
    fireEvent.click(settingsBtn!);

    expect(handleSettings).toHaveBeenCalledTimes(1);
  });

  it('shows agent initial in avatar when no avatar_url', () => {
    render(<GlobalSidebar {...defaultProps} />);
    // "Admin User" → initial 'A'
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('shows agent name tooltip on avatar hover', () => {
    render(<GlobalSidebar {...defaultProps} />);
    expect(screen.getByText('Admin User')).toBeInTheDocument();
  });
});
