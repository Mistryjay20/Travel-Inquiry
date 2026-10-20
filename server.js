// server.ts
import dotenv from "dotenv";
import path2 from "path";
import { fileURLToPath } from "url";
import express2 from "express";
import { createServer as createViteServer } from "vite";

// backend/src/app.ts
import express from "express";
import cors from "cors";

// backend/src/routes/auth.ts
import { Router } from "express";
import bcrypt2 from "bcryptjs";

// backend/src/db.ts
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
var DATA_DIR = path.resolve(process.cwd(), "backend", "data");
var DB_FILE = path.join(DATA_DIR, "database.json");
var DB_TMP_FILE = path.join(DATA_DIR, "database.tmp.json");
var INITIAL_DB = {
  users: [],
  agents: [],
  inquiries: [],
  ledger: [],
  nextInquiryNumber: 1001,
  config: {
    resendApiKey: process.env.RESEND_API_KEY || "",
    resendFromEmail: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
  }
};
var Database = class _Database {
  constructor() {
    this.ensureDataDir();
    this.data = this.readFromDisk();
    this.seedOwner();
  }
  static getInstance() {
    if (!_Database.instance) {
      _Database.instance = new _Database();
    }
    return _Database.instance;
  }
  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }
  readFromDisk() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return {
          users: parsed.users || [],
          agents: parsed.agents || [],
          inquiries: parsed.inquiries || [],
          ledger: parsed.ledger || [],
          nextInquiryNumber: parsed.nextInquiryNumber || 1001,
          config: parsed.config || {
            resendApiKey: process.env.RESEND_API_KEY || "",
            resendFromEmail: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
          }
        };
      }
    } catch (err) {
      console.error("Error reading database file, initializing clean DB:", err);
    }
    return JSON.parse(JSON.stringify(INITIAL_DB));
  }
  persist() {
    try {
      this.ensureDataDir();
      const content = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(DB_TMP_FILE, content, "utf-8");
      fs.renameSync(DB_TMP_FILE, DB_FILE);
    } catch (err) {
      console.error("Failed to atomically persist database to disk:", err);
      throw new Error("Database persistence failure");
    }
  }
  seedOwner() {
    const ownerEmail = process.env.OWNER_EMAIL || "owner@traveldispatcher.local";
    const ownerPassword = process.env.OWNER_PASSWORD || "OwnerSecure2026!";
    const existing = this.data.users.find((u) => u.email.toLowerCase() === ownerEmail.toLowerCase());
    if (!existing) {
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(ownerPassword, salt);
      const ownerUser = {
        id: "usr_owner_" + Date.now(),
        email: ownerEmail,
        passwordHash,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.data.users = [ownerUser];
      this.persist();
      console.log(`[Database] Seeded single owner account: ${ownerEmail}`);
    }
  }
  // --- Users ---
  getOwnerByEmail(email) {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }
  getOwnerById(id) {
    return this.data.users.find((u) => u.id === id);
  }
  // --- Agents ---
  getAgents() {
    this.data = this.readFromDisk();
    return [...this.data.agents];
  }
  getAgentById(id) {
    this.data = this.readFromDisk();
    return this.data.agents.find((a) => a.id === id);
  }
  createAgent(agentData) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newAgent = {
      ...agentData,
      id: "agent_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      createdAt: now,
      updatedAt: now
    };
    this.data.agents.push(newAgent);
    this.persist();
    return newAgent;
  }
  updateAgent(id, updates) {
    const idx = this.data.agents.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error("Agent not found");
    }
    const updated = {
      ...this.data.agents[idx],
      ...updates,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.agents[idx] = updated;
    this.persist();
    return updated;
  }
  deleteAgent(id) {
    const prevCount = this.data.agents.length;
    this.data.agents = this.data.agents.filter((a) => a.id !== id);
    if (this.data.agents.length !== prevCount) {
      this.persist();
      return true;
    }
    return false;
  }
  // --- Inquiries ---
  getInquiries() {
    this.data = this.readFromDisk();
    return [...this.data.inquiries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  getInquiryById(id) {
    this.data = this.readFromDisk();
    return this.data.inquiries.find((i) => i.id === id);
  }
  getNextInquiryNumber() {
    const num = this.data.nextInquiryNumber;
    this.data.nextInquiryNumber += 1;
    this.persist();
    return num;
  }
  createInquiry(inquiryData) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const inquiryNumber = this.getNextInquiryNumber();
    const newInquiry = {
      ...inquiryData,
      id: "inq_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      inquiryNumber,
      createdAt: now,
      updatedAt: now
    };
    this.data.inquiries.push(newInquiry);
    this.persist();
    return newInquiry;
  }
  updateInquiryStatus(id, status) {
    const inquiry = this.data.inquiries.find((i) => i.id === id);
    if (!inquiry) {
      throw new Error("Inquiry not found");
    }
    inquiry.status = status;
    inquiry.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.persist();
    return inquiry;
  }
  updateDispatchRecord(inquiryId, dispatchId, updates) {
    const inquiry = this.data.inquiries.find((i) => i.id === inquiryId);
    if (!inquiry) {
      throw new Error("Inquiry not found");
    }
    const dispatch = inquiry.dispatches.find((d) => d.id === dispatchId);
    if (!dispatch) {
      throw new Error("Dispatch record not found");
    }
    Object.assign(dispatch, updates);
    inquiry.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.persist();
    return inquiry;
  }
  deleteInquiry(id) {
    const idx = this.data.inquiries.findIndex((i) => i.id === id);
    if (idx === -1) {
      return false;
    }
    this.data.inquiries.splice(idx, 1);
    for (const record of this.data.ledger) {
      if (record.inquiryId === id) {
        record.inquiryId = null;
        record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      }
    }
    this.persist();
    return true;
  }
  // --- Ledger (Khatabook Middleman Records) ---
  getLedgerRecords() {
    this.data = this.readFromDisk();
    return [...this.data.ledger].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }
  getLedgerRecordById(id) {
    this.data = this.readFromDisk();
    return this.data.ledger.find((r) => r.id === id);
  }
  createLedgerRecord(data) {
    if (data.amountReceived <= 0) {
      throw new Error("Amount received must be greater than zero");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newRecord = {
      id: "ledg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      clientName: data.clientName.trim(),
      amountReceived: data.amountReceived,
      date: data.date,
      note: data.note?.trim() || "",
      inquiryId: data.inquiryId || null,
      disbursements: [],
      createdAt: now,
      updatedAt: now
    };
    this.data.ledger.push(newRecord);
    this.persist();
    return newRecord;
  }
  updateLedgerRecord(id, updates) {
    const record = this.data.ledger.find((r) => r.id === id);
    if (!record) {
      throw new Error("Ledger record not found");
    }
    if (updates.amountReceived !== void 0) {
      if (updates.amountReceived <= 0) {
        throw new Error("Amount received must be greater than zero");
      }
      const totalSent = record.disbursements.reduce((sum, d) => sum + d.amount, 0);
      if (updates.amountReceived < totalSent) {
        throw new Error(`Cannot reduce received amount to Rs. ${updates.amountReceived} because Rs. ${totalSent} has already been disbursed to agents.`);
      }
      record.amountReceived = updates.amountReceived;
    }
    if (updates.clientName !== void 0) record.clientName = updates.clientName.trim();
    if (updates.date !== void 0) record.date = updates.date;
    if (updates.note !== void 0) record.note = updates.note.trim();
    if (updates.inquiryId !== void 0) record.inquiryId = updates.inquiryId;
    record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.persist();
    return record;
  }
  deleteLedgerRecord(id) {
    const idx = this.data.ledger.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.data.ledger.splice(idx, 1);
    this.persist();
    return true;
  }
  // --- Ledger Disbursements (+ Send inside existing record) ---
  addDisbursement(recordId, disbursement) {
    const record = this.data.ledger.find((r) => r.id === recordId);
    if (!record) {
      throw new Error("Ledger record not found");
    }
    if (disbursement.amount <= 0) {
      throw new Error("Sent amount must be greater than zero");
    }
    const currentTotalSent = record.disbursements.reduce((sum, d) => sum + d.amount, 0);
    const newTotalSent = currentTotalSent + disbursement.amount;
    if (newTotalSent > record.amountReceived) {
      const balanceAvailable = record.amountReceived - currentTotalSent;
      throw new Error(
        `Over-send rejected: Available balance held for ${record.clientName} is Rs. ${balanceAvailable}, but tried to disburse Rs. ${disbursement.amount}.`
      );
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newDisbursement = {
      id: "disb_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      agentName: disbursement.agentName.trim(),
      agentId: disbursement.agentId,
      amount: disbursement.amount,
      date: disbursement.date || now.split("T")[0],
      note: disbursement.note?.trim() || "",
      createdAt: now
    };
    record.disbursements.push(newDisbursement);
    record.updatedAt = now;
    this.persist();
    return record;
  }
  updateDisbursement(recordId, disbursementId, updates) {
    const record = this.data.ledger.find((r) => r.id === recordId);
    if (!record) {
      throw new Error("Ledger record not found");
    }
    const disbursement = record.disbursements.find((d) => d.id === disbursementId);
    if (!disbursement) {
      throw new Error("Disbursement not found");
    }
    if (updates.amount !== void 0) {
      if (updates.amount <= 0) {
        throw new Error("Sent amount must be greater than zero");
      }
      const otherSent = record.disbursements.filter((d) => d.id !== disbursementId).reduce((sum, d) => sum + d.amount, 0);
      const newTotalSent = otherSent + updates.amount;
      if (newTotalSent > record.amountReceived) {
        const balanceAvailable = record.amountReceived - otherSent;
        throw new Error(
          `Over-send rejected: Maximum allowable amount for this disbursement is Rs. ${balanceAvailable}, but tried to set Rs. ${updates.amount}.`
        );
      }
      disbursement.amount = updates.amount;
    }
    if (updates.agentName !== void 0) disbursement.agentName = updates.agentName.trim();
    if (updates.agentId !== void 0) disbursement.agentId = updates.agentId;
    if (updates.date !== void 0) disbursement.date = updates.date;
    if (updates.note !== void 0) disbursement.note = updates.note.trim();
    record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.persist();
    return record;
  }
  removeDisbursement(recordId, disbursementId) {
    const record = this.data.ledger.find((r) => r.id === recordId);
    if (!record) {
      throw new Error("Ledger record not found");
    }
    const prevCount = record.disbursements.length;
    record.disbursements = record.disbursements.filter((d) => d.id !== disbursementId);
    if (record.disbursements.length !== prevCount) {
      record.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.persist();
    }
    return record;
  }
  // --- Configuration / Resend Key ---
  getConfig() {
    return {
      hasResendApiKey: Boolean(this.data.config.resendApiKey || process.env.RESEND_API_KEY),
      resendFromEmail: this.data.config.resendFromEmail || process.env.RESEND_FROM_EMAIL || "inquiries@traveldispatcher.local"
    };
  }
  getRawResendApiKey() {
    return this.data.config.resendApiKey || process.env.RESEND_API_KEY || "";
  }
  getRawResendFromEmail() {
    return this.data.config.resendFromEmail || process.env.RESEND_FROM_EMAIL || "inquiries@traveldispatcher.local";
  }
  updateConfig(config) {
    if (config.resendApiKey !== void 0) {
      this.data.config.resendApiKey = config.resendApiKey.trim();
    }
    if (config.resendFromEmail !== void 0) {
      this.data.config.resendFromEmail = config.resendFromEmail.trim();
    }
    this.persist();
  }
};

// backend/src/validation.ts
import { z } from "zod";
var phoneRegex = /^[+]?[\d\s\-()]{7,20}$/;
var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
var loginSchema = z.object({
  email: z.string().email("Valid email address required"),
  password: z.string().min(1, "Password is required")
});
var agentSchema = z.object({
  name: z.string().trim().min(2, "Agent name must be at least 2 characters"),
  phone: z.string().trim().regex(phoneRegex, "Invalid phone number format (min 7 digits)"),
  email: z.string().trim().email("Valid email address required"),
  active: z.boolean().default(true)
});
var agentUpdateSchema = agentSchema.partial();
var inquiryStopSchema = z.object({
  place: z.string().trim().min(1, "Place name is required"),
  nights: z.coerce.number().int().min(1, "Nights must be at least 1")
});
var inquiryCreateSchema = z.object({
  type: z.enum(["package", "ticket"]),
  tripType: z.enum(["single", "return"]).optional(),
  clientName: z.string().trim().min(2, "Client name must be at least 2 characters"),
  clientPhone: z.string().trim().regex(phoneRegex, "Client phone must be at least 7 digits"),
  destination: z.string().trim().min(2, "Destination must be at least 2 characters"),
  pickup: z.string().trim().min(2, "Pickup point is required"),
  drop: z.string().trim().min(2, "Drop point is required"),
  dateMode: z.enum(["fixed", "anytime"]),
  startDate: z.string().regex(dateRegex, "Start date must be in YYYY-MM-DD format"),
  endDate: z.string().regex(dateRegex, "End date must be in YYYY-MM-DD format"),
  returnDate: z.string().regex(dateRegex, "Return date must be in YYYY-MM-DD format").optional().or(z.literal("")),
  adults: z.coerce.number().int().min(1, "At least 1 adult passenger required"),
  children: z.coerce.number().int().min(0).default(0),
  travelClass: z.enum(["Economy", "Premium Economy", "Business"]).optional().or(z.literal("")),
  airlinePref: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  stops: z.array(inquiryStopSchema).optional().default([]),
  agentIds: z.array(z.string()).min(1, "Please select at least one agent to dispatch")
});
var inquiryStatusSchema = z.object({
  status: z.enum(["inquiry", "confirmed", "cancelled"])
});
var ledgerCreateSchema = z.object({
  clientName: z.string().trim().min(2, "Client name must be at least 2 characters"),
  amountReceived: z.coerce.number().positive("Amount received must be greater than zero"),
  date: z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format"),
  note: z.string().optional().default(""),
  inquiryId: z.string().optional().nullable()
});
var ledgerUpdateSchema = z.object({
  clientName: z.string().trim().min(2).optional(),
  amountReceived: z.coerce.number().positive().optional(),
  date: z.string().regex(dateRegex).optional(),
  note: z.string().optional(),
  inquiryId: z.string().optional().nullable()
});
var disbursementCreateSchema = z.object({
  agentName: z.string().trim().min(2, "Agent name is required"),
  agentId: z.string().optional(),
  amount: z.coerce.number().positive("Sent amount must be greater than zero"),
  date: z.string().regex(dateRegex).optional(),
  note: z.string().optional().default("")
});
var disbursementUpdateSchema = z.object({
  agentName: z.string().trim().min(2).optional(),
  agentId: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
  date: z.string().regex(dateRegex).optional(),
  note: z.string().optional()
});
var configUpdateSchema = z.object({
  resendApiKey: z.string().optional(),
  resendFromEmail: z.string().email().optional()
});

// backend/src/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "travel-inquiry-jwt-secret-key-production-safety";
function generateToken(userId, email) {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "7d" });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
function requireAuth(req, res, next) {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else if (req.headers["x-auth-token"]) {
    token = String(req.headers["x-auth-token"]);
  }
  if (!token) {
    return res.status(401).json({ error: "Authentication required. Please log in." });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Session expired or invalid token. Please log in again." });
  }
  const db = Database.getInstance();
  const user = db.getOwnerById(payload.userId);
  if (!user) {
    return res.status(401).json({ error: "Owner account not found." });
  }
  req.userId = user.id;
  req.userEmail = user.email;
  next();
}
var rateLimitStore = {};
function createRateLimiter(options) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown-ip";
    const key = `${req.baseUrl || ""}${req.path}:${ip}`;
    const now = Date.now();
    const record = rateLimitStore[key];
    if (!record || now > record.resetAt) {
      rateLimitStore[key] = {
        count: 1,
        resetAt: now + options.windowMs
      };
      return next();
    }
    if (record.count >= options.maxRequests) {
      const waitSeconds = Math.ceil((record.resetAt - now) / 1e3);
      return res.status(429).json({
        error: `${options.message} Please wait ${waitSeconds}s before trying again.`
      });
    }
    record.count += 1;
    next();
  };
}

// backend/src/routes/auth.ts
var authRouter = Router();
var loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1e3,
  maxRequests: 10,
  message: "Too many login attempts."
});
authRouter.post("/login", loginLimiter, (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(", ")
    });
  }
  const { email, password } = result.data;
  const db = Database.getInstance();
  const owner = db.getOwnerByEmail(email);
  if (!owner) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  const isValid = bcrypt2.compareSync(password, owner.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  const token = generateToken(owner.id, owner.email);
  return res.json({
    token,
    user: {
      id: owner.id,
      email: owner.email
    }
  });
});
authRouter.get("/me", requireAuth, (req, res) => {
  return res.json({
    user: {
      id: req.userId,
      email: req.userEmail
    }
  });
});
authRouter.post("/logout", requireAuth, (_req, res) => {
  return res.json({ message: "Successfully logged out." });
});

// backend/src/routes/agents.ts
import { Router as Router2 } from "express";
var agentsRouter = Router2();
agentsRouter.use(requireAuth);
agentsRouter.get("/", (_req, res) => {
  const db = Database.getInstance();
  const agents = db.getAgents();
  return res.json({ agents });
});
agentsRouter.post("/", (req, res) => {
  const result = agentSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(", ")
    });
  }
  const db = Database.getInstance();
  const created = db.createAgent(result.data);
  return res.status(201).json({ agent: created });
});
agentsRouter.put("/:id", (req, res) => {
  const result = agentUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(", ")
    });
  }
  const db = Database.getInstance();
  try {
    const updated = db.updateAgent(req.params.id, result.data);
    return res.json({ agent: updated });
  } catch (err) {
    return res.status(404).json({ error: err.message || "Agent not found" });
  }
});
agentsRouter.delete("/:id", (req, res) => {
  const db = Database.getInstance();
  const deleted = db.deleteAgent(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Agent not found" });
  }
  return res.json({ message: "Agent deleted successfully" });
});

// backend/src/routes/inquiries.ts
import { Router as Router3 } from "express";

// backend/src/services/email.ts
import { Resend } from "resend";
function escapeHtml(text) {
  if (text === void 0 || text === null) return "";
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function getResendClient() {
  const db = Database.getInstance();
  const apiKey = db.getRawResendApiKey() || process.env.RESEND_API_KEY || "";
  let fromEmail = db.getRawResendFromEmail() || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  if (!fromEmail || fromEmail.includes(".local") || fromEmail.includes("example.com")) {
    fromEmail = "onboarding@resend.dev";
  }
  if (!apiKey || apiKey.trim() === "") {
    return { client: null, fromEmail };
  }
  return { client: new Resend(apiKey.trim()), fromEmail: fromEmail.trim() };
}
function buildAgentEmail(payload) {
  const typeLabel = payload.type === "package" ? "Package" : "Ticket";
  const tripTypeLabel = payload.tripType === "single" ? " (One-Way)" : payload.tripType === "return" ? " (Round-Trip)" : "";
  const subject = `New ${typeLabel}${tripTypeLabel} Inquiry #${payload.inquiryNumber} - ${payload.destination}`;
  let dateDisplay = "";
  if (payload.dateMode === "fixed") {
    dateDisplay = `${escapeHtml(payload.startDate)} to ${escapeHtml(payload.endDate)}`;
  } else {
    dateDisplay = `Anytime between ${escapeHtml(payload.startDate)} and ${escapeHtml(payload.endDate)}`;
  }
  let stopsHtml = "";
  if (payload.type === "package" && payload.stops && payload.stops.length > 0) {
    const stopsList = payload.stops.map(
      (s, idx) => `<tr><td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">Stop ${idx + 1}: <strong>${escapeHtml(
        s.place
      )}</strong></td><td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #1e293b;">${escapeHtml(
        s.nights
      )} night${s.nights > 1 ? "s" : ""}</td></tr>`
    ).join("");
    stopsHtml = `
      <div style="margin: 16px 0;">
        <div style="font-size: 13px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 8px;">Itinerary &amp; Night Stays</div>
        <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; font-size: 14px;">
          ${stopsList}
        </table>
      </div>
    `;
  }
  let ticketDetailsHtml = "";
  if (payload.type === "ticket") {
    const flightClass = payload.travelClass || "Standard Economy";
    const airline = payload.airlinePref ? escapeHtml(payload.airlinePref) : "Any / Best Fare";
    const returnInfo = payload.tripType === "return" && payload.returnDate ? `<tr><td style="padding: 8px 12px; font-weight: 600; color: #475569; width: 140px;">Return Date:</td><td style="padding: 8px 12px; color: #0f172a;">${escapeHtml(
      payload.returnDate
    )}</td></tr>` : "";
    ticketDetailsHtml = `
      <tr><td style="padding: 8px 12px; font-weight: 600; color: #475569; width: 140px;">Class:</td><td style="padding: 8px 12px; color: #0f172a;">${escapeHtml(
      flightClass
    )}</td></tr>
      <tr><td style="padding: 8px 12px; font-weight: 600; color: #475569; width: 140px;">Preferred Airline:</td><td style="padding: 8px 12px; color: #0f172a;">${airline}</td></tr>
      ${returnInfo}
    `;
  }
  let notesHtml = "";
  if (payload.notes && payload.notes.trim()) {
    notesHtml = `
      <div style="margin-top: 16px; padding: 12px 16px; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; font-size: 13px; color: #92400e;">
        <strong>Special Notes / Requirements:</strong><br/>
        <div style="margin-top: 4px; white-space: pre-wrap;">${escapeHtml(payload.notes.trim())}</div>
      </div>
    `;
  }
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header banner -->
    <div style="background: #0f172a; color: #ffffff; padding: 20px 24px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 600;">Travel Quote Request \xB7 #${escapeHtml(
    payload.inquiryNumber
  )}</div>
      <h1 style="margin: 4px 0 0 0; font-size: 20px; font-weight: 700; color: #ffffff;">${escapeHtml(
    payload.destination
  )}</h1>
    </div>

    <!-- Body content -->
    <div style="padding: 24px;">
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 16px 0;">
        Dear <strong>${escapeHtml(payload.agentName)}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
        We have a new quote request for client <strong>${escapeHtml(
    payload.clientName
  )}</strong>. Please review the trip specifications below and reply with your best quote and itinerary breakdown.
      </p>

      <!-- Specifications Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 6px;">
        <tbody>
          <tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: 600; color: #475569; width: 140px;">Type:</td>
            <td style="padding: 8px 12px; color: #0f172a; font-weight: 600;">${escapeHtml(typeLabel)}${tripTypeLabel}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: 600; color: #475569;">Destination:</td>
            <td style="padding: 8px 12px; color: #0f172a;">${escapeHtml(payload.destination)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: 600; color: #475569;">Pickup Point:</td>
            <td style="padding: 8px 12px; color: #0f172a;">${escapeHtml(payload.pickup)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: 600; color: #475569;">Drop Point:</td>
            <td style="padding: 8px 12px; color: #0f172a;">${escapeHtml(payload.drop)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: 600; color: #475569;">Travel Dates:</td>
            <td style="padding: 8px 12px; color: #0f172a; font-weight: 500;">${dateDisplay}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 12px; font-weight: 600; color: #475569;">Passengers:</td>
            <td style="padding: 8px 12px; color: #0f172a;">${escapeHtml(payload.adults)} Adult${payload.adults > 1 ? "s" : ""}${payload.children > 0 ? `, ${escapeHtml(payload.children)} Child${payload.children > 1 ? "ren" : ""}` : ""}</td>
          </tr>
          ${ticketDetailsHtml}
        </tbody>
      </table>

      ${stopsHtml}
      ${notesHtml}

      <!-- Call to Action -->
      <div style="margin-top: 24px; padding: 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; text-align: center;">
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #166534;">
          Please reply with your best quote.
        </p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #15803d;">
          Reply directly to this email with tariff and itinerary availability.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; font-size: 11px; color: #94a3b8; text-align: center;">
      Travel Inquiry Dispatcher \xB7 Private Agent Quotation Portal \xB7 Inquiry #${escapeHtml(payload.inquiryNumber)}
    </div>
  </div>
</body>
</html>
  `;
  return { subject, html };
}
async function dispatchToAgent(agent, payload) {
  const { client, fromEmail } = getResendClient();
  const { subject, html } = buildAgentEmail({
    ...payload,
    agentName: agent.name
  });
  const dispatchId = "disp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (!client) {
    return {
      id: dispatchId,
      agentId: agent.id,
      agentName: agent.name,
      agentEmail: agent.email,
      status: "test_preview",
      sentAt: now,
      subject,
      previewHtml: html,
      errorText: "Test Mode: Resend API Key not configured. Email preview generated successfully."
    };
  }
  try {
    const { data, error } = await client.emails.send({
      from: fromEmail,
      to: [agent.email],
      subject,
      html
    });
    if (error) {
      console.error(`[Resend Error] Agent: ${agent.email}, Error:`, error);
      return {
        id: dispatchId,
        agentId: agent.id,
        agentName: agent.name,
        agentEmail: agent.email,
        status: "failed",
        errorText: error.message || "Resend API returned an error",
        sentAt: now,
        subject,
        previewHtml: html
      };
    }
    console.log(`[Resend Live Dispatch] Successfully sent to ${agent.email}, Message ID: ${data?.id}`);
    return {
      id: dispatchId,
      agentId: agent.id,
      agentName: agent.name,
      agentEmail: agent.email,
      status: "sent",
      sentAt: now,
      subject,
      previewHtml: html
    };
  } catch (err) {
    console.error(`[Resend Exception] Agent: ${agent.email}, Exception:`, err);
    return {
      id: dispatchId,
      agentId: agent.id,
      agentName: agent.name,
      agentEmail: agent.email,
      status: "failed",
      errorText: err.message || "Network connection error while contacting Resend",
      sentAt: now,
      subject,
      previewHtml: html
    };
  }
}

// backend/src/routes/inquiries.ts
var inquiriesRouter = Router3();
inquiriesRouter.use(requireAuth);
var dispatchLimiter = createRateLimiter({
  windowMs: 3 * 60 * 1e3,
  maxRequests: 25,
  message: "Dispatch rate limit exceeded."
});
inquiriesRouter.get("/", (_req, res) => {
  const db = Database.getInstance();
  const inquiries = db.getInquiries();
  return res.json({ inquiries });
});
inquiriesRouter.get("/:id", (req, res) => {
  const db = Database.getInstance();
  const inquiry = db.getInquiryById(req.params.id);
  if (!inquiry) {
    return res.status(404).json({ error: "Inquiry not found" });
  }
  return res.json({ inquiry });
});
inquiriesRouter.post("/", dispatchLimiter, async (req, res) => {
  const result = inquiryCreateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")
    });
  }
  const data = result.data;
  const db = Database.getInstance();
  const allAgents = db.getAgents();
  const targetAgents = allAgents.filter((a) => data.agentIds.includes(a.id) && a.active);
  if (targetAgents.length === 0) {
    return res.status(400).json({
      error: "None of the selected agents are currently active. Please select at least one active agent."
    });
  }
  const stopsWithIds = (data.stops || []).map((s, idx) => ({
    id: `stop_${Date.now()}_${idx}`,
    place: s.place.trim(),
    nights: Number(s.nights)
  }));
  const newInquiry = db.createInquiry({
    type: data.type,
    tripType: data.type === "ticket" ? data.tripType || "single" : void 0,
    clientName: data.clientName.trim(),
    clientPhone: data.clientPhone.trim(),
    // Stored safely in DB
    destination: data.destination.trim(),
    pickup: data.pickup.trim(),
    drop: data.drop.trim(),
    dateMode: data.dateMode,
    startDate: data.startDate,
    endDate: data.endDate,
    returnDate: data.returnDate || void 0,
    adults: Number(data.adults),
    children: Number(data.children || 0),
    travelClass: data.travelClass || void 0,
    airlinePref: data.airlinePref?.trim() || void 0,
    notes: data.notes?.trim() || void 0,
    status: "inquiry",
    stops: stopsWithIds,
    dispatches: []
  });
  console.log(`[Inquiry #${newInquiry.inquiryNumber}] Dispatching to ${targetAgents.length} agents for client: ${data.clientName}`);
  const emailPayload = {
    agentName: "",
    // Populated per agent
    clientName: data.clientName.trim(),
    inquiryNumber: newInquiry.inquiryNumber,
    type: data.type,
    tripType: data.type === "ticket" ? data.tripType : void 0,
    destination: data.destination.trim(),
    pickup: data.pickup.trim(),
    drop: data.drop.trim(),
    dateMode: data.dateMode,
    startDate: data.startDate,
    endDate: data.endDate,
    returnDate: data.returnDate || void 0,
    stops: stopsWithIds,
    adults: Number(data.adults),
    children: Number(data.children || 0),
    travelClass: data.travelClass || void 0,
    airlinePref: data.airlinePref?.trim() || void 0,
    notes: data.notes?.trim() || void 0
  };
  const dispatches = [];
  for (const agent of targetAgents) {
    const record = await dispatchToAgent(agent, emailPayload);
    dispatches.push(record);
  }
  const updatedInquiry = db.getInquiryById(newInquiry.id);
  if (updatedInquiry) {
    updatedInquiry.dispatches = dispatches;
    Database.getInstance().updateInquiryStatus(newInquiry.id, "inquiry");
  }
  return res.status(201).json({
    inquiry: db.getInquiryById(newInquiry.id),
    dispatches
  });
});
inquiriesRouter.patch("/:id/status", (req, res) => {
  const result = inquiryStatusSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: "Status must be one of: inquiry, confirmed, cancelled"
    });
  }
  const db = Database.getInstance();
  try {
    const updated = db.updateInquiryStatus(req.params.id, result.data.status);
    return res.json({ inquiry: updated });
  } catch (err) {
    return res.status(404).json({ error: err.message || "Inquiry not found" });
  }
});
inquiriesRouter.post("/:id/retry/:dispatchId", async (req, res) => {
  const db = Database.getInstance();
  const inquiry = db.getInquiryById(req.params.id);
  if (!inquiry) {
    return res.status(404).json({ error: "Inquiry not found" });
  }
  const dispatch = inquiry.dispatches.find((d) => d.id === req.params.dispatchId);
  if (!dispatch) {
    return res.status(404).json({ error: "Dispatch record not found" });
  }
  const agent = db.getAgentById(dispatch.agentId);
  if (!agent) {
    return res.status(400).json({ error: "Target agent is no longer available in agents list" });
  }
  const emailPayload = {
    agentName: agent.name,
    clientName: inquiry.clientName,
    inquiryNumber: inquiry.inquiryNumber,
    type: inquiry.type,
    tripType: inquiry.tripType,
    destination: inquiry.destination,
    pickup: inquiry.pickup,
    drop: inquiry.drop,
    dateMode: inquiry.dateMode,
    startDate: inquiry.startDate,
    endDate: inquiry.endDate,
    returnDate: inquiry.returnDate,
    stops: inquiry.stops,
    adults: inquiry.adults,
    children: inquiry.children,
    travelClass: inquiry.travelClass,
    airlinePref: inquiry.airlinePref,
    notes: inquiry.notes
  };
  const newDispatch = await dispatchToAgent(agent, emailPayload);
  db.updateDispatchRecord(inquiry.id, dispatch.id, {
    status: newDispatch.status,
    errorText: newDispatch.errorText,
    sentAt: newDispatch.sentAt,
    previewHtml: newDispatch.previewHtml
  });
  return res.json({
    message: "Retry completed",
    dispatch: newDispatch,
    inquiry: db.getInquiryById(inquiry.id)
  });
});
inquiriesRouter.delete("/:id", (req, res) => {
  const db = Database.getInstance();
  const success = db.deleteInquiry(req.params.id);
  if (!success) {
    return res.status(404).json({ error: "Inquiry not found" });
  }
  return res.json({ message: "Inquiry and related dispatch records deleted. Linked ledger records unlinked successfully." });
});

// backend/src/routes/ledger.ts
import { Router as Router4 } from "express";
var ledgerRouter = Router4();
ledgerRouter.use(requireAuth);
ledgerRouter.get("/", (_req, res) => {
  const db = Database.getInstance();
  const records = db.getLedgerRecords();
  let totalReceived = 0;
  let totalSent = 0;
  const recordsWithBalance = records.map((record) => {
    const sumSent = record.disbursements.reduce((sum, d) => sum + d.amount, 0);
    const balanceHeld = record.amountReceived - sumSent;
    totalReceived += record.amountReceived;
    totalSent += sumSent;
    return {
      ...record,
      totalSent: sumSent,
      balanceHeld
    };
  });
  const balanceWithMe = totalReceived - totalSent;
  return res.json({
    records: recordsWithBalance,
    summary: {
      totalReceived,
      totalSent,
      balanceWithMe
    }
  });
});
ledgerRouter.post("/", (req, res) => {
  const result = ledgerCreateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(", ")
    });
  }
  const db = Database.getInstance();
  try {
    const record = db.createLedgerRecord(result.data);
    return res.status(201).json({ record });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to create ledger record" });
  }
});
ledgerRouter.put("/:id", (req, res) => {
  const result = ledgerUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(", ")
    });
  }
  const db = Database.getInstance();
  try {
    const updated = db.updateLedgerRecord(req.params.id, result.data);
    return res.json({ record: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to update ledger record" });
  }
});
ledgerRouter.delete("/:id", (req, res) => {
  const db = Database.getInstance();
  const success = db.deleteLedgerRecord(req.params.id);
  if (!success) {
    return res.status(404).json({ error: "Ledger record not found" });
  }
  return res.json({ message: "Ledger record and all its disbursement records deleted permanently." });
});
ledgerRouter.post("/:id/sends", (req, res) => {
  const result = disbursementCreateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(", ")
    });
  }
  const db = Database.getInstance();
  try {
    const updatedRecord = db.addDisbursement(req.params.id, result.data);
    return res.status(201).json({ record: updatedRecord });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to disburse funds" });
  }
});
ledgerRouter.put("/:id/sends/:sendId", (req, res) => {
  const result = disbursementUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(", ")
    });
  }
  const db = Database.getInstance();
  try {
    const updatedRecord = db.updateDisbursement(req.params.id, req.params.sendId, result.data);
    return res.json({ record: updatedRecord });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to update disbursement" });
  }
});
ledgerRouter.delete("/:id/sends/:sendId", (req, res) => {
  const db = Database.getInstance();
  try {
    const updatedRecord = db.removeDisbursement(req.params.id, req.params.sendId);
    return res.json({ record: updatedRecord });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to remove disbursement" });
  }
});

// backend/src/routes/config.ts
import { Router as Router5 } from "express";
var configRouter = Router5();
configRouter.use(requireAuth);
configRouter.get("/", (_req, res) => {
  const db = Database.getInstance();
  const config = db.getConfig();
  return res.json({
    hasResendApiKey: config.hasResendApiKey,
    resendFromEmail: config.resendFromEmail,
    mode: config.hasResendApiKey ? "live" : "test_preview"
  });
});
configRouter.post("/", (req, res) => {
  const result = configUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(", ")
    });
  }
  const db = Database.getInstance();
  db.updateConfig({
    resendApiKey: result.data.resendApiKey,
    resendFromEmail: result.data.resendFromEmail
  });
  const updatedConfig = db.getConfig();
  return res.json({
    message: "Configuration updated successfully.",
    hasResendApiKey: updatedConfig.hasResendApiKey,
    resendFromEmail: updatedConfig.resendFromEmail,
    mode: updatedConfig.hasResendApiKey ? "live" : "test_preview"
  });
});

// backend/src/routes/sync.ts
import { Router as Router6 } from "express";
var syncRouter = Router6();
syncRouter.use(requireAuth);
syncRouter.post("/", (req, res) => {
  const { inquiries, agents, ledger } = req.body;
  const db = Database.getInstance();
  if (Array.isArray(inquiries) && inquiries.length > 0) {
    const existing = db.getInquiries();
    const existingIds = new Set(existing.map((i) => i.id));
    for (const inq of inquiries) {
      if (!existingIds.has(inq.id)) {
        db.data.inquiries.push(inq);
      }
    }
  }
  if (Array.isArray(agents) && agents.length > 0) {
    const existing = db.getAgents();
    const existingIds = new Set(existing.map((a) => a.id));
    for (const ag of agents) {
      if (!existingIds.has(ag.id)) {
        db.data.agents.push(ag);
      }
    }
  }
  if (Array.isArray(ledger) && ledger.length > 0) {
    const existing = db.getLedgerRecords();
    const existingIds = new Set(existing.map((l) => l.id));
    for (const rec of ledger) {
      if (!existingIds.has(rec.id)) {
        db.data.ledger.push(rec);
      }
    }
  }
  db.persist();
  return res.json({
    inquiries: db.getInquiries(),
    agents: db.getAgents(),
    ledger: db.getLedgerRecords(),
    syncedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
});

// backend/src/app.ts
function createBackendApp() {
  const app = express();
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-auth-token"]
    })
  );
  app.use(express.json({ limit: "5mb" }));
  app.use("/api/auth", authRouter);
  app.use("/api/agents", agentsRouter);
  app.use("/api/inquiries", inquiriesRouter);
  app.use("/api/ledger", ledgerRouter);
  app.use("/api/config", configRouter);
  app.use("/api/sync", syncRouter);
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "healthy",
      app: "Travel Inquiry Dispatcher API",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.use((err, _req, res, _next) => {
    console.error("[API Error]", err);
    res.status(err.status || 500).json({
      error: err.message || "Internal server error"
    });
  });
  return app;
}

// server.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var PORT = Number(process.env.PORT) || 3e3;
var isProduction = process.env.NODE_ENV === "production";
async function startServer() {
  const app = createBackendApp();
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true"
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path2.resolve(__dirname, "dist");
    app.use(express2.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path2.resolve(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Travel Inquiry Dispatcher] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Mode] ${isProduction ? "Production (static dist)" : "Development (Vite middleware)"}`);
    console.log(`[Owner Email] ${process.env.OWNER_EMAIL || "owner@traveldispatcher.local"}`);
    console.log(`[Resend Status] ${process.env.RESEND_API_KEY ? "Live API Key Set" : "Test Preview Mode (Key empty)"}`);
  });
}
startServer().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
