import { Router, Response } from 'express';
import { Database } from '../db.ts';
import {
  ledgerCreateSchema,
  ledgerUpdateSchema,
  disbursementCreateSchema,
  disbursementUpdateSchema,
} from '../validation.ts';
import { requireAuth, AuthRequest } from '../auth.ts';

export const ledgerRouter = Router();

// Protect all ledger endpoints
ledgerRouter.use(requireAuth);

// GET /api/ledger - returns records, with calculated balances and overall summary cards
ledgerRouter.get('/', (_req: AuthRequest, res: Response) => {
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
      balanceHeld,
    };
  });

  const balanceWithMe = totalReceived - totalSent;

  return res.json({
    records: recordsWithBalance,
    summary: {
      totalReceived,
      totalSent,
      balanceWithMe,
    },
  });
});

// POST /api/ledger - Create new received record
ledgerRouter.post('/', (req: AuthRequest, res: Response) => {
  const result = ledgerCreateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(', '),
    });
  }

  const db = Database.getInstance();
  try {
    const record = db.createLedgerRecord(result.data);
    return res.status(201).json({ record });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to create ledger record' });
  }
});

// PUT /api/ledger/:id - Edit received record
ledgerRouter.put('/:id', (req: AuthRequest, res: Response) => {
  const result = ledgerUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(', '),
    });
  }

  const db = Database.getInstance();
  try {
    const updated = db.updateLedgerRecord(req.params.id, result.data);
    return res.json({ record: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update ledger record' });
  }
});

// DELETE /api/ledger/:id - Delete record and its disbursements
ledgerRouter.delete('/:id', (req: AuthRequest, res: Response) => {
  const db = Database.getInstance();
  const success = db.deleteLedgerRecord(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Ledger record not found' });
  }
  return res.json({ message: 'Ledger record and all its disbursement records deleted permanently.' });
});

// POST /api/ledger/:id/sends - (+ Send: Add disbursement inside existing record)
ledgerRouter.post('/:id/sends', (req: AuthRequest, res: Response) => {
  const result = disbursementCreateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(', '),
    });
  }

  const db = Database.getInstance();
  try {
    const updatedRecord = db.addDisbursement(req.params.id, result.data);
    return res.status(201).json({ record: updatedRecord });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to disburse funds' });
  }
});

// PUT /api/ledger/:id/sends/:sendId - Edit sent disbursement amount/details
ledgerRouter.put('/:id/sends/:sendId', (req: AuthRequest, res: Response) => {
  const result = disbursementUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(', '),
    });
  }

  const db = Database.getInstance();
  try {
    const updatedRecord = db.updateDisbursement(req.params.id, req.params.sendId, result.data);
    return res.json({ record: updatedRecord });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update disbursement' });
  }
});

// DELETE /api/ledger/:id/sends/:sendId - Remove sent disbursement from record
ledgerRouter.delete('/:id/sends/:sendId', (req: AuthRequest, res: Response) => {
  const db = Database.getInstance();
  try {
    const updatedRecord = db.removeDisbursement(req.params.id, req.params.sendId);
    return res.json({ record: updatedRecord });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to remove disbursement' });
  }
});
