import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// Serverless function handlers
import fxCurrentHandler from './api/fx-current.js';
import fxHistoryHandler from './api/fx-history.js';
import healthHandler from './api/health.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.all('/api/fx-current', (req, res) => fxCurrentHandler(req, res));
  app.all('/api/fx-history', (req, res) => fxHistoryHandler(req, res));
  app.all('/api/health', (req, res) => healthHandler(req, res));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BetterRate server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
