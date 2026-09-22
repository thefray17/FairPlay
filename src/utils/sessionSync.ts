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
  organizerToken?: string;
  ownerUid?: string;
  isOrganizer?: boolean;
}

/**
 * Generate a cryptographically secure organizer write token.
 * This private key allows the creator and authorized co-organizers to edit sessions,
 * while regular players and spectators only hold the public view-only code.
 */
export function generateOrganizerToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    // Generates 53-character crypto-strength UUID with entropy
    return `${crypto.randomUUID()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15) +
    Date.now().toString(36)
  );
}

/**
 * Retrieve the saved organizer token for a session from this device
 */
export function getOrganizerToken(sessionId: string): string | null {
  if (typeof window === 'undefined') return null;
  const clean = sanitizeSessionCode(sessionId);
  if (!clean) return null;
  return (
    localStorage.getItem(`fairplay_organizer_token_${clean}`) ||
    localStorage.getItem(`fairclub_organizer_token_${clean}`) ||
    null
  );
}

/**
 * Save an organizer write token to this device's storage (e.g. after creating or scanning admin QR)
 */
export function setOrganizerToken(sessionId: string, token: string): void {
  if (typeof window === 'undefined') return;
  const clean = sanitizeSessionCode(sessionId);
  if (!clean || !token) return;
  const trimmedToken = token.trim();
  localStorage.setItem(`fairplay_organizer_token_${clean}`, trimmedToken);
  localStorage.setItem(`fairclub_organizer_token_${clean}`, trimmedToken);
}

/**
 * Check whether this device has organizer (write) privileges for the session
 */
export function isSessionOrganizer(sessionId: string): boolean {
  return !!getOrganizerToken(sessionId);
}

/**
 * Sanitize and enforce user-friendly session codes.
 * Standard codes are 4-digit PINs (e.g. "4821", "8314") or short codes (e.g. "BDM-4821").
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
    // Check if it ends with or contains 4 digits
    const digitMatch = clean.match(/\b\d{4}\b/) || clean.match(/\d{4}/);
    if (digitMatch) return digitMatch[0];
    return '';
  }

  return clean;
}

/**
 * Generate a friendly, ultra-short 4-digit session code (e.g. "4821", "8314").
 * Easy to remember, easy to shout across a noisy gym/court, and instant to type
 * on a phone's numeric keypad without changing keyboards or typing dashes.
 */
export function generateSessionId(): string {
  const pin = Math.floor(1000 + Math.random() * 9000);
  return pin.toString();
}

/**
 * Clean and extract a session ID from either a raw code ("4821", "BDM-4821")
 * or a pasted full URL ("https://domain.com/?session=4821&key=...", "/openplay?session=4821", or hash).
 * Automatically stores the private organizer key if provided in the URL query string.
 */
export function extractSessionId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();

  // If user pasted a URL or query string
  try {
    if (trimmed.includes('http://') || trimmed.includes('https://') || trimmed.includes('?') || trimmed.includes('#')) {
      const fullUrl = trimmed.startsWith('http') ? trimmed : `https://fairplay.local/${trimmed.replace(/^\/+/, '')}`;
      const url = new URL(fullUrl);
      
      // Check for organizer key in query parameters (editToken, organizerToken, token, key, k)
      const adminKey =
        url.searchParams.get('editToken') ||
        url.searchParams.get('organizerToken') ||
        url.searchParams.get('token') ||
        url.searchParams.get('key') ||
        url.searchParams.get('k');

      // 1. Direct query parameter: ?session=... or ?s=...
      const sessionParam = url.searchParams.get('session') || url.searchParams.get('s');
      if (sessionParam && sessionParam.trim()) {
        const cleanCode = sanitizeSessionCode(sessionParam.trim());
        if (adminKey && cleanCode) {
          setOrganizerToken(cleanCode, adminKey.trim());
        }
        return cleanCode;
      }

      // 2. Query inside hash: #/openplay?session=...
      if (url.hash && url.hash.includes('?')) {
        const hashQueryPart = url.hash.split('?')[1];
        if (hashQueryPart) {
          const hashParams = new URLSearchParams(hashQueryPart);
          const hashSession = hashParams.get('session') || hashParams.get('s');
          const hashKey =
            hashParams.get('editToken') ||
            hashParams.get('organizerToken') ||
            hashParams.get('token') ||
            hashParams.get('key') ||
            hashParams.get('k');
          if (hashSession && hashSession.trim()) {
            const cleanCode = sanitizeSessionCode(hashSession.trim());
            if (hashKey && cleanCode) {
              setOrganizerToken(cleanCode, hashKey.trim());
            }
            return cleanCode;
          }
        }
      }

      // 3. Direct hash value: #4821 or #BDM-4821
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
 * Construct the shareable URL.
 * - By default returns a Viewer Link (Read-Only) with just the session PIN
 * - If editAccess or coOrganizer is true, embeds the private organizer token
 */
export function buildSessionShareUrl(
  sessionId: string,
  options?: { editAccess?: boolean; coOrganizer?: boolean }
): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const cleanId = sessionId.trim().toUpperCase();

  const baseUrl = `${origin}${pathname}?session=${encodeURIComponent(cleanId)}`;

  if (options?.editAccess || options?.coOrganizer) {
    const token = getOrganizerToken(cleanId);
    if (token) {
      return `${baseUrl}&editToken=${encodeURIComponent(token)}`;
    }
  }

  return baseUrl;
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

    const token = getOrganizerToken(cleanId);
    if (!token) {
      // Device is in read-only mode (loaded via public PIN or spectator join link)
      const msg = 'Read-only session: This device does not have edit permissions. Ask the session organizer to share an Edit link.';
      console.warn(`[FairPlay Sync] Session ${cleanId} write skipped: device is in read-only mode.`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fairplay:sync-error', { detail: { error: msg } }));
      }
      return { success: false, error: msg };
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
      organizerToken: token,
      deviceOrigin: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };

    // 1. Dual-sync to Google Firebase Firestore for real-time cloud persistence with token
    saveSessionToFirestore(cleanId, fullSessionPayload, token).catch((firestoreErr) => {
      console.warn('Background Firestore sync notice:', firestoreErr);
    });

    // 2. Save to server API endpoint with authorization token header
    const res = await fetch(`/api/sessions/${cleanId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-organizer-token': token,
      },
      body: JSON.stringify(fullSessionPayload),
    });

    if (res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error || 'Write permission denied: You are in read-only viewer mode. Ask the host organizer to share the Edit link.';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fairplay:sync-error', { detail: { error: msg } }));
      }
      return { success: false, error: msg };
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error || `Server responded with ${res.status}`;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fairplay:sync-error', { detail: { error: msg } }));
      }
      return {
        success: false,
        error: msg,
      };
    }

    const data = await res.json();
    if (data.organizerToken) {
      setOrganizerToken(cleanId, data.organizerToken);
    }
    return { success: true, session: data.session || fullSessionPayload };
  } catch (err: any) {
    const msg = err?.message || 'Network error saving session';
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fairplay:sync-error', { detail: { error: msg } }));
    }
    return {
      success: false,
      error: msg,
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

    const token = getOrganizerToken(cleanId);

    // 1. Try Firebase Firestore first for real-time cloud data
    try {
      const firestoreResult = await fetchSessionFromFirestore(cleanId);
      if (firestoreResult.success && firestoreResult.session) {
        const s = firestoreResult.session;
        if (s.organizerToken && token && s.organizerToken === token) {
          s.isOrganizer = true;
        } else {
          s.isOrganizer = !!token;
        }
        return { success: true, session: s };
      }
    } catch (fsErr) {
      console.debug('Firestore lookup fallback to local server:', fsErr);
    }

    // 2. Fallback to Express backend storage with organizer token verification
    const headers: Record<string, string> = {};
    if (token) {
      headers['x-organizer-token'] = token;
    }

    const res = await fetch(`/api/sessions/${cleanId}`, { headers });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || `Session "${cleanId}" was not found on server`,
      };
    }

    const data = await res.json();
    if (!data.session) {
      return { success: false, error: 'Session data was empty' };
    }

    const sessionData: SessionData = data.session;
    if (sessionData.organizerToken) {
      setOrganizerToken(cleanId, sessionData.organizerToken);
    }

    // Proactively seed into Firestore in background if not yet cached in cloud
    saveSessionToFirestore(cleanId, sessionData, token || sessionData.organizerToken).catch(() => {});

    return { success: true, session: sessionData };
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
