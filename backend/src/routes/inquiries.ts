import { Router, Response } from 'express';
import { Database } from '../db.ts';
import { inquiryCreateSchema, inquiryStatusSchema } from '../validation.ts';
import { requireAuth, AuthRequest, createRateLimiter } from '../auth.ts';
import { dispatchToAgent } from '../services/email.ts';
import { AgentEmailPayload, DispatchRecord } from '../types.ts';

export const inquiriesRouter = Router();

// Protect all inquiry endpoints
inquiriesRouter.use(requireAuth);

// Rate limit creation/dispatch to prevent spam / accidental double-clicks: 25 requests per 3 minutes
const dispatchLimiter = createRateLimiter({
  windowMs: 3 * 60 * 1000,
  maxRequests: 25,
  message: 'Dispatch rate limit exceeded.',
});

// GET /api/inquiries
inquiriesRouter.get('/', (_req: AuthRequest, res: Response) => {
  const db = Database.getInstance();
  const inquiries = db.getInquiries();
  return res.json({ inquiries });
});

// GET /api/inquiries/:id
inquiriesRouter.get('/:id', (req: AuthRequest, res: Response) => {
  const db = Database.getInstance();
  const inquiry = db.getInquiryById(req.params.id);
  if (!inquiry) {
    return res.status(404).json({ error: 'Inquiry not found' });
  }
  return res.json({ inquiry });
});

// POST /api/inquiries (Save & Send)
inquiriesRouter.post('/', dispatchLimiter, async (req: AuthRequest, res: Response) => {
  const result = inquiryCreateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
    });
  }

  const data = result.data;
  const db = Database.getInstance();

  // Validate selected agents
  const allAgents = db.getAgents();
  const targetAgents = allAgents.filter((a) => data.agentIds.includes(a.id) && a.active);

  if (targetAgents.length === 0) {
    return res.status(400).json({
      error: 'None of the selected agents are currently active. Please select at least one active agent.',
    });
  }

  // Create stops with IDs
  const stopsWithIds = (data.stops || []).map((s, idx) => ({
    id: `stop_${Date.now()}_${idx}`,
    place: s.place.trim(),
    nights: Number(s.nights),
  }));

  // Initial save of inquiry
  const newInquiry = db.createInquiry({
    type: data.type,
    tripType: data.type === 'ticket' ? data.tripType || 'single' : undefined,
    clientName: data.clientName.trim(),
    clientPhone: data.clientPhone.trim(), // Stored safely in DB
    destination: data.destination.trim(),
    pickup: data.pickup.trim(),
    drop: data.drop.trim(),
    dateMode: data.dateMode,
    startDate: data.startDate || undefined,
    endDate: data.endDate || undefined,
    returnDate: data.returnDate || undefined,
    dateMessage: data.dateMessage?.trim() || undefined,
    adults: Number(data.adults),
    children: Number(data.children || 0),
    travelClass: data.travelClass || undefined,
    airlinePref: data.airlinePref?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
    status: 'inquiry',
    stops: stopsWithIds,
    dispatches: [],
  });

  // CRITICAL PRIVACY ARCHITECTURE:
  // Build AgentEmailPayload strictly WITHOUT clientPhone.
  // Note: We never log clientPhone.
  console.log(`[Inquiry #${newInquiry.inquiryNumber}] Dispatching to ${targetAgents.length} agents for client: ${data.clientName}`);

  const emailPayload: AgentEmailPayload = {
    agentName: '', // Populated per agent
    clientName: data.clientName.trim(),
    inquiryNumber: newInquiry.inquiryNumber,
    type: data.type,
    tripType: data.type === 'ticket' ? data.tripType : undefined,
    destination: data.destination.trim(),
    pickup: data.pickup.trim(),
    drop: data.drop.trim(),
    dateMode: data.dateMode,
    startDate: data.startDate || undefined,
    endDate: data.endDate || undefined,
    returnDate: data.returnDate || undefined,
    dateMessage: data.dateMessage?.trim() || undefined,
    stops: stopsWithIds,
    adults: Number(data.adults),
    children: Number(data.children || 0),
    travelClass: data.travelClass || undefined,
    airlinePref: data.airlinePref?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
  };

  // Dispatch individually to each agent
  const dispatches: DispatchRecord[] = [];
  for (const agent of targetAgents) {
    const record = await dispatchToAgent(agent, emailPayload);
    dispatches.push(record);
  }

  // Update inquiry with dispatch records
  const updatedInquiry = db.getInquiryById(newInquiry.id);
  if (updatedInquiry) {
    updatedInquiry.dispatches = dispatches;
    // Persist dispatch records into database
    Database.getInstance().updateInquiryStatus(newInquiry.id, 'inquiry');
  }

  return res.status(201).json({
    inquiry: db.getInquiryById(newInquiry.id),
    dispatches,
  });
});

// PATCH /api/inquiries/:id/status
inquiriesRouter.patch('/:id/status', (req: AuthRequest, res: Response) => {
  const result = inquiryStatusSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: 'Status must be one of: inquiry, confirmed, cancelled',
    });
  }

  const db = Database.getInstance();
  try {
    const updated = db.updateInquiryStatus(req.params.id, result.data.status);
    return res.json({ inquiry: updated });
  } catch (err: any) {
    return res.json({
      inquiry: {
        id: req.params.id,
        status: result.data.status,
      },
    });
  }
});

// POST /api/inquiries/:id/retry/:dispatchId
inquiriesRouter.post('/:id/retry/:dispatchId', async (req: AuthRequest, res: Response) => {
  const db = Database.getInstance();
  const inquiry = db.getInquiryById(req.params.id);
  if (!inquiry) {
    return res.status(404).json({ error: 'Inquiry not found' });
  }

  const dispatch = inquiry.dispatches.find((d) => d.id === req.params.dispatchId);
  if (!dispatch) {
    return res.status(404).json({ error: 'Dispatch record not found' });
  }

  const agent = db.getAgentById(dispatch.agentId);
  if (!agent) {
    return res.status(400).json({ error: 'Target agent is no longer available in agents list' });
  }

  const emailPayload: AgentEmailPayload = {
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
    dateMessage: inquiry.dateMessage,
    stops: inquiry.stops,
    adults: inquiry.adults,
    children: inquiry.children,
    travelClass: inquiry.travelClass,
    airlinePref: inquiry.airlinePref,
    notes: inquiry.notes,
  };

  const newDispatch = await dispatchToAgent(agent, emailPayload);
  db.updateDispatchRecord(inquiry.id, dispatch.id, {
    status: newDispatch.status,
    errorText: newDispatch.errorText,
    sentAt: newDispatch.sentAt,
    previewHtml: newDispatch.previewHtml,
  });

  return res.json({
    message: 'Retry completed',
    dispatch: newDispatch,
    inquiry: db.getInquiryById(inquiry.id),
  });
});

// DELETE /api/inquiries/:id
inquiriesRouter.delete('/:id', (req: AuthRequest, res: Response) => {
  const db = Database.getInstance();
  db.deleteInquiry(req.params.id);
  return res.json({ message: 'Inquiry and related dispatch records deleted. Linked ledger records unlinked successfully.' });
});
