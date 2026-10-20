import React, { useState } from 'react';
import { Modal } from '../components/Modal.tsx';
import { ConfigStatus } from '../types/index.ts';
import { ApiClient } from '../api/client.ts';
import { LocalDatabase } from '../lib/localDb.ts';
import {
  Key,
  Mail,
  CheckCircle2,
  AlertCircle,
  Database,
  Download,
  Upload,
  RefreshCw,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ConfigStatus | null;
  onConfigUpdated: (config: ConfigStatus) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfigUpdated,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [fromEmail, setFromEmail] = useState(config?.resendFromEmail || 'onboarding@resend.dev');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Stats from local database
  const localData = LocalDatabase.getAllData();
  const inquiryCount = localData.inquiries?.length || 0;
  const agentCount = localData.agents?.length || 0;
  const ledgerCount = localData.ledger?.length || 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload: { resendApiKey?: string; resendFromEmail?: string } = {
        resendFromEmail: fromEmail,
      };
      if (apiKey.trim()) {
        payload.resendApiKey = apiKey.trim();
      }
      const updated = await ApiClient.updateConfig(payload);
      onConfigUpdated(updated);
      setMessage({ type: 'success', text: 'Email configuration saved successfully.' });
      setApiKey('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update configuration.' });
    } finally {
      setSaving(false);
    }
  };

  const handleForceSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      await ApiClient.syncAllLocalDataToServer();
      setMessage({ type: 'success', text: 'Local database synced to cloud server successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Cloud sync failed.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleExportBackup = () => {
    const data = LocalDatabase.getAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `travel_dispatcher_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ type: 'success', text: 'Database backup downloaded successfully.' });
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const raw = evt.target?.result as string;
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.inquiries || parsed.agents || parsed.ledger)) {
          LocalDatabase.restoreData(parsed);
          await ApiClient.syncAllLocalDataToServer();
          setMessage({ type: 'success', text: 'Backup restored and synced successfully! Reloading view...' });
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          setMessage({ type: 'error', text: 'Invalid backup file structure.' });
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: 'Failed to read JSON backup file.' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings & Database Storage">
      <div className="space-y-5">
        {/* Persistent Storage Status */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-slate-900">Local Database Storage</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
              Persistent Active
            </span>
          </div>

          <div className="text-[11px] text-slate-500">
            Stored locally in browser: <strong>{inquiryCount}</strong> inquiries · <strong>{agentCount}</strong> agents · <strong>{ledgerCount}</strong> ledger records.
            Data is preserved automatically across page refreshes.
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleForceSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Cloud'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportBackup}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Backup</span>
            </button>

            <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Restore</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Resend Email Configuration */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {config?.hasResendApiKey ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span className="text-xs font-semibold text-slate-900">
              {config?.hasResendApiKey ? 'Live Resend Dispatch Active' : 'Test Preview Mode (No API Key)'}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            {config?.hasResendApiKey
              ? 'Inquiries are emailed individually to each selected agent via the Resend API.'
              : 'Add your Resend API Key to enable live email delivery to partner agents.'}
          </p>
        </div>

        {message && (
          <div
            className={`p-3 text-xs rounded-lg border ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Resend API Key
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Key className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config?.hasResendApiKey ? '•••••••••••••••••••••••• (configured)' : 're_xxxxxxxxxxxxx'}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Stored securely on the backend server only. Never exposed to browser.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sender Address (From Email)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="onboarding@resend.dev"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
