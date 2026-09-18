import { SessionConfig, Player, Round, UpcomingMatch } from '../types';
import { OpenPlayConfig, OpenPlayMatch, OpenPlayPlayer } from '../types/openPlay';
import {
  saveSessionToFirestore,
  fetchSessionFromFirestore,
  subscribeToSessionFirestore,
} from '../lib/firebase';

export interface OpenPlaySessionData {
  config?: OpenPlayConfig;
  activeMatches?: Record<number, OpenPlayMatch>;
  history?: OpenPlayMatch[];
  winnersQueue?: string[];
  losersQueue?: string[];
  restingBench?: string[];
  nextQueueTurn?: 'winners' | 'losers';
  players?: Player[];
  queueOrder?: string[];
  waitingQueue?: OpenPlayPlayer[];
  updatedAt?: number;
}

export const OPENPLAY_SYNC_EVENT = 'fairplay:openplay-cloud-synced';
export const SESSION_LOADED_EVENT = 'fairplay:session-loaded';

export function emitOpenPlayCloudSynced(sessionId: string, timestamp: number) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(OPENPLAY_SYNC_EVENT, {
          detail: { sessionId, timestamp },
        })
      );
    } catch {}
  }
}

export interface SessionData {
  id: string;
  config?: SessionConfig;
  players?: Player[];
  rounds?: Round[];
  upcomingMatches?: UpcomingMatch[];
  openPlay?: OpenPlaySessionData;
  updatedAt: number;
  deviceOrigin?: string;
}

/**
 * Sanitize and enforce user-friendly session codes.
 * Standard codes are 4-digit PINs (e.g. "7429", "8314") or short codes (e.g. "BDM-7429").
 * Any mangled hostname or overly long string is immediately normalized.
 */
export function sanitizeSessionCode(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();

  // Strip query strings, hashes, and non-alphanumeric chars (keep dash for legacy support)
  const clean = trimmed
    .split('?')[0]
    .split('#')[0]
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toUpperCase();

  // If someone passed an absurdly long string, mangled hostname, or URL leftovers
  if (clean.length > 10 || clean.startsWith('HTTP') || clean.includes('AIS-DEV') || clean.includes('RUNAPP')) {
    // Check if it ends with or contains 4 digits (like 7429)
    const digitMatch = clean.match(/\b\d{4}\b/);
    if (digitMatch) return digitMatch[0];
    return '7429';
  }

  return clean;
}

/**
 * Generate a friendly, ultra-short 4-digit session code (e.g. "7429", "8314").
 * Easy to remember, easy to shout across a noisy gym/court, and instant to type
 * on a phone's numeric keypad without changing keyboards or typing dashes.
 */
export function generateSessionId(): string {
  const pin = Math.floor(1000 + Math.random() * 9000);
  return pin.toString();
}

/**
 * Clean and extract a session ID from either a raw code ("7429", "BDM-7429")
 * or a pasted full URL ("https://domain.com/?session=7429", "/openplay?session=7429", or hash)
 */
export function extractSessionId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // If user pasted a URL or query string
  try {
    if (trimmed.includes('http://') || trimmed.includes('https://') || trimmed.includes('?') || trimmed.includes('#')) {
      const fullUrl = trimmed.startsWith('http') ? trimmed : `https://fairplay.local/${trimmed.replace(/^\/+/, '')}`;
      const url = new URL(fullUrl);
      
      // 1. Direct query parameter: ?session=... or ?s=...
      const sessionParam = url.searchParams.get('session') || url.searchParams.get('s');
      if (sessionParam && sessionParam.trim()) {
        return sanitizeSessionCode(sessionParam.trim());
      }

      // 2. Query inside hash: #/openplay?session=...
      if (url.hash && url.hash.includes('?')) {
        const hashQueryPart = url.hash.split('?')[1];
        if (hashQueryPart) {
          const hashParams = new URLSearchParams(hashQueryPart);
          const hashSession = hashParams.get('session') || hashParams.get('s');
          if (hashSession && hashSession.trim()) {
            return sanitizeSessionCode(hashSession.trim());
          }
        }
      }

      // 3. Direct hash value: #7429 or #BDM-7429
      if (url.hash && url.hash.length > 1) {
        const cleanHash = url.hash.replace(/^#\/?/, '').split('?')[0];
        if (/^[a-zA-Z0-9_-]{3,10}$/.test(cleanHash)) {
          return sanitizeSessionCode(cleanHash);
        }
      }

      // If it's a URL but has NO session parameter, DO NOT parse the hostname as an ID!
      return '';
    }
  } catch {}

  return sanitizeSessionCode(trimmed);
}

/**
 * Construct the full shareable URL with the session ID parameter
 */
export function buildSessionShareUrl(sessionId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const cleanId = sessionId.trim().toUpperCase();
  return `${origin}${pathname}?session=${encodeURIComponent(cleanId)}`;
}

/**
 * Extract current Open Play local storage data for cloud session transfer
 */
export function getCurrentOpenPlayData(): OpenPlaySessionData {
  if (typeof window === 'undefined') return {};
  const data: OpenPlaySessionData = {};

  try {
    const rawConfig = localStorage.getItem('openplay_config_v1');
    if (rawConfig) data.config = JSON.parse(rawConfig);
  } catch {}

  try {
    const rawMatches = localStorage.getItem('openplay_active_matches_v1');
    if (rawMatches) data.activeMatches = JSON.parse(rawMatches);
  } catch {}

  try {
    const rawHistory = localStorage.getItem('openplay_history_v1');
    if (rawHistory) data.history = JSON.parse(rawHistory);
  } catch {}

  try {
    const rawWinners = localStorage.getItem('openplay_winners_queue_v2');
    if (rawWinners) data.winnersQueue = JSON.parse(rawWinners);
  } catch {}

  try {
    const rawLosers = localStorage.getItem('openplay_losers_queue_v2');
    if (rawLosers) data.losersQueue = JSON.parse(rawLosers);
  } catch {}

  try {
    const rawBench = localStorage.getItem('openplay_resting_bench_v2');
    if (rawBench) data.restingBench = JSON.parse(rawBench);
  } catch {}

  try {
    const rawTurn = localStorage.getItem('openplay_next_queue_turn_v2');
    if (rawTurn === 'winners' || rawTurn === 'losers') data.nextQueueTurn = rawTurn;
  } catch {}

  try {
    const rawPlayers = localStorage.getItem('openplay_players_v1');
    if (rawPlayers) data.players = JSON.parse(rawPlayers);
  } catch {}

  try {
    const rawQueue = localStorage.getItem('openplay_queue_order_v1');
    if (rawQueue) data.queueOrder = JSON.parse(rawQueue);
  } catch {}

  return data;
}

/**
 * Apply transferred Open Play session data to local storage and notify listeners
 */
export function applyOpenPlayData(openPlay?: OpenPlaySessionData): void {
  if (typeof window === 'undefined' || !openPlay) return;

  try {
    if (openPlay.config) {
      localStorage.setItem('openplay_config_v1', JSON.stringify(openPlay.config));
    }
    if (openPlay.activeMatches) {
      localStorage.setItem('openplay_active_matches_v1', JSON.stringify(openPlay.activeMatches));
    }
    if (openPlay.history) {
      localStorage.setItem('openplay_history_v1', JSON.stringify(openPlay.history));
    }
    if (openPlay.winnersQueue) {
      localStorage.setItem('openplay_winners_queue_v2', JSON.stringify(openPlay.winnersQueue));
    }
    if (openPlay.losersQueue) {
      localStorage.setItem('openplay_losers_queue_v2', JSON.stringify(openPlay.losersQueue));
    }
    if (openPlay.restingBench) {
      localStorage.setItem('openplay_resting_bench_v2', JSON.stringify(openPlay.restingBench));
    }
    if (openPlay.nextQueueTurn) {
      localStorage.setItem('openplay_next_queue_turn_v2', openPlay.nextQueueTurn);
    }
    if (openPlay.players && Array.isArray(openPlay.players)) {
      localStorage.setItem('openplay_players_v1', JSON.stringify(openPlay.players));
    }
    if (openPlay.queueOrder) {
      localStorage.setItem('openplay_queue_order_v1', JSON.stringify(openPlay.queueOrder));
    }

    // Fire custom event to notify OpenPlayPage to reload its state
    window.dispatchEvent(new CustomEvent('openplay-session-sync', { detail: { openPlay } }));
  } catch (err) {
    console.error('Failed to apply transferred Open Play data:', err);
  }
}

/**
 * Apply all session data (tournament + open play) into localStorage
 */
export function applySessionToLocalStorage(session: SessionData): void {
  if (typeof window === 'undefined' || !session) return;
  try {
    const cleanId = session.id ? session.id.toUpperCase().trim() : '';
    if (cleanId) {
      localStorage.setItem('fairclub_session_id_v1', cleanId);
    }

    if (session.config) {
      localStorage.setItem('fairclub_config_v1', JSON.stringify(session.config));
    }
    if (session.players && Array.isArray(session.players)) {
      localStorage.setItem('fairclub_players_v1', JSON.stringify(session.players));
    }
    if (session.rounds && Array.isArray(session.rounds)) {
      localStorage.setItem('fairclub_rounds_v1', JSON.stringify(session.rounds));
    }
    if (session.upcomingMatches && Array.isArray(session.upcomingMatches)) {
      localStorage.setItem('fairclub_upcoming_v1', JSON.stringify(session.upcomingMatches));
    }
    localStorage.setItem('fairclub_onboarded_v1', 'true');

    if (session.openPlay) {
      applyOpenPlayData(session.openPlay);
    } else if (session.players && Array.isArray(session.players)) {
      localStorage.setItem('openplay_players_v1', JSON.stringify(session.players));
    }

    if (session.updatedAt) {
      localStorage.setItem('fairplay_openplay_last_synced', String(session.updatedAt));
    }
  } catch (err) {
    console.error('Failed to apply session to localStorage:', err);
  }
}

/**
 * Save current session state to the cloud server
 */
export async function saveSessionToCloud(
  sessionId: string,
  payload: {
    config?: SessionConfig;
    players?: Player[];
    rounds?: Round[];
    upcomingMatches?: UpcomingMatch[];
    openPlay?: OpenPlaySessionData;
  }
): Promise<{ success: boolean; session?: SessionData; error?: string }> {
  try {
    const cleanId = sessionId.trim().toUpperCase();
    if (!cleanId) return { success: false, error: 'Invalid session ID' };

    // Fill defaults from localStorage if any top-level tournament key is omitted
    let config = payload.config;
    if (!config && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('fairclub_config_v1');
        if (raw) config = JSON.parse(raw);
      } catch {}
    }

    let players = payload.players;
    if (!players && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('fairclub_players_v1');
        if (raw) players = JSON.parse(raw);
      } catch {}
    }

    let rounds = payload.rounds;
    if (!rounds && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('fairclub_rounds_v1');
        if (raw) rounds = JSON.parse(raw);
      } catch {}
    }

    let upcomingMatches = payload.upcomingMatches;
    if (!upcomingMatches && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('fairclub_upcoming_v1');
        if (raw) upcomingMatches = JSON.parse(raw);
      } catch {}
    }

    let openPlay = payload.openPlay;
    if (!openPlay && typeof window !== 'undefined') {
      openPlay = getCurrentOpenPlayData();
    }

    const fullSessionPayload: SessionData = {
      ...payload,
      ...(config ? { config } : {}),
      ...(players ? { players } : {}),
      ...(rounds ? { rounds } : {}),
      ...(upcomingMatches ? { upcomingMatches } : {}),
      ...(openPlay ? { openPlay } : {}),
      id: cleanId,
      updatedAt: Date.now(),
      deviceOrigin: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };

    // 1. Dual-sync to Google Firebase Firestore for real-time cloud persistence
    saveSessionToFirestore(cleanId, fullSessionPayload).catch((firestoreErr) => {
      console.warn('Background Firestore sync notice:', firestoreErr);
    });

    // 2. Save to server API endpoint for local filesystem cache and cross-browser resilience
    const res = await fetch(`/api/sessions/${cleanId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fullSessionPayload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || `Server responded with ${res.status}`,
      };
    }

    const data = await res.json();
    return { success: true, session: data.session || fullSessionPayload };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error saving session',
    };
  }
}

/**
 * Fetch a session by ID from the cloud server (checking Firebase Firestore first)
 */
export async function fetchSessionFromCloud(
  sessionId: string
): Promise<{ success: boolean; session?: SessionData; error?: string }> {
  try {
    const cleanId = extractSessionId(sessionId);
    if (!cleanId) return { success: false, error: 'Please provide a valid session ID' };

    // 1. Try Firebase Firestore first for real-time cloud data
    try {
      const firestoreResult = await fetchSessionFromFirestore(cleanId);
      if (firestoreResult.success && firestoreResult.session) {
        return { success: true, session: firestoreResult.session };
      }
    } catch (fsErr) {
      console.debug('Firestore lookup fallback to local server:', fsErr);
    }

    // 2. Fallback to Express backend storage
    const res = await fetch(`/api/sessions/${cleanId}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || `Session ${cleanId} was not found on server`,
      };
    }

    const data = await res.json();
    if (!data.session) {
      return { success: false, error: 'Session data was empty' };
    }

    // Proactively seed into Firestore in background if not yet cached in cloud
    saveSessionToFirestore(cleanId, data.session).catch(() => {});

    return { success: true, session: data.session };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error retrieving session',
    };
  }
}

/**
 * Load a session from the cloud server and immediately apply it to all storage and active views
 */
export async function loadAndApplySession(
  targetId: string
): Promise<{ success: boolean; session?: SessionData; error?: string }> {
  const cleanId = extractSessionId(targetId);
  if (!cleanId) return { success: false, error: 'Please enter a valid session ID or paste a session link' };

  const res = await fetchSessionFromCloud(cleanId);
  if (!res.success || !res.session) {
    return {
      success: false,
      error: res.error || `Session "${cleanId}" was not found on the server. Please verify the code or generate a new session.`,
    };
  }

  const s = res.session;
  applySessionToLocalStorage(s);

  // Update URL without page reload
  if (typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('session', cleanId);
      window.history.replaceState({}, '', url.toString());
    } catch {}

    // Dispatch global events so all components update state immediately
    window.dispatchEvent(
      new CustomEvent(SESSION_LOADED_EVENT, {
        detail: { session: s },
      })
    );

    const activePlayers = s.players || s.openPlay?.players;
    if (activePlayers && Array.isArray(activePlayers)) {
      window.dispatchEvent(
        new CustomEvent('fairplay:sync-roster', {
          detail: { source: 'cloud', updatedPlayers: activePlayers },
        })
      );
    }

    if (s.openPlay) {
      window.dispatchEvent(
        new CustomEvent('openplay-session-sync', {
          detail: { openPlay: s.openPlay },
        })
      );
    }

    emitOpenPlayCloudSynced(cleanId, s.updatedAt || Date.now());
  }

  return { success: true, session: s };
}

// Re-export Firebase infrastructure for easy access across tournament & open-play modules
export {
  auth,
  db,
  saveSessionToFirestore,
  fetchSessionFromFirestore,
  subscribeToSessionFirestore,
} from '../lib/firebase';
export type { UserProfile } from '../lib/firebase';
