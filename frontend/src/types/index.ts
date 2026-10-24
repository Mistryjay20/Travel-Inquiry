export interface User {
  id: string;
  email: string;
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
  clientPhone: string;
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
  totalSent: number;
  balanceHeld: number;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerSummary {
  totalReceived: number;
  totalSent: number;
  balanceWithMe: number;
}

export interface ConfigStatus {
  hasResendApiKey: boolean;
  resendFromEmail: string;
  mode: 'live' | 'test_preview';
}
