import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { DatabaseSchema, User, Agent, Inquiry, LedgerRecord, LedgerDisbursement } from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'backend', 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const DB_TMP_FILE = path.join(DATA_DIR, 'database.tmp.json');

const INITIAL_DB: DatabaseSchema = {
  users: [],
  agents: [],
  inquiries: [],
  ledger: [],
  nextInquiryNumber: 1001,
  config: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    resendFromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
  },
};

export class Database {
  private static instance: Database;
  private data: DatabaseSchema;

  private constructor() {
    this.ensureDataDir();
    this.data = this.readFromDisk();
    this.seedOwner();
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private readFromDisk(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          users: parsed.users || [],
          agents: parsed.agents || [],
          inquiries: parsed.inquiries || [],
          ledger: parsed.ledger || [],
          nextInquiryNumber: parsed.nextInquiryNumber || 1001,
          config: parsed.config || {
            resendApiKey: process.env.RESEND_API_KEY || '',
            resendFromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          },
        };
      }
    } catch (err) {
      console.error('Error reading database file, initializing clean DB:', err);
    }
    return JSON.parse(JSON.stringify(INITIAL_DB));
  }

  private persist() {
    try {
      this.ensureDataDir();
      const content = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(DB_TMP_FILE, content, 'utf-8');
      fs.renameSync(DB_TMP_FILE, DB_FILE);
    } catch (err) {
      console.error('Failed to atomically persist database to disk:', err);
      throw new Error('Database persistence failure');
    }
  }

  private seedOwner() {
    const ownerEmail = process.env.OWNER_EMAIL || 'owner@traveldispatcher.local';
    const ownerPassword = process.env.OWNER_PASSWORD || 'OwnerSecure2026!';

    const existing = this.data.users.find((u) => u.email.toLowerCase() === ownerEmail.toLowerCase());
    if (!existing) {
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(ownerPassword, salt);
      const ownerUser: User = {
        id: 'usr_owner_main',
        email: ownerEmail,
        passwordHash,
        createdAt: new Date().toISOString(),
      };
      this.data.users = [ownerUser]; // Single owner only
      this.persist();
      console.log(`[Database] Seeded single owner account: ${ownerEmail}`);
    }
  }

  // --- Users ---
  public getOwnerByEmail(email: string): User | undefined {
    this.data = this.readFromDisk();
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || this.data.users[0];
  }

  public getOwnerById(id: string): User | undefined {
    this.data = this.readFromDisk();
    return this.data.users.find((u) => u.id === id) || this.data.users[0];
  }

  // --- Agents ---
  public getAgents(): Agent[] {
    this.data = this.readFromDisk();
    return [...this.data.agents];
  }

  public getAgentById(id: string): Agent | undefined {
    this.data = this.readFromDisk();
    return this.data.agents.find((a) => a.id === id);
  }

  public createAgent(agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>): Agent {
    const now = new Date().toISOString();
    const newAgent: Agent = {
      ...agentData,
      id: 'agent_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: now,
      updatedAt: now,
    };
    this.data.agents.push(newAgent);
    this.persist();
    return newAgent;
  }

  public updateAgent(id: string, updates: Partial<Omit<Agent, 'id' | 'createdAt'>>): Agent {
    const idx = this.data.agents.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error('Agent not found');
    }
    const updated: Agent = {
      ...this.data.agents[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.data.agents[idx] = updated;
    this.persist();
    return updated;
  }

  public deleteAgent(id: string): boolean {
    const prevCount = this.data.agents.length;
    this.data.agents = this.data.agents.filter((a) => a.id !== id);
    if (this.data.agents.length !== prevCount) {
      this.persist();
      return true;
    }
    return false;
  }

  // --- Inquiries ---
  public getInquiries(): Inquiry[] {
    this.data = this.readFromDisk();
    // Return sorted newest first
    return [...this.data.inquiries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getInquiryById(id: string): Inquiry | undefined {
    this.data = this.readFromDisk();
    return this.data.inquiries.find((i) => i.id === id);
  }

  public getNextInquiryNumber(): number {
    const num = this.data.nextInquiryNumber;
    this.data.nextInquiryNumber += 1;
    this.persist();
    return num;
  }

  public createInquiry(inquiryData: Omit<Inquiry, 'id' | 'inquiryNumber' | 'createdAt' | 'updatedAt'>): Inquiry {
    const now = new Date().toISOString();
    const inquiryNumber = this.getNextInquiryNumber();
    const newInquiry: Inquiry = {
      ...inquiryData,
      id: 'inq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      inquiryNumber,
      createdAt: now,
      updatedAt: now,
    };
    this.data.inquiries.push(newInquiry);
    this.persist();
    return newInquiry;
  }

  public updateInquiryStatus(id: string, status: Inquiry['status']): Inquiry {
    const inquiry = this.data.inquiries.find((i) => i.id === id);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }
    inquiry.status = status;
    inquiry.updatedAt = new Date().toISOString();
    this.persist();
    return inquiry;
  }

  public updateDispatchRecord(inquiryId: string, dispatchId: string, updates: Partial<Inquiry['dispatches'][0]>): Inquiry {
    const inquiry = this.data.inquiries.find((i) => i.id === inquiryId);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }
    const dispatch = inquiry.dispatches.find((d) => d.id === dispatchId);
    if (!dispatch) {
      throw new Error('Dispatch record not found');
    }
    Object.assign(dispatch, updates);
    inquiry.updatedAt = new Date().toISOString();
    this.persist();
    return inquiry;
  }

  public deleteInquiry(id: string): boolean {
    const idx = this.data.inquiries.findIndex((i) => i.id === id);
    if (idx === -1) {
      return false;
    }
    // Remove the inquiry (cascade deletes stops and dispatches since they are embedded)
    this.data.inquiries.splice(idx, 1);

    // Unlink any ledger records linked to this inquiry
    for (const record of this.data.ledger) {
      if (record.inquiryId === id) {
        record.inquiryId = null;
        record.updatedAt = new Date().toISOString();
      }
    }

    this.persist();
    return true;
  }

  // --- Ledger (Khatabook Middleman Records) ---
  public getLedgerRecords(): LedgerRecord[] {
    this.data = this.readFromDisk();
    return [...this.data.ledger].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  public getLedgerRecordById(id: string): LedgerRecord | undefined {
    this.data = this.readFromDisk();
    return this.data.ledger.find((r) => r.id === id);
  }

  public createLedgerRecord(data: {
    clientName: string;
    amountReceived: number;
    date: string;
    note?: string;
    inquiryId?: string | null;
  }): LedgerRecord {
    if (data.amountReceived <= 0) {
      throw new Error('Amount received must be greater than zero');
    }
    const now = new Date().toISOString();
    const newRecord: LedgerRecord = {
      id: 'ledg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      clientName: data.clientName.trim(),
      amountReceived: data.amountReceived,
      date: data.date,
      note: data.note?.trim() || '',
      inquiryId: data.inquiryId || null,
      disbursements: [],
      createdAt: now,
      updatedAt: now,
    };
    this.data.ledger.push(newRecord);
    this.persist();
    return newRecord;
  }

  public updateLedgerRecord(
    id: string,
    updates: { clientName?: string; amountReceived?: number; date?: string; note?: string; inquiryId?: string | null }
  ): LedgerRecord {
    const record = this.data.ledger.find((r) => r.id === id);
    if (!record) {
      throw new Error('Ledger record not found');
    }

    if (updates.amountReceived !== undefined) {
      if (updates.amountReceived <= 0) {
        throw new Error('Amount received must be greater than zero');
      }
      const totalSent = record.disbursements.reduce((sum, d) => sum + d.amount, 0);
      if (updates.amountReceived < totalSent) {
        throw new Error(`Cannot reduce received amount to Rs. ${updates.amountReceived} because Rs. ${totalSent} has already been disbursed to agents.`);
      }
      record.amountReceived = updates.amountReceived;
    }

    if (updates.clientName !== undefined) record.clientName = updates.clientName.trim();
    if (updates.date !== undefined) record.date = updates.date;
    if (updates.note !== undefined) record.note = updates.note.trim();
    if (updates.inquiryId !== undefined) record.inquiryId = updates.inquiryId;

    record.updatedAt = new Date().toISOString();
    this.persist();
    return record;
  }

  public deleteLedgerRecord(id: string): boolean {
    const idx = this.data.ledger.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.data.ledger.splice(idx, 1);
    this.persist();
    return true;
  }

  // --- Ledger Disbursements (+ Send inside existing record) ---
  public addDisbursement(
    recordId: string,
    disbursement: { agentName: string; agentId?: string; amount: number; date?: string; note?: string }
  ): LedgerRecord {
    const record = this.data.ledger.find((r) => r.id === recordId);
    if (!record) {
      throw new Error('Ledger record not found');
    }
    if (disbursement.amount <= 0) {
      throw new Error('Sent amount must be greater than zero');
    }

    const currentTotalSent = record.disbursements.reduce((sum, d) => sum + d.amount, 0);
    const newTotalSent = currentTotalSent + disbursement.amount;

    // ATOMIC OVER-SEND PROTECTION RULE:
    if (newTotalSent > record.amountReceived) {
      const balanceAvailable = record.amountReceived - currentTotalSent;
      throw new Error(
        `Over-send rejected: Available balance held for ${record.clientName} is Rs. ${balanceAvailable}, but tried to disburse Rs. ${disbursement.amount}.`
      );
    }

    const now = new Date().toISOString();
    const newDisbursement: LedgerDisbursement = {
      id: 'disb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      agentName: disbursement.agentName.trim(),
      agentId: disbursement.agentId,
      amount: disbursement.amount,
      date: disbursement.date || now.split('T')[0],
      note: disbursement.note?.trim() || '',
      createdAt: now,
    };

    record.disbursements.push(newDisbursement);
    record.updatedAt = now;
    this.persist();
    return record;
  }

  public updateDisbursement(
    recordId: string,
    disbursementId: string,
    updates: { agentName?: string; agentId?: string; amount?: number; date?: string; note?: string }
  ): LedgerRecord {
    const record = this.data.ledger.find((r) => r.id === recordId);
    if (!record) {
      throw new Error('Ledger record not found');
    }
    const disbursement = record.disbursements.find((d) => d.id === disbursementId);
    if (!disbursement) {
      throw new Error('Disbursement not found');
    }

    if (updates.amount !== undefined) {
      if (updates.amount <= 0) {
        throw new Error('Sent amount must be greater than zero');
      }
      const otherSent = record.disbursements
        .filter((d) => d.id !== disbursementId)
        .reduce((sum, d) => sum + d.amount, 0);
      const newTotalSent = otherSent + updates.amount;

      if (newTotalSent > record.amountReceived) {
        const balanceAvailable = record.amountReceived - otherSent;
        throw new Error(
          `Over-send rejected: Maximum allowable amount for this disbursement is Rs. ${balanceAvailable}, but tried to set Rs. ${updates.amount}.`
        );
      }
      disbursement.amount = updates.amount;
    }

    if (updates.agentName !== undefined) disbursement.agentName = updates.agentName.trim();
    if (updates.agentId !== undefined) disbursement.agentId = updates.agentId;
    if (updates.date !== undefined) disbursement.date = updates.date;
    if (updates.note !== undefined) disbursement.note = updates.note.trim();

    record.updatedAt = new Date().toISOString();
    this.persist();
    return record;
  }

  public removeDisbursement(recordId: string, disbursementId: string): LedgerRecord {
    const record = this.data.ledger.find((r) => r.id === recordId);
    if (!record) {
      throw new Error('Ledger record not found');
    }
    const prevCount = record.disbursements.length;
    record.disbursements = record.disbursements.filter((d) => d.id !== disbursementId);
    if (record.disbursements.length !== prevCount) {
      record.updatedAt = new Date().toISOString();
      this.persist();
    }
    return record;
  }

  // --- Configuration / Resend Key ---
  public getConfig() {
    return {
      hasResendApiKey: Boolean(this.data.config.resendApiKey || process.env.RESEND_API_KEY),
      resendFromEmail: this.data.config.resendFromEmail || process.env.RESEND_FROM_EMAIL || 'inquiries@traveldispatcher.local',
    };
  }

  public getRawResendApiKey(): string {
    return this.data.config.resendApiKey || process.env.RESEND_API_KEY || '';
  }

  public getRawResendFromEmail(): string {
    return this.data.config.resendFromEmail || process.env.RESEND_FROM_EMAIL || 'inquiries@traveldispatcher.local';
  }

  public updateConfig(config: { resendApiKey?: string; resendFromEmail?: string }) {
    if (config.resendApiKey !== undefined) {
      this.data.config.resendApiKey = config.resendApiKey.trim();
    }
    if (config.resendFromEmail !== undefined) {
      this.data.config.resendFromEmail = config.resendFromEmail.trim();
    }
    this.persist();
  }
}
