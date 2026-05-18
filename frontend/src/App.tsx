import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { InboxPage } from './pages/InboxPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AgentProvider, useAgent } from './context/AgentContext';
import { AdminPage } from './pages/AdminPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { fetchConnections } from './api/client';
import { useState, useEffect } from 'react';

import { Toaster } from 'react-hot-toast';

import './index.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-fluvius-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-fluvius-blue-main border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const OnboardingRedirect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [hasConnection, setHasConnection] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token || !user) return;
    
    // Only admins go through onboarding
    if (user.role !== 'admin') {
      setHasConnection(true);
      return;
    }

    fetchConnections()
      .then(conns => setHasConnection(conns.length > 0))
      .catch(() => setHasConnection(true)); // Fallback to avoid loop
  }, [token, user]);

  if (hasConnection === null) {
    return (
      <div className="min-h-screen bg-fluvius-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-fluvius-blue-main border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (hasConnection === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentAgent, isLoading } = useAgent();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-fluvius-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-fluvius-blue-main border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentAgent || currentAgent.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  const { token } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/signup" element={token ? <Navigate to="/" replace /> : <SignupPage />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <OnboardingRedirect>
              <AgentProvider>
                <InboxPage />
              </AgentProvider>
            </OnboardingRedirect>
          </ProtectedRoute>
        } />

        <Route path="/onboarding" element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        } />

        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute>
            <AgentProvider>
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            </AgentProvider>
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
};

import { ErrorBoundary } from './components/ErrorBoundary';
import { APP_VERSION } from './version';

function App() {
  useEffect(() => {
    document.title = `Fluvius - v${APP_VERSION}`;
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster 
          position="top-right" 
          toastOptions={{
            duration: 4000,
            style: {
              background: '#ffffff',
              color: '#1e293b',
              border: '1px solid #f1f5f9',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              borderRadius: '16px',
              fontSize: '14px',
              fontWeight: 600,
            },
            success: {
              iconTheme: {
                primary: '#4f46e5',
                secondary: '#ffffff',
              },
            },
          }}
        />
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
