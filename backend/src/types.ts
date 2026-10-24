export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  phone: string;
  email: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InquiryStop {
  id: string;
  place: string;
  nights: number;
}

export interface DispatchRecord {
  id: string;
  agentId: string;
  agentName: string;
  agentEmail: string;
  status: 'sent' | 'failed' | 'test_preview';
  errorText?: string;
  sentAt: string;
  subject: string;
  previewHtml: string;
}

export type InquiryStatus = 'inquiry' | 'confirmed' | 'cancelled';

export interface Inquiry {
  id: string;
  inquiryNumber: number;
  type: 'package' | 'ticket';
  tripType?: 'single' | 'return';
  clientName: string;
  clientPhone: string; // Strictly kept in DB, never exposed to agents or in email payloads
  destination: string;
  pickup: string;
  drop: string;
  dateMode: 'fixed' | 'anytime';
  startDate?: string;
  endDate?: string;
  returnDate?: string;
  dateMessage?: string;
  adults: number;
  children: number;
  travelClass?: 'Economy' | 'Premium Economy' | 'Business';
  airlinePref?: string;
  notes?: string;
  status: InquiryStatus;
  stops: InquiryStop[];
  dispatches: DispatchRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface LedgerDisbursement {
  id: string;
  agentName: string;
  agentId?: string;
  amount: number;
  date: string;
  note?: string;
  createdAt: string;
}

export interface LedgerRecord {
  id: string;
  clientName: string;
  amountReceived: number;
  date: string;
  note?: string;
  inquiryId?: string | null;
  disbursements: LedgerDisbursement[];
  createdAt: string;
  updatedAt: string;
}

// Data store schema
export interface DatabaseSchema {
  users: User[];
  agents: Agent[];
  inquiries: Inquiry[];
  ledger: LedgerRecord[];
  nextInquiryNumber: number;
  config: {
    resendApiKey?: string;
    resendFromEmail?: string;
  };
}

// Agent Email Payload strictly omits clientPhone
export interface AgentEmailPayload {
  agentName: string;
  clientName: string;
  inquiryNumber: number;
  type: 'package' | 'ticket';
  tripType?: 'single' | 'return';
  destination: string;
  pickup: string;
  drop: string;
  dateMode: 'fixed' | 'anytime';
  startDate?: string;
  endDate?: string;
  returnDate?: string;
  dateMessage?: string;
  stops?: Array<{ place: string; nights: number }>;
  adults: number;
  children: number;
  travelClass?: string;
  airlinePref?: string;
  notes?: string;
}
