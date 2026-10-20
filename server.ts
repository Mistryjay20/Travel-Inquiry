import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createBackendApp } from './backend/src/app.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = createBackendApp();

  if (!isProduction) {
    // Development mode: attach Vite dev server middleware
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Production mode: serve built assets from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));

    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Travel Inquiry Dispatcher] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Mode] ${isProduction ? 'Production (static dist)' : 'Development (Vite middleware)'}`);
    console.log(`[Owner Email] ${process.env.OWNER_EMAIL || 'owner@traveldispatcher.local'}`);
    console.log(`[Resend Status] ${process.env.RESEND_API_KEY ? 'Live API Key Set' : 'Test Preview Mode (Key empty)'}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
