import {
  Agent,
  Inquiry,
  InquiryStatus,
  LedgerRecord,
  LedgerSummary,
  ConfigStatus,
  User,
  DispatchRecord,
} from '../types/index.ts';
import { LocalDatabase } from '../lib/localDb.ts';

const TOKEN_KEY = 'travel_dispatcher_jwt';

export class ApiClient {
  private static getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  public static setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  public static clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    const token = ApiClient.getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      ApiClient.clearToken();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = data.error || data.message || `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return data as T;
  }

  // --- Auth ---
  public static async login(credentials: { email: string; password: string }): Promise<{ token: string; user: User }> {
    const res = await ApiClient.request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    ApiClient.setToken(res.token);
    return res;
  }

  public static async getCurrentUser(): Promise<{ user: User }> {
    return ApiClient.request<{ user: User }>('/api/auth/me');
  }

  public static async logout(): Promise<void> {
    try {
      await ApiClient.request('/api/auth/logout', { method: 'POST' });
    } finally {
      ApiClient.clearToken();
    }
  }

  // --- Agents ---
  public static async getAgents(): Promise<{ agents: Agent[] }> {
    const local = LocalDatabase.getAgents();
    try {
      const res = await ApiClient.request<{ agents: Agent[] }>('/api/agents');
      if (res.agents && res.agents.length > 0) {
        LocalDatabase.mergeServerData({ agents: res.agents });
        return { agents: LocalDatabase.getAgents() };
      }
    } catch (err) {
      console.warn('Network fetch agents failed, serving from local database:', err);
    }
    return { agents: local };
  }

  public static async createAgent(agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ agent: Agent }> {
    const res = await ApiClient.request<{ agent: Agent }>('/api/agents', {
      method: 'POST',
      body: JSON.stringify(agent),
    });
    LocalDatabase.saveAgent(res.agent);
    return res;
  }

  public static async updateAgent(id: string, agent: Partial<Omit<Agent, 'id' | 'createdAt'>>): Promise<{ agent: Agent }> {
    const res = await ApiClient.request<{ agent: Agent }>(`/api/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(agent),
    });
    LocalDatabase.saveAgent(res.agent);
    return res;
  }

  public static async deleteAgent(id: string): Promise<{ message: string }> {
    LocalDatabase.deleteAgent(id);
    return ApiClient.request<{ message: string }>(`/api/agents/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Inquiries ---
  public static async getInquiries(): Promise<{ inquiries: Inquiry[] }> {
    const local = LocalDatabase.getInquiries();
    try {
      const res = await ApiClient.request<{ inquiries: Inquiry[] }>('/api/inquiries');
      if (res.inquiries && res.inquiries.length > 0) {
        LocalDatabase.mergeServerData({ inquiries: res.inquiries });
        return { inquiries: LocalDatabase.getInquiries() };
      } else if (local.length > 0) {
        // Server database is empty or re-spun, auto-restore from local database to server!
        ApiClient.syncAllLocalDataToServer().catch(() => {});
      }
    } catch (err) {
      console.warn('Network fetch inquiries failed, serving from local database:', err);
    }
    return { inquiries: local };
  }

  public static async createAndDispatchInquiry(payload: any): Promise<{ inquiry: Inquiry; dispatches: DispatchRecord[] }> {
    const res = await ApiClient.request<{ inquiry: Inquiry; dispatches: DispatchRecord[] }>('/api/inquiries', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    // Immediately persist to local database to guarantee survival across page refreshes
    LocalDatabase.saveInquiry(res.inquiry);
    return res;
  }

  public static async updateInquiryStatus(id: string, status: InquiryStatus): Promise<{ inquiry: Inquiry }> {
    LocalDatabase.updateInquiryStatus(id, status);
    const res = await ApiClient.request<{ inquiry: Inquiry }>(`/api/inquiries/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    LocalDatabase.saveInquiry(res.inquiry);
    return res;
  }

  public static async retryDispatch(inquiryId: string, dispatchId: string): Promise<{ message: string; dispatch: DispatchRecord; inquiry: Inquiry }> {
    const res = await ApiClient.request<{ message: string; dispatch: DispatchRecord; inquiry: Inquiry }>(
      `/api/inquiries/${inquiryId}/retry/${dispatchId}`,
      { method: 'POST' }
    );
    LocalDatabase.saveInquiry(res.inquiry);
    return res;
  }

  public static async deleteInquiry(id: string): Promise<{ message: string }> {
    LocalDatabase.deleteInquiry(id);
    return ApiClient.request<{ message: string }>(`/api/inquiries/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Ledger ---
  public static async getLedger(): Promise<{ records: LedgerRecord[]; summary: LedgerSummary }> {
    const local = LocalDatabase.getLedger();
    try {
      const res = await ApiClient.request<{ records: LedgerRecord[]; summary: LedgerSummary }>('/api/ledger');
      if (res.records && res.records.length > 0) {
        LocalDatabase.mergeServerData({ ledger: res.records });
        return LocalDatabase.getLedger();
      }
    } catch (err) {
      console.warn('Network fetch ledger failed, serving from local database:', err);
    }
    return local;
  }

  public static async createLedgerRecord(record: {
    clientName: string;
    amountReceived: number;
    date: string;
    note?: string;
    inquiryId?: string | null;
  }): Promise<{ record: LedgerRecord }> {
    const res = await ApiClient.request<{ record: LedgerRecord }>('/api/ledger', {
      method: 'POST',
      body: JSON.stringify(record),
    });
    LocalDatabase.saveLedgerRecord(res.record);
    return res;
  }

  public static async updateLedgerRecord(
    id: string,
    updates: { clientName?: string; amountReceived?: number; date?: string; note?: string; inquiryId?: string | null }
  ): Promise<{ record: LedgerRecord }> {
    const res = await ApiClient.request<{ record: LedgerRecord }>(`/api/ledger/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    LocalDatabase.saveLedgerRecord(res.record);
    return res;
  }

  public static async deleteLedgerRecord(id: string): Promise<{ message: string }> {
    LocalDatabase.deleteLedgerRecord(id);
    return ApiClient.request<{ message: string }>(`/api/ledger/${id}`, {
      method: 'DELETE',
    });
  }

  public static async addDisbursement(
    recordId: string,
    disbursement: { agentName: string; agentId?: string; amount: number; date?: string; note?: string }
  ): Promise<{ record: LedgerRecord }> {
    const localRecord = LocalDatabase.addDisbursement(recordId, disbursement);
    try {
      const res = await ApiClient.request<{ record: LedgerRecord }>(`/api/ledger/${recordId}/sends`, {
        method: 'POST',
        body: JSON.stringify(disbursement),
      });
      LocalDatabase.saveLedgerRecord(res.record);
      return res;
    } catch (err: any) {
      if (err.message && err.message.includes('Ledger record not found')) {
        await ApiClient.syncAllLocalDataToServer();
        try {
          const retryRes = await ApiClient.request<{ record: LedgerRecord }>(`/api/ledger/${recordId}/sends`, {
            method: 'POST',
            body: JSON.stringify(disbursement),
          });
          LocalDatabase.saveLedgerRecord(retryRes.record);
          return retryRes;
        } catch {
          if (localRecord) return { record: localRecord };
        }
      }
      if (localRecord) return { record: localRecord };
      throw err;
    }
  }

  public static async updateDisbursement(
    recordId: string,
    disbursementId: string,
    updates: { agentName?: string; agentId?: string; amount?: number; date?: string; note?: string }
  ): Promise<{ record: LedgerRecord }> {
    const localRecord = LocalDatabase.updateDisbursement(recordId, disbursementId, updates);
    try {
      const res = await ApiClient.request<{ record: LedgerRecord }>(`/api/ledger/${recordId}/sends/${disbursementId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      LocalDatabase.saveLedgerRecord(res.record);
      return res;
    } catch (err: any) {
      if (localRecord) return { record: localRecord };
      throw err;
    }
  }

  public static async removeDisbursement(recordId: string, disbursementId: string): Promise<{ record: LedgerRecord }> {
    const localRecord = LocalDatabase.removeDisbursement(recordId, disbursementId);
    try {
      const res = await ApiClient.request<{ record: LedgerRecord }>(`/api/ledger/${recordId}/sends/${disbursementId}`, {
        method: 'DELETE',
      });
      LocalDatabase.saveLedgerRecord(res.record);
      return res;
    } catch (err: any) {
      if (localRecord) return { record: localRecord };
      throw err;
    }
  }

  // --- Config ---
  public static async getConfig(): Promise<ConfigStatus> {
    return ApiClient.request<ConfigStatus>('/api/config');
  }

  public static async updateConfig(config: { resendApiKey?: string; resendFromEmail?: string }): Promise<ConfigStatus> {
    return ApiClient.request<ConfigStatus>('/api/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // --- Synchronization ---
  public static async syncAllLocalDataToServer(): Promise<void> {
    const data = LocalDatabase.getAllData();
    if (data.inquiries.length > 0 || data.agents.length > 0 || data.ledger.length > 0) {
      try {
        await ApiClient.request('/api/sync', {
          method: 'POST',
          body: JSON.stringify({
            inquiries: data.inquiries,
            agents: data.agents,
            ledger: data.ledger,
          }),
        });
      } catch (err) {
        console.warn('Background sync to server failed:', err);
      }
    }
  }
}
