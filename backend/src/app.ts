import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.ts';
import { agentsRouter } from './routes/agents.ts';
import { inquiriesRouter } from './routes/inquiries.ts';
import { ledgerRouter } from './routes/ledger.ts';
import { configRouter } from './routes/config.ts';
import { syncRouter } from './routes/sync.ts';

export function createBackendApp(): Express {
  const app = express();

  // Basic security and parsing middleware
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
    })
  );

  app.use(express.json({ limit: '5mb' }));

  // API Route mounting
  app.use('/api/auth', authRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/inquiries', inquiriesRouter);
  app.use('/api/ledger', ledgerRouter);
  app.use('/api/config', configRouter);
  app.use('/api/sync', syncRouter);

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      app: 'Travel Inquiry Dispatcher API',
      timestamp: new Date().toISOString(),
    });
  });

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[API Error]', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
    });
  });

  return app;
}
