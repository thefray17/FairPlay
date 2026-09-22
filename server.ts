import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable trust proxy for Google Cloud Run / reverse proxy environment
  app.set('trust proxy', 1);

  // Reduced from 10mb to 1mb to close DoS attack surface
  app.use(express.json({ limit: '1mb' }));

  // File-backed session directory (persisted in .data/ which is now gitignored)
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
    } else {
      // Automatically create empty sessions.json on initial startup
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}, null, 2), 'utf-8');
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

  // Rate limiters using express-rate-limit:
  // Limit GET requests to 120 per minute per IP, and POST requests to 30 per minute per IP
  const sessionGetLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // 120 reads per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, forwardedHeader: false },
    message: { success: false, error: 'Too many session requests from this IP. Please try again later.' },
  });

  const sessionPostLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 writes per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, forwardedHeader: false },
    message: { success: false, error: 'Too many session update requests. Please wait a moment.' },
  });

  // API routes FIRST
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // GET session by ID (supports flexible, case-insensitive, and short-code matching)
  // Publicly readable for spectators and players by PIN without logging in.
  // Never echoes back the organizerToken field in the response.
  app.get('/api/sessions/:id', sessionGetLimiter, (req, res) => {
    const rawId = (req.params.id || '').trim();
    const sessionId = rawId.toUpperCase();

    if (!sessionId || sessionId.length > 32 || !/^[A-Z0-9_-]+$/.test(sessionId)) {
      return res.status(400).json({ success: false, error: 'Invalid session code format' });
    }

    // 1. Exact match or case-insensitive match
    let session = sessions[sessionId];
    if (!session) {
      const matchedKey = Object.keys(sessions).find((k) => k.toUpperCase() === sessionId);
      if (matchedKey) {
        session = sessions[matchedKey];
      }
    }

    // 2. Bare code match (e.g., "4821" matches "BDM-4821", or "BDM-4821" matches "4821")
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

    // If requested session ID is not found, return 404 (do not substitute an unrelated session)
    if (!session) {
      return res.status(404).json({
        success: false,
        error: `Session "${sessionId}" was not found on the server. Please verify the session code.`,
      });
    }

    // Never echo back the organizerToken field in the response - strip it out
    const { organizerToken: _secret, ...safeSession } = session;

    res.json({
      success: true,
      session: {
        ...safeSession,
        id: session.id || sessionId,
      },
    });
  });

  // POST / PUT session by ID with organizerToken auth, field allowlisting, and 500KB size guard
  app.post('/api/sessions/:id', sessionPostLimiter, (req, res) => {
    const rawId = (req.params.id || '').trim();
    const sessionId = rawId.toUpperCase();

    if (!sessionId || sessionId.length > 32 || !/^[A-Z0-9_-]+$/.test(sessionId)) {
      return res.status(400).json({ success: false, error: 'Invalid session ID format' });
    }

    // 3. Size guard: reject if JSON-stringified body exceeds 500KB
    const bodyStr = JSON.stringify(req.body || {});
    if (bodyStr.length > 500 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'Payload too large: Session data exceeds 500KB limit',
      });
    }

    const body = req.body || {};
    const existing = sessions[sessionId];

    // 1. Require organizerToken in the request body (allow header as fallback)
    const incomingToken = (
      (typeof body.organizerToken === 'string' ? body.organizerToken : '') ||
      ((req.headers['x-organizer-token'] as string) || '')
    ).trim();

    if (!incomingToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing required organizerToken in request body',
      });
    }

    // If session already exists, reject with 403 if token doesn't match stored one.
    // If session is new, store whatever token is provided as source of truth.
    if (existing) {
      if (incomingToken !== existing.organizerToken) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You do not have edit permission for this session. Use the Edit link or switch to read-only view.',
        });
      }
    }

    const activeOrganizerToken = existing ? existing.organizerToken : incomingToken;

    // 2. Allowlist only known fields: config, players, rounds, upcomingMatches, openPlay, organizerToken, deviceOrigin
    const sanitizedSession: Record<string, any> = {
      id: sessionId,
      updatedAt: Date.now(),
      createdAt: existing?.createdAt || body.createdAt || Date.now(),
      organizerToken: activeOrganizerToken,
    };

    if (body.config !== undefined && typeof body.config === 'object') {
      sanitizedSession.config = body.config;
    } else if (existing?.config !== undefined) {
      sanitizedSession.config = existing.config;
    }

    if (Array.isArray(body.players)) {
      sanitizedSession.players = body.players;
    } else if (existing?.players !== undefined) {
      sanitizedSession.players = existing.players;
    }

    if (Array.isArray(body.rounds)) {
      sanitizedSession.rounds = body.rounds;
    } else if (existing?.rounds !== undefined) {
      sanitizedSession.rounds = existing.rounds;
    }

    if (Array.isArray(body.upcomingMatches)) {
      sanitizedSession.upcomingMatches = body.upcomingMatches;
    } else if (existing?.upcomingMatches !== undefined) {
      sanitizedSession.upcomingMatches = existing.upcomingMatches;
    }

    if (body.openPlay !== undefined && typeof body.openPlay === 'object') {
      sanitizedSession.openPlay = body.openPlay;
    } else if (existing?.openPlay !== undefined) {
      sanitizedSession.openPlay = existing.openPlay;
    }

    if (typeof body.deviceOrigin === 'string' && body.deviceOrigin.length <= 256) {
      sanitizedSession.deviceOrigin = body.deviceOrigin;
    } else if (existing?.deviceOrigin !== undefined) {
      sanitizedSession.deviceOrigin = existing.deviceOrigin;
    }

    sessions[sessionId] = sanitizedSession;
    saveSessionsToFile();

    const { organizerToken: _secret, ...safeSession } = sanitizedSession;
    res.json({
      success: true,
      session: safeSession,
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
