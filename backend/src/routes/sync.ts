import { Router, Response } from 'express';
import { Database } from '../db.ts';
import { requireAuth, AuthRequest } from '../auth.ts';

export const syncRouter = Router();

syncRouter.use(requireAuth);

// POST /api/sync - Bidirectional synchronization between client and server database
syncRouter.post('/', (req: AuthRequest, res: Response) => {
  const { inquiries, agents, ledger } = req.body;
  const db = Database.getInstance();

  if (Array.isArray(inquiries) && inquiries.length > 0) {
    const existing = db.getInquiries();
    const existingIds = new Set(existing.map((i) => i.id));
    for (const inq of inquiries) {
      if (!existingIds.has(inq.id)) {
        // Save into server DB
        (db as any).data.inquiries.push(inq);
      }
    }
  }

  if (Array.isArray(agents) && agents.length > 0) {
    const existing = db.getAgents();
    const existingIds = new Set(existing.map((a) => a.id));
    for (const ag of agents) {
      if (!existingIds.has(ag.id)) {
        (db as any).data.agents.push(ag);
      }
    }
  }

  if (Array.isArray(ledger) && ledger.length > 0) {
    const existing = db.getLedgerRecords();
    const existingIds = new Set(existing.map((l) => l.id));
    for (const rec of ledger) {
      if (!existingIds.has(rec.id)) {
        (db as any).data.ledger.push(rec);
      }
    }
  }

  (db as any).persist();

  return res.json({
    inquiries: db.getInquiries(),
    agents: db.getAgents(),
    ledger: db.getLedgerRecords(),
    syncedAt: new Date().toISOString(),
  });
});
