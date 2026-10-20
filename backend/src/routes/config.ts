import { Router, Response } from 'express';
import { Database } from '../db.ts';
import { configUpdateSchema } from '../validation.ts';
import { requireAuth, AuthRequest } from '../auth.ts';

export const configRouter = Router();

// Protect all configuration endpoints
configRouter.use(requireAuth);

// GET /api/config - Returns configuration status (never reveals secret key)
configRouter.get('/', (_req: AuthRequest, res: Response) => {
  const db = Database.getInstance();
  const config = db.getConfig();
  return res.json({
    hasResendApiKey: config.hasResendApiKey,
    resendFromEmail: config.resendFromEmail,
    mode: config.hasResendApiKey ? 'live' : 'test_preview',
  });
});

// POST /api/config - Set or update Resend API Key and From Email
configRouter.post('/', (req: AuthRequest, res: Response) => {
  const result = configUpdateSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      error: result.error.issues.map((e) => e.message).join(', '),
    });
  }

  const db = Database.getInstance();
  db.updateConfig({
    resendApiKey: result.data.resendApiKey,
    resendFromEmail: result.data.resendFromEmail,
  });

  const updatedConfig = db.getConfig();
  return res.json({
    message: 'Configuration updated successfully.',
    hasResendApiKey: updatedConfig.hasResendApiKey,
    resendFromEmail: updatedConfig.resendFromEmail,
    mode: updatedConfig.hasResendApiKey ? 'live' : 'test_preview',
  });
});
