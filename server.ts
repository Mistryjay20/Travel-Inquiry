import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createBackendApp } from './backend/src/app.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';

// In AI Studio Build, the dev server must always listen on port 3000.
// If CLI specifies --port (e.g. control-plane passes --port 3000), prioritize that.
function resolvePort(): number {
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    return Number(process.argv[portArgIdx + 1]) || 3000;
  }
  if (!isProduction) {
    return 3000;
  }
  return Number(process.env.PORT) || 3000;
}

const PORT = resolvePort();

async function startServer() {
  const app = createBackendApp();

  if (!isProduction) {
    // Development mode: attach Vite dev server middleware without HMR
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Travel Inquiry Dispatcher] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Mode] ${isProduction ? 'Production (static dist)' : 'Development (Vite middleware)'}`);
    console.log(`[Owner Email] ${process.env.OWNER_EMAIL || 'owner@traveldispatcher.local'}`);
    console.log(`[Resend Status] ${process.env.RESEND_API_KEY ? 'Live API Key Set' : 'Test Preview Mode (Key empty)'}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is in use. Retrying or verifying process.`);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
