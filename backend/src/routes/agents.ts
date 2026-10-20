import { Router, Response } from 'express';
import { Database } from '../db.ts';
import { agentSchema, agentUpdateSchema } from '../validation.ts';
import { requireAuth, AuthRequest } from '../auth.ts';

export const agentsRouter = Router();

// Protect all agents endpoints
agentsRouter.use(requireAuth);

// GET /api/agents
agentsRouter.get('/', (_req: AuthRequest, res: Response) => {
  const db = Database.getInstance();
  const agents = db.getAgents();
  return res.json({ agents });
});

// POST /api/agents
agentsRouter.post('/', (req: AuthRequest, res: Response) => {
  const result = agentSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(', '),
    });
  }

  const db = Database.getInstance();
  const created = db.createAgent(result.data);
  return res.status(201).json({ agent: created });
});

// PUT /api/agents/:id
agentsRouter.put('/:id', (req: AuthRequest, res: Response) => {
  const result = agentUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(', '),
    });
  }

  const db = Database.getInstance();
  try {
    const updated = db.updateAgent(req.params.id, result.data);
    return res.json({ agent: updated });
  } catch (err: any) {
    return res.status(404).json({ error: err.message || 'Agent not found' });
  }
});

// DELETE /api/agents/:id
agentsRouter.delete('/:id', (req: AuthRequest, res: Response) => {
  const db = Database.getInstance();
  const deleted = db.deleteAgent(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  return res.json({ message: 'Agent deleted successfully' });
});
