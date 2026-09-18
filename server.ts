import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // File-backed session directory
  const DATA_DIR = path.join(process.cwd(), '.data');
  const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

  let sessions: Record<string, any> = {};

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(SESSIONS_FILE)) {
      const raw = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      sessions = JSON.parse(raw);
    }
  } catch (err) {
    console.error('[Server] Failed to initialize sessions storage:', err);
  }

  function saveSessionsToFile() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Server] Failed to persist sessions file:', err);
    }
  }

  // API routes FIRST
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // GET session by ID (supports flexible, case-insensitive, and short-code matching)
  app.get('/api/sessions/:id', (req, res) => {
    const rawId = (req.params.id || '').trim();
    const sessionId = rawId.toUpperCase();

    // 1. Exact match or case-insensitive match
    let session = sessions[sessionId];
    if (!session) {
      const matchedKey = Object.keys(sessions).find((k) => k.toUpperCase() === sessionId);
      if (matchedKey) {
        session = sessions[matchedKey];
      }
    }

    // 2. Bare code match (e.g., "7429" matches "BDM-7429", or "BDM-7429" matches "7429")
    if (!session) {
      const bareId = sessionId.replace(/^[A-Z0-9]+-/, '');
      if (bareId && sessions[bareId]) {
        session = sessions[bareId];
      } else if (bareId) {
        const found = Object.keys(sessions).find((k) => k.replace(/^[A-Z0-9]+-/, '') === bareId);
        if (found) {
          session = sessions[found];
        }
      }
    }

    // 3. Prefix match if bare code requested
    if (!session) {
      const withPrefix = `BDM-${sessionId}`;
      if (sessions[withPrefix]) {
        session = sessions[withPrefix];
      }
    }

    // 4. Fallback for legacy long hostname key
    if (!session && (sessionId.length > 20 || sessionId.includes('AIS-DEV') || sessionId.startsWith('HTTP'))) {
      session = sessions['7429'] || sessions['BDM-7429'];
    }

    if (!session) {
      return res.status(404).json({
        success: false,
        error: `Session "${sessionId}" was not found on the server. Please verify the session code.`,
      });
    }

    // Clean any legacy long ID from the returned session object
    const cleanId = (session.id && (session.id.length > 15 || session.id.startsWith('HTTP'))) ? (sessionId.length <= 10 ? sessionId : '7429') : (session.id || sessionId);

    res.json({
      success: true,
      session: {
        ...session,
        id: cleanId,
      },
    });
  });

  // POST / PUT session by ID
  app.post('/api/sessions/:id', (req, res) => {
    const rawId = (req.params.id || '').trim();
    const sessionId = rawId.toUpperCase();

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }

    const body = req.body || {};
    const existing = sessions[sessionId] || {};

    // Merge openPlay cleanly if provided
    let mergedOpenPlay = existing.openPlay;
    if (body.openPlay !== undefined) {
      mergedOpenPlay = {
        ...(existing.openPlay || {}),
        ...body.openPlay,
      };
    }

    sessions[sessionId] = {
      ...existing,
      ...body,
      ...(mergedOpenPlay !== undefined ? { openPlay: mergedOpenPlay } : {}),
      id: sessionId,
      updatedAt: Date.now(),
    };

    saveSessionsToFile();

    res.json({
      success: true,
      session: sessions[sessionId],
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FairPlay Server] running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
