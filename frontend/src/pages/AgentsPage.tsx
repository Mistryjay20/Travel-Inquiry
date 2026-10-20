import React, { useState, useEffect } from 'react';
import { Agent } from '../types/index.ts';
import { ApiClient } from '../api/client.ts';
import { Modal } from '../components/Modal.tsx';
import {
  UserPlus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Search,
} from 'lucide-react';

import { LocalDatabase } from '../lib/localDb.ts';

export const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>(() => LocalDatabase.getAgents());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete modal state
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      const res = await ApiClient.getAgents();
      setAgents(res.agents);
    } catch (err: any) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const openAddModal = () => {
    setEditingAgent(null);
    setName('');
    setPhone('');
    setEmail('');
    setActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (agent: Agent) => {
    setEditingAgent(agent);
    setName(agent.name);
    setPhone(agent.phone);
    setEmail(agent.email);
    setActive(agent.active);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Front validations
    if (!name.trim()) {
      setFormError('Agent name is required.');
      return;
    }
    if (!phone.trim() || phone.trim().length < 7) {
      setFormError('Valid phone number (at least 7 digits) is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('Valid email address is required.');
      return;
    }

    setSaving(true);
    try {
      if (editingAgent) {
        const res = await ApiClient.updateAgent(editingAgent.id, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          active,
        });
        setAgents((prev) =>
          prev.map((a) => (a.id === editingAgent.id ? res.agent : a))
        );
      } else {
        const res = await ApiClient.createAgent({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          active,
        });
        setAgents((prev) => [...prev, res.agent]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Error saving agent.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (agent: Agent) => {
    try {
      const res = await ApiClient.updateAgent(agent.id, { active: !agent.active });
      setAgents((prev) => prev.map((a) => (a.id === agent.id ? res.agent : a)));
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const confirmDelete = async () => {
    if (!agentToDelete) return;
    try {
      await ApiClient.deleteAgent(agentToDelete.id);
      setAgents((prev) => prev.filter((a) => a.id !== agentToDelete.id));
      setAgentToDelete(null);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      a.phone.includes(search)
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Travel Agents Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage partner travel agents and quotation contacts
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Agent</span>
        </button>
      </div>

      {/* Search */}
      {agents.length > 2 && (
        <div className="mb-4">
          <div className="relative max-w-sm">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents by name, email or phone..."
              className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>
      )}

      {/* Agents List */}
      {loading ? (
        <div className="text-center py-12 text-xs text-slate-400">Loading agents...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-3">
          <p className="text-xs text-slate-500">
            {search ? 'No agents match your search.' : 'No partner agents added yet.'}
          </p>
          <button
            onClick={openAddModal}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            + Add First Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filtered.map((agent) => (
            <div
              key={agent.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{agent.name}</h3>

                  <button
                    onClick={() => toggleActive(agent)}
                    className="min-h-[38px] flex items-center gap-1 text-xs font-medium cursor-pointer"
                    title="Click to toggle active status"
                  >
                    {agent.active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <XCircle className="w-4 h-4 text-slate-400" /> Inactive
                      </span>
                    )}
                  </button>
                </div>

                <div className="mt-2.5 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{agent.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono">{agent.phone}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-slate-100">
                <button
                  onClick={() => openEditModal(agent)}
                  className="min-h-[44px] flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => setAgentToDelete(agent)}
                  className="min-h-[44px] flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Agent Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAgent ? 'Edit Agent' : 'Add New Partner Agent'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Agent / Agency Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apex Holidays"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98250 12345"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quotation Email <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="quotes@apexholidays.com"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="activeCheck"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900"
            />
            <label htmlFor="activeCheck" className="text-xs font-medium text-slate-700 cursor-pointer">
              Active (eligible to receive quote requests)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving...' : editingAgent ? 'Update Agent' : 'Add Agent'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Agent Modal */}
      {agentToDelete && (
        <Modal
          isOpen={Boolean(agentToDelete)}
          onClose={() => setAgentToDelete(null)}
          title="Delete Agent?"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Are you sure you want to delete <strong>{agentToDelete.name}</strong> ({agentToDelete.email})? This agent will no longer appear in future dispatch checklists.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAgentToDelete(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Delete Agent
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
