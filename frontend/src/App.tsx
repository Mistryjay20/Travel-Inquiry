import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { Navbar } from './components/Navbar.tsx';
import { InquiryFormPage } from './pages/InquiryFormPage.tsx';
import { InquiryListPage } from './pages/InquiryListPage.tsx';
import { AgentsPage } from './pages/AgentsPage.tsx';
import { LedgerPage } from './pages/LedgerPage.tsx';
import { SendStatusModal } from './pages/SendStatusModal.tsx';
import { SettingsModal } from './pages/SettingsModal.tsx';
import { ConfigStatus, Inquiry } from './types/index.ts';
import { ApiClient } from './api/client.ts';
import { WifiOff } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'inquiries' | 'new' | 'ledger' | 'agents'>('inquiries');
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Status modal state after dispatching or inspecting
  const [activeDispatchInquiry, setActiveDispatchInquiry] = useState<Inquiry | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      ApiClient.syncAllLocalDataToServer().catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (user) {
      ApiClient.getConfig()
        .then((cfg) => setConfigStatus(cfg))
        .catch((err) => console.error('Could not load email configuration:', err));
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-xs font-mono">
        Loading Travel Dispatcher...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleInquirySaved = (inquiry: Inquiry) => {
    setActiveDispatchInquiry(inquiry);
    setActiveTab('inquiries');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col overscroll-none">
      {/* Offline Banner for Mobile Reliability */}
      {!isOnline && (
        <div className="bg-amber-600 text-white text-xs px-4 py-1.5 flex items-center justify-center gap-2 shadow-xs shrink-0 pt-safe">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Working Offline · Changes saved to local storage</span>
        </div>
      )}

      {/* Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        configStatus={configStatus}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-nav smooth-scroll">
        {activeTab === 'inquiries' && (
          <InquiryListPage
            onNewInquiry={() => setActiveTab('new')}
            onOpenDispatchStatus={(inquiry) => setActiveDispatchInquiry(inquiry)}
          />
        )}

        {activeTab === 'new' && (
          <InquiryFormPage
            onSuccess={handleInquirySaved}
            onNavigateToAgents={() => setActiveTab('agents')}
          />
        )}

        {activeTab === 'ledger' && <LedgerPage />}

        {activeTab === 'agents' && <AgentsPage />}
      </main>

      {/* Global Modals */}
      <SendStatusModal
        isOpen={Boolean(activeDispatchInquiry)}
        onClose={() => setActiveDispatchInquiry(null)}
        inquiry={activeDispatchInquiry}
        onDispatchUpdated={(updated) => setActiveDispatchInquiry(updated)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={configStatus}
        onConfigUpdated={(newCfg) => setConfigStatus(newCfg)}
      />
    </div>
  );
}
