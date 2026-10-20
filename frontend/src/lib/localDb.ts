import { Agent, Inquiry, InquiryStatus, LedgerRecord, LedgerSummary } from '../types/index.ts';

const LOCAL_DB_KEY = 'travel_dispatcher_persistent_v1';

export interface LocalDbData {
  agents: Agent[];
  inquiries: Inquiry[];
  ledger: LedgerRecord[];
  lastUpdated: string;
}

const DEFAULT_DATA: LocalDbData = {
  agents: [],
  inquiries: [],
  ledger: [],
  lastUpdated: new Date().toISOString(),
};

export class LocalDatabase {
  private static getStore(): LocalDbData {
    try {
      const raw = localStorage.getItem(LOCAL_DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          agents: parsed.agents || [],
          inquiries: parsed.inquiries || [],
          ledger: parsed.ledger || [],
          lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        };
      }
    } catch (e) {
      console.error('Error reading from local storage database:', e);
    }
    return { ...DEFAULT_DATA };
  }

  private static saveStore(data: LocalDbData) {
    try {
      data.lastUpdated = new Date().toISOString();
      localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving to local storage database:', e);
    }
  }

  // --- Inquiries ---
  public static getInquiries(): Inquiry[] {
    const store = LocalDatabase.getStore();
    return store.inquiries.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public static saveInquiry(inquiry: Inquiry): Inquiry {
    const store = LocalDatabase.getStore();
    const idx = store.inquiries.findIndex((i) => i.id === inquiry.id);
    if (idx >= 0) {
      store.inquiries[idx] = inquiry;
    } else {
      store.inquiries.unshift(inquiry);
    }
    LocalDatabase.saveStore(store);
    return inquiry;
  }

  public static updateInquiryStatus(id: string, status: InquiryStatus): Inquiry | null {
    const store = LocalDatabase.getStore();
    const inquiry = store.inquiries.find((i) => i.id === id);
    if (inquiry) {
      inquiry.status = status;
      inquiry.updatedAt = new Date().toISOString();
      LocalDatabase.saveStore(store);
      return inquiry;
    }
    return null;
  }

  public static deleteInquiry(id: string): boolean {
    const store = LocalDatabase.getStore();
    const initialLen = store.inquiries.length;
    store.inquiries = store.inquiries.filter((i) => i.id !== id);
    // Unlink any ledger records
    for (const record of store.ledger) {
      if (record.inquiryId === id) {
        record.inquiryId = null;
      }
    }
    LocalDatabase.saveStore(store);
    return store.inquiries.length !== initialLen;
  }

  // --- Agents ---
  public static getAgents(): Agent[] {
    const store = LocalDatabase.getStore();
    return store.agents;
  }

  public static saveAgent(agent: Agent): Agent {
    const store = LocalDatabase.getStore();
    const idx = store.agents.findIndex((a) => a.id === agent.id);
    if (idx >= 0) {
      store.agents[idx] = agent;
    } else {
      store.agents.push(agent);
    }
    LocalDatabase.saveStore(store);
    return agent;
  }

  public static deleteAgent(id: string): boolean {
    const store = LocalDatabase.getStore();
    const initialLen = store.agents.length;
    store.agents = store.agents.filter((a) => a.id !== id);
    LocalDatabase.saveStore(store);
    return store.agents.length !== initialLen;
  }

  // --- Ledger ---
  public static getLedger(): { records: LedgerRecord[]; summary: LedgerSummary } {
    const store = LocalDatabase.getStore();
    let totalReceived = 0;
    let totalSent = 0;

    const records = store.ledger.map((rec) => {
      const sumSent = (rec.disbursements || []).reduce((sum, d) => sum + d.amount, 0);
      const balanceHeld = rec.amountReceived - sumSent;
      totalReceived += rec.amountReceived;
      totalSent += sumSent;

      return {
        ...rec,
        totalSent: sumSent,
        balanceHeld,
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      records,
      summary: {
        totalReceived,
        totalSent,
        balanceWithMe: totalReceived - totalSent,
      },
    };
  }

  public static saveLedgerRecord(record: LedgerRecord): LedgerRecord {
    const store = LocalDatabase.getStore();
    const idx = store.ledger.findIndex((r) => r.id === record.id);
    if (idx >= 0) {
      store.ledger[idx] = record;
    } else {
      store.ledger.unshift(record);
    }
    LocalDatabase.saveStore(store);
    return record;
  }

  public static deleteLedgerRecord(id: string): boolean {
    const store = LocalDatabase.getStore();
    const initialLen = store.ledger.length;
    store.ledger = store.ledger.filter((r) => r.id !== id);
    LocalDatabase.saveStore(store);
    return store.ledger.length !== initialLen;
  }

  public static mergeServerData(server: { agents?: Agent[]; inquiries?: Inquiry[]; ledger?: LedgerRecord[] }) {
    const store = LocalDatabase.getStore();

    if (server.agents && server.agents.length > 0) {
      const agentMap = new Map<string, Agent>();
      store.agents.forEach((a) => agentMap.set(a.id, a));
      server.agents.forEach((a) => agentMap.set(a.id, a));
      store.agents = Array.from(agentMap.values());
    }

    if (server.inquiries && server.inquiries.length > 0) {
      const inquiryMap = new Map<string, Inquiry>();
      store.inquiries.forEach((i) => inquiryMap.set(i.id, i));
      server.inquiries.forEach((i) => inquiryMap.set(i.id, i));
      store.inquiries = Array.from(inquiryMap.values());
    }

    if (server.ledger && server.ledger.length > 0) {
      const ledgerMap = new Map<string, LedgerRecord>();
      store.ledger.forEach((r) => ledgerMap.set(r.id, r));
      server.ledger.forEach((r) => ledgerMap.set(r.id, r));
      store.ledger = Array.from(ledgerMap.values());
    }

    LocalDatabase.saveStore(store);
    return store;
  }

  public static getAllData(): LocalDbData {
    return LocalDatabase.getStore();
  }

  public static restoreData(data: LocalDbData) {
    LocalDatabase.saveStore(data);
  }
}
