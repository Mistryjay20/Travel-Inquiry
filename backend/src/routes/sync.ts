import { Router, Response } from 'express';
import { Database } from '../db.ts';
import { requireAuth, AuthRequest } from '../auth.ts';

export const syncRouter = Router();

syncRouter.use(requireAuth);

// POST /api/sync - Bidirectional synchronization between client and server database
syncRouter.post('/', (req: AuthRequest, res: Response) => {
  const { inquiries, agents, ledger } = req.body;
  const db = Database.getInstance();
  (db as any).data = (db as any).readFromDisk();

  if (Array.isArray(inquiries) && inquiries.length > 0) {
    for (const inq of inquiries) {
      const idx = (db as any).data.inquiries.findIndex((i: any) => i.id === inq.id);
      if (idx >= 0) {
        (db as any).data.inquiries[idx] = inq;
      } else {
        (db as any).data.inquiries.push(inq);
      }
    }
  }

  if (Array.isArray(agents) && agents.length > 0) {
    for (const ag of agents) {
      const idx = (db as any).data.agents.findIndex((a: any) => a.id === ag.id);
      if (idx >= 0) {
        (db as any).data.agents[idx] = ag;
      } else {
        (db as any).data.agents.push(ag);
      }
    }
  }

  if (Array.isArray(ledger) && ledger.length > 0) {
    for (const rec of ledger) {
      const idx = (db as any).data.ledger.findIndex((l: any) => l.id === rec.id);
      if (idx >= 0) {
        (db as any).data.ledger[idx] = rec;
      } else {
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
