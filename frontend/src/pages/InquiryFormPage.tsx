import React, { useState, useEffect } from 'react';
import { Agent, Inquiry } from '../types/index.ts';
import { ApiClient } from '../api/client.ts';
import {
  Send,
  Plus,
  Trash2,
  Search,
  CheckSquare,
  Square,
  Shield,
  Plane,
  Luggage,
} from 'lucide-react';

interface InquiryFormPageProps {
  onSuccess: (inquiry: Inquiry) => void;
  onNavigateToAgents: () => void;
}

export const InquiryFormPage: React.FC<InquiryFormPageProps> = ({
  onSuccess,
  onNavigateToAgents,
}) => {
  // Mode & Trip
  const [inquiryType, setInquiryType] = useState<'package' | 'ticket'>('package');
  const [tripType, setTripType] = useState<'single' | 'return'>('single');

  // Client info
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  // Routing
  const [destination, setDestination] = useState('');
  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');

  // Package Stops (nights initially blank so user can enter)
  const [stops, setStops] = useState<Array<{ place: string; nights: number | string }>>([
    { place: '', nights: '' },
  ]);

  // Dates
  const [dateMode, setDateMode] = useState<'fixed' | 'anytime'>('fixed');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [dateMessage, setDateMessage] = useState('');

  // Passengers & Specs
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [travelClass, setTravelClass] = useState<'Economy' | 'Premium Economy' | 'Business'>('Economy');
  const [airlinePref, setAirlinePref] = useState('');
  const [notes, setNotes] = useState('');

  // Agents checklist
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [agentSearch, setAgentSearch] = useState('');
  const [loadingAgents, setLoadingAgents] = useState(true);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch agents on mount
  useEffect(() => {
    async function loadAgents() {
      try {
        const { agents } = await ApiClient.getAgents();
        const active = agents.filter((a) => a.active);
        setAgents(active);
        // Dispatch to agent checkbox should be unchecked by default (done manually by user)
        setSelectedAgentIds([]);
      } catch (err: any) {
        console.error('Error loading agents:', err);
      } finally {
        setLoadingAgents(false);
      }
    }
    loadAgents();
  }, []);

  // Stops management
  const handleAddStop = () => {
    setStops([...stops, { place: '', nights: '' }]);
  };

  const handleRemoveStop = (index: number) => {
    setStops(stops.filter((_, i) => i !== index));
  };

  const handleStopChange = (index: number, field: 'place' | 'nights', value: string | number) => {
    const updated = [...stops];
    if (field === 'place') {
      updated[index].place = String(value);
    } else {
      const val = String(value).trim();
      updated[index].nights = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
    }
    setStops(updated);
  };

  // Agent selection
  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
      a.email.toLowerCase().includes(agentSearch.toLowerCase())
  );

  const handleToggleAgent = (id: string) => {
    if (selectedAgentIds.includes(id)) {
      setSelectedAgentIds(selectedAgentIds.filter((aid) => aid !== id));
    } else {
      setSelectedAgentIds([...selectedAgentIds, id]);
    }
  };

  const handleSelectAllAgents = () => {
    if (selectedAgentIds.length === filteredAgents.length) {
      setSelectedAgentIds([]);
    } else {
      setSelectedAgentIds(filteredAgents.map((a) => a.id));
    }
  };

  // Submit
  const handleSaveAndSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic front validations
    if (!clientName.trim()) {
      setErrorMessage('Client name is required.');
      return;
    }
    if (!clientPhone.trim() || clientPhone.trim().length < 7) {
      setErrorMessage('Valid client phone (at least 7 digits) is required.');
      return;
    }
    if (!destination.trim()) {
      setErrorMessage('Destination is required.');
      return;
    }
    if (selectedAgentIds.length === 0) {
      setErrorMessage('Please select at least one agent to dispatch.');
      return;
    }

    // Clean stops if package
    const cleanedStops = inquiryType === 'package'
      ? stops
          .filter((s) => s.place.trim() !== '')
          .map((s) => ({
            place: s.place.trim(),
            nights: s.nights === '' ? 0 : Number(s.nights),
          }))
      : [];

    setSubmitting(true);

    try {
      const payload = {
        type: inquiryType,
        tripType: inquiryType === 'ticket' ? tripType : undefined,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        destination: destination.trim(),
        pickup: pickup.trim(),
        drop: drop.trim(),
        dateMode,
        startDate: dateMode === 'fixed' ? startDate : undefined,
        endDate: dateMode === 'fixed' ? endDate : undefined,
        returnDate: inquiryType === 'ticket' && tripType === 'return' && dateMode === 'fixed' ? returnDate : undefined,
        dateMessage: dateMode === 'anytime' ? dateMessage.trim() : undefined,
        adults: Number(adults),
        children: Number(children || 0),
        travelClass: inquiryType === 'ticket' ? travelClass : undefined,
        airlinePref: inquiryType === 'ticket' ? airlinePref.trim() : undefined,
        notes: notes.trim(),
        stops: cleanedStops,
        agentIds: selectedAgentIds,
      };

      const { inquiry } = await ApiClient.createAndDispatchInquiry(payload);
      onSuccess(inquiry);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch inquiry. Please check your inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          New Travel Inquiry
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Fast intake &amp; one-click quotation dispatching to partner agents
        </p>
      </div>

      {errorMessage && (
        <div className="mb-5 p-3.5 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSaveAndSend} className="space-y-6">
        {/* Section 1: Inquiry Type Selector */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Inquiry Category
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setInquiryType('package')}
              className={`min-h-[48px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                inquiryType === 'package'
                  ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Luggage className="w-4 h-4" />
              <span>Tour Package</span>
            </button>

            <button
              type="button"
              onClick={() => setInquiryType('ticket')}
              className={`min-h-[48px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                inquiryType === 'ticket'
                  ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Plane className="w-4 h-4" />
              <span>Flight Ticket</span>
            </button>
          </div>

          {/* Ticket Trip Type Options */}
          {inquiryType === 'ticket' && (
            <div className="pt-2 flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="tripType"
                  value="single"
                  checked={tripType === 'single'}
                  onChange={() => setTripType('single')}
                  className="text-slate-900 focus:ring-slate-900"
                />
                <span>One-Way (Single)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="tripType"
                  value="return"
                  checked={tripType === 'return'}
                  onChange={() => setTripType('return')}
                  className="text-slate-900 focus:ring-slate-900"
                />
                <span>Round-Trip (Going &amp; Return)</span>
              </label>
            </div>
          )}
        </div>

        {/* Section 2: Client Contact & Route */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Client &amp; Destination Details
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Client Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Ramesh Patel"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-slate-700">
                  Client Phone <span className="text-rose-500">*</span>
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                  <Shield className="w-3 h-3" /> Never shared
                </span>
              </div>
              <input
                type="tel"
                required
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Destination <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Goa / Dubai / Kashmir"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Pickup Point
              </label>
              <input
                type="text"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                placeholder="e.g. Mumbai Airport / Ahmedabad"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Drop Point
              </label>
              <input
                type="text"
                value={drop}
                onChange={(e) => setDrop(e.target.value)}
                placeholder="e.g. Hotel Resort / Airport"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Tour Package Multi-Stops (Package only) */}
        {inquiryType === 'package' && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Stops &amp; Night Stays
                </label>
                <p className="text-[11px] text-slate-400">Add places and nights for this tour</p>
              </div>
              <button
                type="button"
                onClick={handleAddStop}
                className="min-h-[40px] flex items-center gap-1 px-3 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Stop</span>
              </button>
            </div>

            <div className="space-y-2">
              {stops.map((stop, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400 w-5 text-right shrink-0">
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={stop.place}
                    onChange={(e) => handleStopChange(idx, 'place', e.target.value)}
                    placeholder="Place / City (e.g. North Goa)"
                    className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min="0"
                      placeholder=""
                      value={stop.nights}
                      onChange={(e) => handleStopChange(idx, 'nights', e.target.value)}
                      className="w-16 px-2 py-2 text-xs text-center bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap">Nts</span>
                  </div>
                  {stops.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStop(idx)}
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="Remove stop"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 4: Travel Dates */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Dates
          </label>

          <div className="flex items-center gap-4 pb-1">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="dateMode"
                value="fixed"
                checked={dateMode === 'fixed'}
                onChange={() => setDateMode('fixed')}
                className="text-slate-900 focus:ring-slate-900"
              />
              <span>Fixed Dates</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="dateMode"
                value="anytime"
                checked={dateMode === 'anytime'}
                onChange={() => setDateMode('anytime')}
                className="text-slate-900 focus:ring-slate-900"
              />
              <span>Anytime Between (Flexible)</span>
            </label>
          </div>

          {dateMode === 'fixed' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Ticket Round-Trip Return Date (Fixed Mode Only) */}
              {inquiryType === 'ticket' && tripType === 'return' && (
                <div className="pt-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Return Flight Date
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Flexible Travel Dates / Message
              </label>
              <textarea
                rows={3}
                value={dateMessage}
                onChange={(e) => setDateMessage(e.target.value)}
                placeholder="e.g. Flexible in November or December, looking for a 4-5 days trip anytime after Diwali"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 placeholder:text-slate-400"
              />
            </div>
          )}
        </div>

        {/* Section 5: Passengers & Ticket Options */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Passengers &amp; Preferences
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Adults (12+ yrs) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={adults}
                onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Children
              </label>
              <input
                type="number"
                min="0"
                value={children}
                onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {inquiryType === 'ticket' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Flight Class (Optional)
                </label>
                <select
                  value={travelClass}
                  onChange={(e: any) => setTravelClass(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="Economy">Economy</option>
                  <option value="Premium Economy">Premium Economy</option>
                  <option value="Business">Business</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Preferred Airline (Optional)
                </label>
                <input
                  type="text"
                  value={airlinePref}
                  onChange={(e) => setAirlinePref(e.target.value)}
                  placeholder="e.g. IndiGo, Air India, Emirates"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Special Notes / Requests (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 4-star beach resort preferred, vegetarian meals, airport transfer required"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Section 6: Agent Checklist */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Dispatch To Agents ({selectedAgentIds.length} Selected)
              </label>
              <p className="text-[11px] text-slate-400">
                Separate email sent to each agent via Resend
              </p>
            </div>

            {agents.length > 0 && (
              <button
                type="button"
                onClick={handleSelectAllAgents}
                className="min-h-[38px] text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
              >
                {selectedAgentIds.length === filteredAgents.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {/* Search agents */}
          {agents.length > 3 && (
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                placeholder="Search active agents..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          )}

          {loadingAgents ? (
            <div className="text-center py-4 text-xs text-slate-400">Loading agents...</div>
          ) : agents.length === 0 ? (
            <div className="p-4 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-2">
              <p className="text-xs text-slate-500">No active travel agents in your directory yet.</p>
              <button
                type="button"
                onClick={onNavigateToAgents}
                className="min-h-[44px] px-3 py-1.5 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                + Add Agents First
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto divide-y divide-slate-100">
              {filteredAgents.map((agent) => {
                const isSelected = selectedAgentIds.includes(agent.id);
                return (
                  <div
                    key={agent.id}
                    onClick={() => handleToggleAgent(agent.id)}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-slate-900 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <div>
                        <div className="text-xs font-semibold text-slate-900">{agent.name}</div>
                        <div className="text-[11px] text-slate-400">{agent.email}</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">{agent.phone}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Submit Button (Ergonomic Sticky / Fixed Bottom Action) */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting || agents.length === 0 || selectedAgentIds.length === 0}
            className="w-full min-h-[50px] flex items-center justify-center gap-2 py-3 px-6 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Dispatching to Agents...' : 'Save & Send to Agents'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
