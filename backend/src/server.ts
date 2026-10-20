import dotenv from 'dotenv';
dotenv.config();

import { createBackendApp } from './app.ts';

const PORT = Number(process.env.BACKEND_PORT || process.env.PORT) || 3001;

const app = createBackendApp();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Backend REST API] Running on http://0.0.0.0:${PORT}`);
  console.log(`[Database Path] backend/data/database.json`);
});
