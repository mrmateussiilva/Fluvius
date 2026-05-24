import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GlobalSidebar, GlobalTab } from '../GlobalSidebar';

const mockAgent = {
  id: 'agent-1',
  name: 'Admin User',
  email: 'admin@test.com',
  role: 'admin' as const,
  avatar_url: '',
  status: 'online' as const,
  department_id: null,
  created_at: new Date().toISOString()
};

describe('GlobalSidebar', () => {
  it('renders chat tab by default', () => {
    const handleTabChange = vi.fn();
    render(
      <GlobalSidebar
        currentTab="chat"
        onTabChange={handleTabChange}
        currentAgent={mockAgent}
        onLogout={vi.fn()}
        onSettings={vi.fn()}
        unreadCount={0}
      />
    );

    // Verify Chat is present (Atendimento)
    expect(screen.getByText(/Atendimento/)).toBeInTheDocument();
  });

  it('shows admin tabs only for admin users', () => {
    const handleTabChange = vi.fn();
    
    // Render with admin user
    const { rerender } = render(
      <GlobalSidebar
        currentTab="chat"
        onTabChange={handleTabChange}
        currentAgent={mockAgent}
        onLogout={vi.fn()}
        onSettings={vi.fn()}
      />
    );

    expect(screen.getByText(/Visão Geral/)).toBeInTheDocument();
    expect(screen.getByText(/Kanban/)).toBeInTheDocument();

    // Render with non-admin user
    const userAgent = { ...mockAgent, role: 'user' as const };
    rerender(
      <GlobalSidebar
        currentTab="chat"
        onTabChange={handleTabChange}
        currentAgent={userAgent}
        onLogout={vi.fn()}
        onSettings={vi.fn()}
      />
    );

    expect(screen.queryByText(/Visão Geral/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kanban/)).not.toBeInTheDocument();
  });

  it('calls onTabChange when clicking a tab', () => {
    const handleTabChange = vi.fn();
    render(
      <GlobalSidebar
        currentTab="chat"
        onTabChange={handleTabChange}
        currentAgent={mockAgent}
        onLogout={vi.fn()}
        onSettings={vi.fn()}
      />
    );

    const dashboardBtn = screen.getByText(/Visão Geral/).closest('button');
    fireEvent.click(dashboardBtn!);

    expect(handleTabChange).toHaveBeenCalledWith('dashboard');
  });

  it('displays unread count badge', () => {
    render(
      <GlobalSidebar
        currentTab="dashboard"
        onTabChange={vi.fn()}
        currentAgent={mockAgent}
        onLogout={vi.fn()}
        onSettings={vi.fn()}
        unreadCount={5}
      />
    );

    // Should render the unread count in the tooltip
    expect(screen.getByText(/5/)).toBeInTheDocument();
  });
});
