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
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs pt-safe">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Zone 1: Brand title & Mode badge */}
          <div className="flex items-center gap-2 min-w-0">
            <span
              onClick={() => onSelectTab('inquiries')}
              className="text-base font-bold tracking-tight text-slate-900 cursor-pointer select-none truncate active:opacity-75 transition-opacity"
            >
              Travel Dispatcher
            </span>
            {configStatus && (
              <span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate border border-slate-200/60">
                {configStatus.hasResendApiKey ? '● Live' : '○ Preview'}
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
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onOpenSettings}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 rounded-xl transition-all cursor-pointer"
              title="Resend Email Settings & Database Sync"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            {user && (
              <button
                onClick={() => logout()}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:scale-95 rounded-xl transition-all cursor-pointer"
                title={`Logout (${user.email})`}
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Ergonomic 5-Tab Bottom Bar (Thumb Zone) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/90 shadow-lg pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="grid grid-cols-5 items-center h-14 px-1">
          {/* 1. Inquiries */}
          <button
            onClick={() => onSelectTab('inquiries')}
            className={`flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-all active:scale-90 cursor-pointer ${
              activeTab === 'inquiries' ? 'text-slate-900 font-semibold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <FileText className={`w-5 h-5 ${activeTab === 'inquiries' ? 'stroke-[2.2]' : 'stroke-[1.75]'}`} />
            <span className="text-[10px] tracking-tight mt-0.5">Inquiries</span>
          </button>

          {/* 2. New Inquiry (Prominent Action) */}
          <button
            onClick={() => onSelectTab('new')}
            className={`flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-all active:scale-90 cursor-pointer ${
              activeTab === 'new' ? 'text-slate-950 font-bold' : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              activeTab === 'new' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
            }`}>
              <PlusCircle className="w-5 h-5" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 font-medium">New</span>
          </button>

          {/* 3. Ledger */}
          <button
            onClick={() => onSelectTab('ledger')}
            className={`flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-all active:scale-90 cursor-pointer ${
              activeTab === 'ledger' ? 'text-slate-900 font-semibold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <BookOpen className={`w-5 h-5 ${activeTab === 'ledger' ? 'stroke-[2.2]' : 'stroke-[1.75]'}`} />
            <span className="text-[10px] tracking-tight mt-0.5">Ledger</span>
          </button>

          {/* 4. Agents */}
          <button
            onClick={() => onSelectTab('agents')}
            className={`flex flex-col items-center justify-center h-full min-h-[48px] py-1 transition-all active:scale-90 cursor-pointer ${
              activeTab === 'agents' ? 'text-slate-900 font-semibold' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Users className={`w-5 h-5 ${activeTab === 'agents' ? 'stroke-[2.2]' : 'stroke-[1.75]'}`} />
            <span className="text-[10px] tracking-tight mt-0.5">Agents</span>
          </button>

          {/* 5. Settings */}
          <button
            onClick={onOpenSettings}
            className="flex flex-col items-center justify-center h-full min-h-[48px] py-1 text-slate-400 hover:text-slate-600 transition-all active:scale-90 cursor-pointer"
          >
            <Settings className="w-5 h-5 stroke-[1.75]" />
            <span className="text-[10px] tracking-tight mt-0.5">Settings</span>
          </button>
        </div>
      </nav>
    </>
  );
};
