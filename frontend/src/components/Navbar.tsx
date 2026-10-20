import React from 'react';
import {
  FileText,
  PlusCircle,
  BookOpen,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { ConfigStatus } from '../types/index.ts';

interface NavbarProps {
  activeTab: 'inquiries' | 'new' | 'ledger' | 'agents';
  onSelectTab: (tab: 'inquiries' | 'new' | 'ledger' | 'agents') => void;
  onOpenSettings: () => void;
  configStatus: ConfigStatus | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenSettings,
  configStatus,
}) => {
  const { user, logout } = useAuth();

  return (
    <>
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Zone 1: Brand title */}
          <div className="flex items-center gap-2">
            <span
              onClick={() => onSelectTab('inquiries')}
              className="text-base font-bold tracking-tight text-slate-900 cursor-pointer select-none truncate"
            >
              Travel Dispatcher
            </span>
            {configStatus && (
              <span className="hidden sm:inline-flex items-center text-[11px] font-medium text-slate-500">
                · {configStatus.mode === 'live' ? 'Resend Live' : 'Test Preview Mode'}
              </span>
            )}
          </div>

          {/* Zone 2: Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              onClick={() => onSelectTab('inquiries')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'inquiries' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              Inquiries
            </button>
            <button
              onClick={() => onSelectTab('new')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'new' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              + New Inquiry
            </button>
            <button
              onClick={() => onSelectTab('ledger')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'ledger' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              Khatabook Ledger
            </button>
            <button
              onClick={() => onSelectTab('agents')}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'agents' ? 'text-slate-900 font-semibold' : ''
              }`}
            >
              Agents
            </button>
          </nav>

          {/* Zone 3: Settings & Logout */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onOpenSettings}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Resend Email Settings"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            {user && (
              <button
                onClick={() => logout()}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title={`Logout (${user.email})`}
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Fixed Bottom Tab Bar (Ergonomic thumb zone) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe">
        <div className="grid grid-cols-4 items-center h-16 px-1">
          <button
            onClick={() => onSelectTab('inquiries')}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer ${
              activeTab === 'inquiries' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight mt-1">Inquiries</span>
          </button>

          <button
            onClick={() => onSelectTab('new')}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer ${
              activeTab === 'new' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <PlusCircle className="w-5 h-5" />
            <span className="text-[11px] font-semibold tracking-tight mt-1">New</span>
          </button>

          <button
            onClick={() => onSelectTab('ledger')}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer ${
              activeTab === 'ledger' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight mt-1">Ledger</span>
          </button>

          <button
            onClick={() => onSelectTab('agents')}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors cursor-pointer ${
              activeTab === 'agents' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight mt-1">Agents</span>
          </button>
        </div>
      </nav>
    </>
  );
};
