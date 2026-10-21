import React, { useState, useEffect, useMemo } from 'react';
import { Inquiry, InquiryStatus } from '../types/index.ts';
import { ApiClient } from '../api/client.ts';
import { exportInquiriesPDF } from '../lib/pdf.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { Modal } from '../components/Modal.tsx';
import {
  Download,
  Trash2,
  Eye,
  Plus,
  Luggage,
  Plane,
  AlertTriangle,
  Search,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Layers,
} from 'lucide-react';

import { LocalDatabase } from '../lib/localDb.ts';

interface InquiryListPageProps {
  onNewInquiry: () => void;
  onOpenDispatchStatus: (inquiry: Inquiry) => void;
}

export const InquiryListPage: React.FC<InquiryListPageProps> = ({
  onNewInquiry,
  onOpenDispatchStatus,
}) => {
  const [inquiries, setInquiries] = useState<Inquiry[]>(() => LocalDatabase.getInquiries());
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | InquiryStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'package' | 'ticket'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Delete modal state
  const [inquiryToDelete, setInquiryToDelete] = useState<Inquiry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      const res = await ApiClient.getInquiries();
      setInquiries(res.inquiries);
    } catch (err: any) {
      console.error('Error fetching inquiries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const handleStatusChange = async (inquiryId: string, newStatus: InquiryStatus) => {
    // 1. Optimistically update UI
    setInquiries((prev) =>
      prev.map((i) => (i.id === inquiryId ? { ...i, status: newStatus } : i))
    );
    // 2. Update local database
    LocalDatabase.updateInquiryStatus(inquiryId, newStatus);
    // 3. Sync with backend
    try {
      await ApiClient.updateInquiryStatus(inquiryId, newStatus);
    } catch (err: any) {
      console.warn('Server status sync handled locally:', err);
    }
  };

  const confirmDelete = async () => {
    if (!inquiryToDelete) return;
    setDeleting(true);
    const targetId = inquiryToDelete.id;

    // 1. Optimistically remove from UI list
    setInquiries((prev) => prev.filter((i) => i.id !== targetId));
    // 2. Remove from local database
    LocalDatabase.deleteInquiry(targetId);
    // 3. Close modal immediately
    setInquiryToDelete(null);

    // 4. Request server delete in background
    try {
      await ApiClient.deleteInquiry(targetId);
    } catch (err: any) {
      console.warn('Server delete handled locally:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Counts for each status
  const counts = useMemo(() => {
    const total = inquiries.length;
    const pending = inquiries.filter((i) => i.status === 'inquiry').length;
    const confirmed = inquiries.filter((i) => i.status === 'confirmed').length;
    const cancelled = inquiries.filter((i) => i.status === 'cancelled').length;
    return { total, pending, confirmed, cancelled };
  }, [inquiries]);

  // Comprehensive search and filtering across client name, destination, phone, number, agent names
  const filtered = useMemo(() => {
    return inquiries.filter((inq) => {
      // Status filter
      if (filterStatus !== 'all' && inq.status !== filterStatus) {
        return false;
      }

      // Type filter (Package / Ticket)
      if (typeFilter !== 'all' && inq.type !== typeFilter) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const numStr = String(inq.inquiryNumber);
        const nameMatch = inq.clientName.toLowerCase().includes(query);
        const phoneMatch = inq.clientPhone?.toLowerCase().includes(query);
        const destMatch = inq.destination.toLowerCase().includes(query);
        const pickupMatch = inq.pickup.toLowerCase().includes(query);
        const dropMatch = inq.drop.toLowerCase().includes(query);
        const numMatch = numStr.includes(query) || `#${numStr}`.includes(query);
        const agentMatch = (inq.dispatches || []).some((d) =>
          d.agentName.toLowerCase().includes(query)
        );

        return (
          nameMatch ||
          phoneMatch ||
          destMatch ||
          pickupMatch ||
          dropMatch ||
          numMatch ||
          agentMatch
        );
      }

      return true;
    });
  }, [inquiries, filterStatus, typeFilter, searchQuery]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Travel Inquiries
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Search inquiries, filter by status, and track dispatch logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {inquiries.length > 0 && (
            <button
              onClick={() => exportInquiriesPDF(filtered)}
              className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Export Current Filtered List as PDF"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Export PDF ({filtered.length})</span>
            </button>
          )}

          <button
            onClick={onNewInquiry}
            className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Inquiry</span>
          </button>
        </div>
      </div>

      {/* Interactive Status Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        {/* All */}
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px] opacity-80">
              All Inquiries
            </span>
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums">{counts.total}</div>
        </button>

        {/* Pending (Inquiry) */}
        <button
          type="button"
          onClick={() => setFilterStatus('inquiry')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'inquiry'
              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px] opacity-80">
              Pending (I)
            </span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums">{counts.pending}</div>
        </button>

        {/* Confirmed */}
        <button
          type="button"
          onClick={() => setFilterStatus('confirmed')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'confirmed'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px] opacity-80">
              Confirmed (C)
            </span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums">{counts.confirmed}</div>
        </button>

        {/* Cancelled */}
        <button
          type="button"
          onClick={() => setFilterStatus('cancelled')}
          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
            filterStatus === 'cancelled'
              ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold uppercase tracking-wider text-[10px] opacity-80">
              Cancelled (x)
            </span>
            <XCircle className="w-3.5 h-3.5" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums">{counts.cancelled}</div>
        </button>
      </div>

      {/* Search Bar & Secondary Category Selector */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs mb-5 space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by client name, destination, inquiry #, phone, or agent..."
            className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills / Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                filterStatus === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Statuses
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('inquiry')}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                filterStatus === 'inquiry'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Pending / Inquiry ({counts.pending})
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('confirmed')}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                filterStatus === 'confirmed'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Confirmed ({counts.confirmed})
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('cancelled')}
              className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                filterStatus === 'cancelled'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Cancelled ({counts.cancelled})
            </button>
          </div>

          {/* Category Filter (Package vs Ticket) */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                typeFilter === 'all' ? 'text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All Types
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => setTypeFilter('package')}
              className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                typeFilter === 'package' ? 'text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Packages
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => setTypeFilter('ticket')}
              className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                typeFilter === 'ticket' ? 'text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Tickets
            </button>
          </div>
        </div>
      </div>

      {/* Inquiry List Feed */}
      {loading ? (
        <div className="text-center py-12 text-xs text-slate-400">Loading inquiries...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-3">
          <p className="text-xs text-slate-500">
            {searchQuery || filterStatus !== 'all' || typeFilter !== 'all'
              ? `No inquiries found matching your filters.`
              : 'No inquiries recorded yet. Create your first inquiry to start dispatching.'}
          </p>
          {(searchQuery || filterStatus !== 'all' || typeFilter !== 'all') ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
                setTypeFilter('all');
              }}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          ) : (
            <button
              onClick={onNewInquiry}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              + Create First Inquiry
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((inq) => {
            const hasStops = inq.type === 'package' && inq.stops && inq.stops.length > 0;
            const agentsCount = inq.dispatches?.length || 0;

            return (
              <div
                key={inq.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-slate-300 transition-all space-y-3"
              >
                {/* Header row: Number, Category Icon, Destination, Client */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5 text-slate-700">
                      {inq.type === 'package' ? (
                        <Luggage className="w-4 h-4" />
                      ) : (
                        <Plane className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          #{inq.inquiryNumber}
                        </span>
                        <span className="text-sm font-bold text-slate-900 tracking-tight">
                          {inq.destination}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Client: <strong className="text-slate-900">{inq.clientName}</strong> · Phone:{' '}
                        <span className="font-mono">{inq.clientPhone}</span>
                      </div>
                    </div>
                  </div>

                  <StatusBadge status={inq.status} />
                </div>

                {/* Route & Dates unboxed typography */}
                <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 border-t border-slate-100">
                  <span className="font-medium text-slate-900">
                    {inq.pickup} &rarr; {inq.drop}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>
                    {inq.dateMode === 'fixed'
                      ? `${inq.startDate} to ${inq.endDate}`
                      : `Anytime: ${inq.startDate} to ${inq.endDate}`}
                  </span>
                  {inq.returnDate && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span>Return: {inq.returnDate}</span>
                    </>
                  )}
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>
                    {inq.adults} Adult{inq.adults > 1 ? 's' : ''}
                    {inq.children > 0 ? `, ${inq.children} Child${inq.children > 1 ? 'ren' : ''}` : ''}
                  </span>
                  {inq.travelClass && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">
                        ·
                      </span>
                      <span>{inq.travelClass}</span>
                    </>
                  )}
                </div>

                {/* Package Stops list */}
                {hasStops && (
                  <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="font-semibold text-slate-700">Stops:</span>{' '}
                    {inq.stops.map((s, idx) => (
                      <span key={s.id || idx}>
                        {idx > 0 ? ' &rarr; ' : ''}
                        {s.place} ({s.nights}N)
                      </span>
                    ))}
                  </div>
                )}

                {/* Agents sent to info */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <div>
                    Dispatched to{' '}
                    <strong className="text-slate-800">{agentsCount} agent(s)</strong>
                  </div>

                  <button
                    onClick={() => onOpenDispatchStatus(inq)}
                    className="min-h-[44px] flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Dispatch Log &amp; Preview</span>
                  </button>
                </div>

                {/* Bottom Action Row: Status Switcher (I, C, x) and Delete */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  {/* Status Toggle Buttons: I, C, x */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-400 mr-1">Status:</span>

                    <button
                      onClick={() => handleStatusChange(inq.id, 'inquiry')}
                      title="Mark as Pending / Inquiry (I)"
                      className={`min-h-[38px] px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        inq.status === 'inquiry'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      I (Pending)
                    </button>

                    <button
                      onClick={() => handleStatusChange(inq.id, 'confirmed')}
                      title="Mark as Confirmed (C)"
                      className={`min-h-[38px] px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        inq.status === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      C (Confirmed)
                    </button>

                    <button
                      onClick={() => handleStatusChange(inq.id, 'cancelled')}
                      title="Mark as Cancelled (x)"
                      className={`min-h-[38px] px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        inq.status === 'cancelled'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      x (Cancelled)
                    </button>
                  </div>

                  {/* Hard Delete button */}
                  <button
                    onClick={() => setInquiryToDelete(inq)}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Inquiry permanently"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {inquiryToDelete && (
        <Modal
          isOpen={Boolean(inquiryToDelete)}
          onClose={() => setInquiryToDelete(null)}
          title="Delete Inquiry Permanently?"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div className="text-xs leading-relaxed">
                This will permanently remove{' '}
                <strong>
                  Inquiry #{inquiryToDelete.inquiryNumber} ({inquiryToDelete.destination})
                </strong>
                , along with all its stops and dispatch records.
                <br />
                <span className="text-[11px] text-rose-700 mt-1 block">
                  Any linked Khatabook ledger records will be preserved with their link cleared.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInquiryToDelete(null)}
                className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
