import React, { useState, useEffect } from 'react';
import { LedgerRecord, LedgerSummary, Inquiry, Agent } from '../types/index.ts';
import { ApiClient } from '../api/client.ts';
import { exportLedgerPDF } from '../lib/pdf.ts';
import { Modal } from '../components/Modal.tsx';
import {
  Download,
  Plus,
  Send,
  Edit2,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import { LocalDatabase } from '../lib/localDb.ts';

export const LedgerPage: React.FC = () => {
  const [records, setRecords] = useState<LedgerRecord[]>(() => LocalDatabase.getLedger().records);
  const [summary, setSummary] = useState<LedgerSummary>(() => LocalDatabase.getLedger().summary);
  const [inquiries, setInquiries] = useState<Inquiry[]>(() => LocalDatabase.getInquiries());
  const [agents, setAgents] = useState<Agent[]>(() => LocalDatabase.getAgents());
  const [loading, setLoading] = useState(false);

  // Modal 1: Add New Received Record
  const [isAddReceivedOpen, setIsAddReceivedOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newAmountReceived, setNewAmountReceived] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newNote, setNewNote] = useState('');
  const [newInquiryId, setNewInquiryId] = useState<string>('');
  const [addReceivedError, setAddReceivedError] = useState<string | null>(null);
  const [savingReceived, setSavingReceived] = useState(false);

  // Modal 2: Edit Received Record
  const [editingRecord, setEditingRecord] = useState<LedgerRecord | null>(null);
  const [editClientName, setEditClientName] = useState('');
  const [editAmountReceived, setEditAmountReceived] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editInquiryId, setEditInquiryId] = useState<string>('');
  const [editRecordError, setEditRecordError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal 3: "+ Send" (Disburse inside existing record)
  const [sendTargetRecord, setSendTargetRecord] = useState<LedgerRecord | null>(null);
  const [sendAgentName, setSendAgentName] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendDate, setSendDate] = useState(new Date().toISOString().split('T')[0]);
  const [sendNote, setSendNote] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [savingSend, setSavingSend] = useState(false);

  // Modal 4: Edit a Disbursement
  const [editDisbursementContext, setEditDisbursementContext] = useState<{
    recordId: string;
    recordClientName: string;
    disbursementId: string;
    agentName: string;
    amount: number;
    date: string;
    note?: string;
  } | null>(null);
  const [editDisbAmount, setEditDisbAmount] = useState('');
  const [editDisbAgentName, setEditDisbAgentName] = useState('');
  const [editDisbDate, setEditDisbDate] = useState('');
  const [editDisbNote, setEditDisbNote] = useState('');
  const [editDisbError, setEditDisbError] = useState<string | null>(null);
  const [savingEditDisb, setSavingEditDisb] = useState(false);

  // Modal 5: Delete Record Confirmation
  const [recordToDelete, setRecordToDelete] = useState<LedgerRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState(false);

  const fetchLedgerData = async () => {
    try {
      setLoading(true);
      const [ledgerRes, inqRes, agentsRes] = await Promise.all([
        ApiClient.getLedger(),
        ApiClient.getInquiries(),
        ApiClient.getAgents(),
      ]);
      setRecords(ledgerRes.records);
      setSummary(ledgerRes.summary);
      setInquiries(inqRes.inquiries);
      setAgents(agentsRes.agents);
    } catch (err: any) {
      console.error('Failed to load ledger data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedgerData();
  }, []);

  // --- Handlers: Add Received Record ---
  const handleOpenAddReceived = () => {
    setNewClientName('');
    setNewAmountReceived('');
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewNote('');
    setNewInquiryId('');
    setAddReceivedError(null);
    setIsAddReceivedOpen(true);
  };

  const handleCreateReceived = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddReceivedError(null);

    const amount = parseFloat(newAmountReceived);
    if (!newClientName.trim()) {
      setAddReceivedError('Client name is required.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setAddReceivedError('Amount received must be a positive number.');
      return;
    }

    setSavingReceived(true);
    try {
      await ApiClient.createLedgerRecord({
        clientName: newClientName.trim(),
        amountReceived: amount,
        date: newDate,
        note: newNote.trim(),
        inquiryId: newInquiryId || null,
      });
      setIsAddReceivedOpen(false);
      await fetchLedgerData();
    } catch (err: any) {
      setAddReceivedError(err.message || 'Failed to save received record.');
    } finally {
      setSavingReceived(false);
    }
  };

  // --- Handlers: Edit Received Record ---
  const handleOpenEditRecord = (record: LedgerRecord) => {
    setEditingRecord(record);
    setEditClientName(record.clientName);
    setEditAmountReceived(String(record.amountReceived));
    setEditDate(record.date);
    setEditNote(record.note || '');
    setEditInquiryId(record.inquiryId || '');
    setEditRecordError(null);
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setEditRecordError(null);

    const amount = parseFloat(editAmountReceived);
    if (!editClientName.trim()) {
      setEditRecordError('Client name is required.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setEditRecordError('Amount received must be a positive number.');
      return;
    }

    // Client-side quick check
    if (amount < editingRecord.totalSent) {
      setEditRecordError(
        `Cannot reduce received amount to Rs. ${amount} because Rs. ${editingRecord.totalSent} has already been sent to agents.`
      );
      return;
    }

    setSavingEdit(true);
    try {
      await ApiClient.updateLedgerRecord(editingRecord.id, {
        clientName: editClientName.trim(),
        amountReceived: amount,
        date: editDate,
        note: editNote.trim(),
        inquiryId: editInquiryId || null,
      });
      setEditingRecord(null);
      await fetchLedgerData();
    } catch (err: any) {
      setEditRecordError(err.message || 'Failed to update record.');
    } finally {
      setSavingEdit(false);
    }
  };

  // --- Handlers: + Send Inside Record ---
  const handleOpenSendModal = (record: LedgerRecord) => {
    setSendTargetRecord(record);
    setSendAgentName('');
    // Locked client name, prefilled with balance held
    setSendAmount(String(record.balanceHeld));
    setSendDate(new Date().toISOString().split('T')[0]);
    setSendNote('');
    setSendError(null);
  };

  const handleCreateDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendTargetRecord) return;
    setSendError(null);

    const amount = parseFloat(sendAmount);
    if (!sendAgentName.trim()) {
      setSendError('Agent name is required.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setSendError('Disbursement amount must be greater than zero.');
      return;
    }
    if (amount > sendTargetRecord.balanceHeld) {
      setSendError(
        `Over-send rejected: Available balance held for ${sendTargetRecord.clientName} is Rs. ${sendTargetRecord.balanceHeld}. You cannot send Rs. ${amount}.`
      );
      return;
    }

    setSavingSend(true);
    try {
      await ApiClient.addDisbursement(sendTargetRecord.id, {
        agentName: sendAgentName.trim(),
        amount,
        date: sendDate,
        note: sendNote.trim(),
      });
      setSendTargetRecord(null);
      await fetchLedgerData();
    } catch (err: any) {
      setSendError(err.message || 'Failed to disburse funds.');
    } finally {
      setSavingSend(false);
    }
  };

  // --- Handlers: Edit Disbursement ---
  const handleOpenEditDisbursement = (record: LedgerRecord, disb: any) => {
    setEditDisbursementContext({
      recordId: record.id,
      recordClientName: record.clientName,
      disbursementId: disb.id,
      agentName: disb.agentName,
      amount: disb.amount,
      date: disb.date,
      note: disb.note,
    });
    setEditDisbAgentName(disb.agentName);
    setEditDisbAmount(String(disb.amount));
    setEditDisbDate(disb.date);
    setEditDisbNote(disb.note || '');
    setEditDisbError(null);
  };

  const handleUpdateDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDisbursementContext) return;
    setEditDisbError(null);

    const amount = parseFloat(editDisbAmount);
    if (!editDisbAgentName.trim()) {
      setEditDisbError('Agent name is required.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setEditDisbError('Amount must be greater than zero.');
      return;
    }

    setSavingEditDisb(true);
    try {
      await ApiClient.updateDisbursement(
        editDisbursementContext.recordId,
        editDisbursementContext.disbursementId,
        {
          agentName: editDisbAgentName.trim(),
          amount,
          date: editDisbDate,
          note: editDisbNote.trim(),
        }
      );
      setEditDisbursementContext(null);
      await fetchLedgerData();
    } catch (err: any) {
      setEditDisbError(err.message || 'Failed to update disbursement.');
    } finally {
      setSavingEditDisb(false);
    }
  };

  const handleRemoveDisbursement = async (recordId: string, disbId: string, agentName: string) => {
    if (!window.confirm(`Remove disbursement of Rs. ${agentName} from this client's record?`)) {
      return;
    }
    try {
      await ApiClient.removeDisbursement(recordId, disbId);
      await fetchLedgerData();
    } catch (err: any) {
      alert(`Failed to remove: ${err.message}`);
    }
  };

  // --- Handlers: Delete Record ---
  const confirmDeleteRecord = async () => {
    if (!recordToDelete) return;
    setDeletingRecord(true);
    try {
      await ApiClient.deleteLedgerRecord(recordToDelete.id);
      setRecordToDelete(null);
      await fetchLedgerData();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingRecord(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Khatabook Middleman Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track client money held, record agent disbursements, and prevent over-sending
          </p>
        </div>

        <div className="flex items-center gap-2">
          {records.length > 0 && (
            <button
              onClick={() => exportLedgerPDF(records, summary)}
              className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Export Ledger PDF"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export PDF</span>
            </button>
          )}

          <button
            onClick={handleOpenAddReceived}
            className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Money Received</span>
          </button>
        </div>
      </div>

      {/* Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Received</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
            Rs. {summary.totalReceived.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">From all client bookings</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Sent</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
            Rs. {summary.totalSent.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Disbursed to travel agents</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Balance With Me</span>
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-700">
            Rs. {summary.balanceWithMe.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Net funds held</span>
        </div>
      </div>

      {/* Records Feed */}
      {loading ? (
        <div className="text-center py-12 text-xs text-slate-400">Loading ledger records...</div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-3">
          <p className="text-xs text-slate-500">
            No client ledger records found yet. Record client money received to start tracking.
          </p>
          <button
            onClick={handleOpenAddReceived}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            + Add First Received Record
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((rec) => {
            const linkedInquiry = inquiries.find((i) => i.id === rec.inquiryId);
            const isFullyDisbursed = rec.balanceHeld <= 0;

            return (
              <div
                key={rec.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-all space-y-3.5"
              >
                {/* Row Header: Client Name, Date, Edit/Delete triggers */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight">
                      {rec.clientName}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span>Date: {rec.date}</span>
                      {rec.note && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="italic">{rec.note}</span>
                        </>
                      )}
                      {linkedInquiry && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-blue-600 font-medium">
                            Linked #{linkedInquiry.inquiryNumber} ({linkedInquiry.destination})
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions for the main record */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEditRecord(rec)}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Edit received record"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setRecordToDelete(rec)}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete record (and its disbursements)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Financial 3-Column Pill Strip */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Received
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-slate-900 block mt-0.5">
                      Rs. {rec.amountReceived.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Sent Total
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-rose-600 block mt-0.5">
                      Rs. {rec.totalSent.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Balance Held
                    </span>
                    <span
                      className={`text-xs sm:text-sm font-bold font-mono tabular-nums block mt-0.5 ${
                        isFullyDisbursed ? 'text-slate-400' : 'text-emerald-700'
                      }`}
                    >
                      Rs. {rec.balanceHeld.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Embedded Sent Amounts List inside same record */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Disbursed to Agents ({rec.disbursements.length})
                    </span>

                    {/* "+ Send" button opens form with locked client name and prefilled balance */}
                    {!isFullyDisbursed ? (
                      <button
                        onClick={() => handleOpenSendModal(rec)}
                        className="min-h-[38px] flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-all cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        <span>+ Send</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-400">
                        Fully disbursed (0 balance)
                      </span>
                    )}
                  </div>

                  {rec.disbursements.length === 0 ? (
                    <div className="text-[11px] text-slate-400 italic bg-white p-2 rounded-lg border border-dashed border-slate-200">
                      No funds disbursed to agents yet. Click "+ Send" to pay an agent.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {rec.disbursements.map((disb) => (
                        <div
                          key={disb.id}
                          className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs"
                        >
                          <div>
                            <div className="font-semibold text-slate-900">{disb.agentName}</div>
                            <div className="text-[11px] text-slate-500">
                              {disb.date} {disb.note ? `· ${disb.note}` : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-bold font-mono tabular-nums text-rose-700">
                              Rs. {disb.amount.toLocaleString('en-IN')}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEditDisbursement(rec, disb)}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                                title="Edit sent amount"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleRemoveDisbursement(rec.id, disb.id, disb.agentName)}
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                title="Remove sent amount"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Add Money Received Record */}
      <Modal
        isOpen={isAddReceivedOpen}
        onClose={() => setIsAddReceivedOpen(false)}
        title="Record Money Received from Client"
      >
        <form onSubmit={handleCreateReceived} className="space-y-4">
          {addReceivedError && (
            <div className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg">
              {addReceivedError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Client Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="e.g. Ramesh Patel"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount Received (Rs.) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="any"
              required
              value={newAmountReceived}
              onChange={(e) => setNewAmountReceived(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Link to Inquiry (Optional)
            </label>
            <select
              value={newInquiryId}
              onChange={(e) => setNewInquiryId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="">-- No linked inquiry --</option>
              {inquiries.map((inq) => (
                <option key={inq.id} value={inq.id}>
                  #{inq.inquiryNumber} · {inq.clientName} ({inq.destination})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="e.g. Advance 50% payment for Goa package"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddReceivedOpen(false)}
              className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingReceived}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {savingReceived ? 'Saving...' : 'Save Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Edit Received Record */}
      {editingRecord && (
        <Modal
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title="Edit Client Received Record"
        >
          <form onSubmit={handleUpdateRecord} className="space-y-4">
            {editRecordError && (
              <div className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg">
                {editRecordError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Client Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editClientName}
                onChange={(e) => setEditClientName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Amount Received (Rs.) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  Min allowed: Rs. {editingRecord.totalSent}
                </span>
              </div>
              <input
                type="number"
                min={editingRecord.totalSent}
                step="any"
                required
                value={editAmountReceived}
                onChange={(e) => setEditAmountReceived(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Date
              </label>
              <input
                type="date"
                required
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link to Inquiry
              </label>
              <select
                value={editInquiryId}
                onChange={(e) => setEditInquiryId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">-- No linked inquiry --</option>
                {inquiries.map((inq) => (
                  <option key={inq.id} value={inq.id}>
                    #{inq.inquiryNumber} · {inq.clientName} ({inq.destination})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Note</label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingEdit ? 'Updating...' : 'Update Record'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal 3: "+ Send" (Disburse inside existing record) */}
      {sendTargetRecord && (
        <Modal
          isOpen={Boolean(sendTargetRecord)}
          onClose={() => setSendTargetRecord(null)}
          title={`Disburse to Agent · ${sendTargetRecord.clientName}`}
        >
          <form onSubmit={handleCreateDisbursement} className="space-y-4">
            {sendError && (
              <div className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg">
                {sendError}
              </div>
            )}

            {/* Client Name is LOCKED (read-only) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Client (Locked)
              </label>
              <input
                type="text"
                disabled
                value={sendTargetRecord.clientName}
                className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Partner Agent or Type Name <span className="text-rose-500">*</span>
              </label>
              <div className="space-y-1.5">
                {agents.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) setSendAgentName(e.target.value);
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 mb-1.5"
                  >
                    <option value="">-- Choose from saved directory --</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} ({a.email})
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  required
                  value={sendAgentName}
                  onChange={(e) => setSendAgentName(e.target.value)}
                  placeholder="Agent or Supplier Name (e.g. Apex Holidays)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Amount Sent (Rs.) <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-emerald-700 font-mono">
                  Prefilled: Max available Rs. {sendTargetRecord.balanceHeld}
                </span>
              </div>
              <input
                type="number"
                min="1"
                max={sendTargetRecord.balanceHeld}
                step="any"
                required
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Disbursement Date
              </label>
              <input
                type="date"
                required
                value={sendDate}
                onChange={(e) => setSendDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Note</label>
              <input
                type="text"
                value={sendNote}
                onChange={(e) => setSendNote(e.target.value)}
                placeholder="e.g. Hotel advance payment"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSendTargetRecord(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSend}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingSend ? 'Recording...' : 'Add Sent Amount'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal 4: Edit Disbursement */}
      {editDisbursementContext && (
        <Modal
          isOpen={Boolean(editDisbursementContext)}
          onClose={() => setEditDisbursementContext(null)}
          title={`Edit Disbursement · ${editDisbursementContext.recordClientName}`}
        >
          <form onSubmit={handleUpdateDisbursement} className="space-y-4">
            {editDisbError && (
              <div className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg">
                {editDisbError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Agent Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={editDisbAgentName}
                onChange={(e) => setEditDisbAgentName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount Sent (Rs.) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={editDisbAmount}
                onChange={(e) => setEditDisbAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={editDisbDate}
                onChange={(e) => setEditDisbDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Note</label>
              <input
                type="text"
                value={editDisbNote}
                onChange={(e) => setEditDisbNote(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditDisbursementContext(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEditDisb}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingEditDisb ? 'Saving...' : 'Update Sent Amount'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal 5: Delete Record Confirmation */}
      {recordToDelete && (
        <Modal
          isOpen={Boolean(recordToDelete)}
          onClose={() => setRecordToDelete(null)}
          title="Delete Ledger Record?"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div className="text-xs leading-relaxed">
                <strong>Warning:</strong> Deleting the record for <strong>{recordToDelete.clientName}</strong> (Received: Rs. {recordToDelete.amountReceived}) will also permanently remove all of its <strong>{recordToDelete.disbursements.length} disbursement records</strong>.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingRecord}
                onClick={confirmDeleteRecord}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {deletingRecord ? 'Deleting...' : 'Yes, Delete Record & Sent Amounts'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
