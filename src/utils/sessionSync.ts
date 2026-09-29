import { Player, Round, SessionConfig, UpcomingMatch } from "../types";
import { OpenPlayConfig, OpenPlayMatch } from "../types/openPlay";
import {
  saveSessionToFirestore,
  fetchSessionFromFirestore,
  subscribeToSessionFirestore,
  auth,
  db
} from "../lib/firebase";

export interface OpenPlaySessionData {
  config?: OpenPlayConfig;
  activeMatches?: Record<number, OpenPlayMatch>;
  history?: OpenPlayMatch[];
  winnersQueue?: string[];
  losersQueue?: string[];
  restingBench?: string[];
  nextQueueTurn?: "winners" | "losers";
  players?: Player[];
  queueOrder?: string[];
  updatedAt?: number;
}

export interface SessionData {
  id: string;
  config?: SessionConfig;
  players?: Player[];
  rounds?: Round[];
  upcomingMatches?: UpcomingMatch[];
  openPlay?: OpenPlaySessionData;
  organizerToken?: string;
  updatedAt?: number;
  deviceOrigin?: string;
  isOrganizer?: boolean;
}

export const OPENPLAY_SYNC_EVENT = "fairplay:openplay-cloud-synced";
export const SESSION_LOADED_EVENT = "fairplay:session-loaded";

export function emitOpenPlayCloudSynced(sessionId: string, timestamp: number): void {
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent(OPENPLAY_SYNC_EVENT, {
          detail: { sessionId, timestamp }
        })
      );
    } catch {
    }
  }
}

export function generateOrganizerToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${crypto.randomUUID()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const arr = new Uint8Array(24);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

export function getOrganizerToken(sessionId: string): string | null {
  if (typeof window === "undefined") return null;
  const clean = sanitizeSessionCode(sessionId);
  if (!clean) return null;
  return localStorage.getItem(`fairplay_organizer_token_${clean}`) || localStorage.getItem(`fairclub_organizer_token_${clean}`) || null;
}

export function setOrganizerToken(sessionId: string, token: string): void {
  if (typeof window === "undefined") return;
  const clean = sanitizeSessionCode(sessionId);
  if (!clean || !token) return;
  const trimmedToken = token.trim();
  localStorage.setItem(`fairplay_organizer_token_${clean}`, trimmedToken);
  localStorage.setItem(`fairclub_organizer_token_${clean}`, trimmedToken);
}

export function isSessionOrganizer(sessionId: string): boolean {
  return !!getOrganizerToken(sessionId);
}

export interface RecentSessionEntry {
  id: string;
  lastAccessed: number;
  isOrganizer: boolean;
  hasOrganizerAccess?: boolean;
  name?: string;
  sport?: string;
  playersCount?: number;
  roundsCount?: number;
}

export function getKnownDeviceSessions(): RecentSessionEntry[] {
  if (typeof window === "undefined") return [];
  const sessionMap = new Map<string, RecentSessionEntry>();
  try {
    const raw = localStorage.getItem("fairplay_recent_sessions_v1");
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((entry: any) => {
          if (entry && entry.id) {
            const clean = sanitizeSessionCode(entry.id);
            if (clean) {
              sessionMap.set(clean, {
                ...entry,
                id: clean,
                isOrganizer: !!getOrganizerToken(clean)
              });
            }
          }
        });
      }
    }
  } catch {
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("fairplay_organizer_token_")) {
        const id = key.replace("fairplay_organizer_token_", "");
        const clean = sanitizeSessionCode(id);
        if (clean && !sessionMap.has(clean)) {
          const cached = getOfflineSession(clean);
          sessionMap.set(clean, {
            id: clean,
            lastAccessed: cached?.updatedAt || Date.now(),
            isOrganizer: true,
            name: cached?.config?.sessionName,
            sport: cached?.config?.sport,
            playersCount: cached?.players?.length || cached?.openPlay?.players?.length,
            roundsCount: cached?.rounds?.length || cached?.openPlay?.history?.length
          });
        }
      }
    }
  } catch {
  }
  return Array.from(sessionMap.values()).sort((a, b) => b.lastAccessed - a.lastAccessed).slice(0, 10);
}

export function recordRecentSession(sessionId: string, details?: { name?: string; sport?: string; playersCount?: number; roundsCount?: number }): void {
  if (typeof window === "undefined") return;
  const clean = sanitizeSessionCode(sessionId);
  if (!clean) return;
  try {
    const list = getKnownDeviceSessions();
    const existingIdx = list.findIndex((e) => e.id === clean);
    const updatedEntry: RecentSessionEntry = {
      id: clean,
      lastAccessed: Date.now(),
      isOrganizer: !!getOrganizerToken(clean),
      ...details
    };
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], ...updatedEntry };
    } else {
      list.unshift(updatedEntry);
    }
    localStorage.setItem("fairplay_recent_sessions_v1", JSON.stringify(list.slice(0, 10)));
  } catch {
  }
}

export function saveSessionBackupSnapshot(session: SessionData): void {
  if (typeof window === "undefined" || !session || !session.id) return;
  try {
    const cleanId = sanitizeSessionCode(session.id);
    if (!cleanId) return;
    const key = `fairplay_backup_snapshot_${cleanId}`;
    localStorage.setItem(key, JSON.stringify({
      ...session,
      savedAt: Date.now()
    }));
  } catch {
  }
}

export function getSessionBackupSnapshot(sessionId?: string): { timestamp: number; session: any } | null {
  if (typeof window === "undefined") return null;
  const targetId = sessionId ? sanitizeSessionCode(sessionId) : (localStorage.getItem("fairplay_cached_session_id") || "");
  if (!targetId) return null;
  try {
    const key = `fairplay_backup_snapshot_${targetId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const timestamp = parsed.savedAt || parsed.updatedAt || Date.now();
    return { timestamp, session: parsed };
  } catch {
    return null;
  }
}

export function saveSessionOfflineCache(sessionId: string, sessionData: any): void {
  if (typeof window === "undefined") return;
  const clean = sanitizeSessionCode(sessionId);
  if (!clean) return;
  try {
    const key = `fairplay_session_cache_${clean}`;
    localStorage.setItem(key, JSON.stringify(sessionData));
    localStorage.setItem("fairplay_cached_session_id", clean);
  } catch {
  }
}

export function getOfflineSession(sessionId: string): SessionData | null {
  if (typeof window === "undefined") return null;
  const clean = sanitizeSessionCode(sessionId);
  if (!clean) return null;
  try {
    const key = `fairplay_session_cache_${clean}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
  }
  return null;
}

export function sanitizeSessionCode(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let clean = raw.trim();
  try {
    if (clean.includes("://") || clean.includes("?") || clean.includes("/") || clean.includes("&")) {
      const extracted = extractSessionId(clean);
      if (extracted) return extracted;
    }
  } catch {
  }
  clean = clean.replace(/^(?:session[\s:_-]*|s[\s:_-]*|id[\s:_-]*|join[\s:_-]*)/i, "");
  clean = clean.replace(/[^A-Za-z0-9_-]/g, "");
  return clean.toUpperCase();
}

export function generateSessionId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function extractSessionId(input: string): string {
  if (!input || typeof input !== "string") return "";
  const trimmed = input.trim();
  try {
    let url: URL | null = null;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      url = new URL(trimmed);
    } else if (trimmed.includes("?") || trimmed.includes("/") || trimmed.includes("&")) {
      url = new URL(trimmed, "http://localhost");
    }
    if (url) {
      const fromParam = url.searchParams.get("session") || url.searchParams.get("s") || url.searchParams.get("id");
      if (fromParam) {
        const cleanParam = sanitizeSessionCode(fromParam);
        if (cleanParam) return cleanParam;
      }
      const pathParts = url.pathname.split("/").filter(Boolean);
      const prefixIndex = pathParts.findIndex((p) => ["s", "session", "join"].includes(p.toLowerCase()));
      if (prefixIndex !== -1 && pathParts[prefixIndex + 1]) {
        const cleanPathCode = sanitizeSessionCode(pathParts[prefixIndex + 1]);
        if (cleanPathCode) return cleanPathCode;
      }
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart !== "openplay" && lastPart !== "index.html") {
          const cleanPathCode = sanitizeSessionCode(lastPart);
          if (cleanPathCode && cleanPathCode.length >= 3 && cleanPathCode.length <= 12) {
            return cleanPathCode;
          }
        }
      }
      return "";
    }
  } catch {
  }
  return sanitizeSessionCode(trimmed);
}

export function buildSessionShareUrl(sessionId: string, options?: { editAccess?: boolean; coOrganizer?: boolean }): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
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

export function getCurrentOpenPlayData(): OpenPlaySessionData {
  if (typeof window === "undefined") return {};
  const data: OpenPlaySessionData = {};
  try {
    const rawConfig = localStorage.getItem("openplay_config_v1") || localStorage.getItem("fairclub_openplay_config_v1");
    if (rawConfig) data.config = JSON.parse(rawConfig);
  } catch {
  }
  try {
    const rawMatches = localStorage.getItem("openplay_active_matches_v1") || localStorage.getItem("fairclub_openplay_active_matches_v1");
    if (rawMatches) data.activeMatches = JSON.parse(rawMatches);
  } catch {
  }
  try {
    const rawHistory = localStorage.getItem("openplay_history_v1") || localStorage.getItem("fairclub_openplay_history_v1");
    if (rawHistory) data.history = JSON.parse(rawHistory);
  } catch {
  }
  try {
    const rawWinners = localStorage.getItem("openplay_winners_queue_v2");
    if (rawWinners) data.winnersQueue = JSON.parse(rawWinners);
  } catch {
  }
  try {
    const rawLosers = localStorage.getItem("openplay_losers_queue_v2");
    if (rawLosers) data.losersQueue = JSON.parse(rawLosers);
  } catch {
  }
  try {
    const rawBench = localStorage.getItem("openplay_resting_bench_v2");
    if (rawBench) data.restingBench = JSON.parse(rawBench);
  } catch {
  }
  try {
    const rawTurn = localStorage.getItem("openplay_next_queue_turn_v2") || localStorage.getItem("fairclub_openplay_next_queue_turn_v1");
    if (rawTurn === "winners" || rawTurn === "losers") data.nextQueueTurn = rawTurn;
  } catch {
  }
  try {
    const rawPlayers = localStorage.getItem("openplay_players_v1") || localStorage.getItem("fairclub_openplay_players_v1");
    if (rawPlayers) data.players = JSON.parse(rawPlayers);
  } catch {
  }
  try {
    const rawQueue = localStorage.getItem("openplay_queue_order_v1");
    if (rawQueue) data.queueOrder = JSON.parse(rawQueue);
  } catch {
  }
  return data;
}

export function applyOpenPlayData(openPlay: OpenPlaySessionData): void {
  if (typeof window === "undefined" || !openPlay) return;
  try {
    if (openPlay.config) {
      localStorage.setItem("openplay_config_v1", JSON.stringify(openPlay.config));
      localStorage.setItem("fairclub_openplay_config_v1", JSON.stringify(openPlay.config));
    }
    if (openPlay.activeMatches) {
      localStorage.setItem("openplay_active_matches_v1", JSON.stringify(openPlay.activeMatches));
      localStorage.setItem("fairclub_openplay_active_matches_v1", JSON.stringify(openPlay.activeMatches));
    }
    if (openPlay.history) {
      localStorage.setItem("openplay_history_v1", JSON.stringify(openPlay.history));
      localStorage.setItem("fairclub_openplay_history_v1", JSON.stringify(openPlay.history));
    }
    if (openPlay.winnersQueue) {
      localStorage.setItem("openplay_winners_queue_v2", JSON.stringify(openPlay.winnersQueue));
    }
    if (openPlay.losersQueue) {
      localStorage.setItem("openplay_losers_queue_v2", JSON.stringify(openPlay.losersQueue));
    }
    if (openPlay.restingBench) {
      localStorage.setItem("openplay_resting_bench_v2", JSON.stringify(openPlay.restingBench));
    }
    if (openPlay.nextQueueTurn) {
      localStorage.setItem("openplay_next_queue_turn_v2", openPlay.nextQueueTurn);
      localStorage.setItem("fairclub_openplay_next_queue_turn_v1", openPlay.nextQueueTurn);
    }
    if (openPlay.players) {
      localStorage.setItem("openplay_players_v1", JSON.stringify(openPlay.players));
      localStorage.setItem("fairclub_openplay_players_v1", JSON.stringify(openPlay.players));
    }
    if (openPlay.queueOrder) {
      localStorage.setItem("openplay_queue_order_v1", JSON.stringify(openPlay.queueOrder));
    }
  } catch {
  }
}

export function applySessionToLocalStorage(session: SessionData): void {
  if (typeof window === "undefined" || !session) return;
  try {
    const cleanId = session.id ? sanitizeSessionCode(session.id) : "";
    if (cleanId) {
      localStorage.setItem("fairclub_session_id_v1", cleanId);
    }
    if (session.organizerToken && cleanId) {
      setOrganizerToken(cleanId, session.organizerToken);
    }
    if (session.config) {
      localStorage.setItem("fairclub_config_v1", JSON.stringify(session.config));
    }
    if (session.players && Array.isArray(session.players)) {
      localStorage.setItem("fairclub_players_v1", JSON.stringify(session.players));
    }
    if (session.rounds && Array.isArray(session.rounds)) {
      localStorage.setItem("fairclub_rounds_v1", JSON.stringify(session.rounds));
    }
    if (session.upcomingMatches && Array.isArray(session.upcomingMatches)) {
      localStorage.setItem("fairclub_upcoming_v1", JSON.stringify(session.upcomingMatches));
    }
    localStorage.setItem("fairclub_onboarded_v1", "true");
    if (session.openPlay) {
      applyOpenPlayData(session.openPlay);
    } else if (session.players && Array.isArray(session.players)) {
      localStorage.setItem("openplay_players_v1", JSON.stringify(session.players));
      localStorage.setItem("fairclub_openplay_players_v1", JSON.stringify(session.players));
    }
    if (session.updatedAt) {
      localStorage.setItem("fairplay_openplay_last_synced", String(session.updatedAt));
    }
    if (cleanId) {
      saveSessionOfflineCache(cleanId, session);
      recordRecentSession(cleanId, {
        name: session.config?.sessionName,
        sport: session.config?.sport,
        playersCount: session.players?.length || session.openPlay?.players?.length,
        roundsCount: session.rounds?.length || session.openPlay?.history?.length
      });
    }
  } catch (err) {
    console.error("Failed to apply session to localStorage:", err);
  }
}

export async function saveSessionToCloud(sessionId: string, payload: Partial<SessionData>): Promise<{ success: boolean; session?: SessionData; error?: string }> {
  try {
    const cleanId = sessionId.trim().toUpperCase();
    if (!cleanId) return { success: false, error: "Invalid session ID" };
    const cached = getOfflineSession(cleanId);
    let config = payload.config ?? cached?.config;
    if (!config && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("fairclub_config_v1");
        if (raw) config = JSON.parse(raw);
      } catch {
      }
    }
    let players = payload.players ?? cached?.players;
    if (!players && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("fairclub_players_v1");
        if (raw) players = JSON.parse(raw);
      } catch {
      }
    }
    let rounds = payload.rounds !== undefined ? payload.rounds : cached?.rounds;
    if (rounds === undefined) {
      rounds = [];
    }
    let upcomingMatches = payload.upcomingMatches !== undefined ? payload.upcomingMatches : cached?.upcomingMatches;
    if (upcomingMatches === undefined) {
      upcomingMatches = [];
    }
    let openPlay = payload.openPlay !== undefined ? payload.openPlay : cached?.openPlay;
    const token = getOrganizerToken(cleanId);
    if (!token) {
      const msg = "Read-only session: This device does not have edit permissions. Ask the session organizer to share an Edit link.";
      console.warn(`[FairPlay Sync] Session ${cleanId} write skipped: device is in read-only mode.`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("fairplay:sync-error", { detail: { error: msg } }));
      }
      return { success: false, error: msg };
    }
    const fullSessionPayload: SessionData = {
      ...payload,
      ...config ? { config } : {},
      ...players ? { players } : {},
      ...rounds ? { rounds } : {},
      ...upcomingMatches ? { upcomingMatches } : {},
      ...openPlay ? { openPlay } : {},
      id: cleanId,
      updatedAt: Date.now(),
      organizerToken: token,
      deviceOrigin: typeof navigator !== "undefined" ? navigator.userAgent : "unknown"
    };
    saveSessionOfflineCache(cleanId, fullSessionPayload);
    saveSessionToFirestore(cleanId, fullSessionPayload, token).catch((firestoreErr) => {
      console.warn("Background Firestore sync notice:", firestoreErr);
    });
    const res = await fetch(`/api/sessions/${cleanId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-organizer-token": token
      },
      body: JSON.stringify(fullSessionPayload)
    });
    if (res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error || "Write permission denied: You are in read-only viewer mode. Ask the host organizer to share the Edit link.";
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("fairplay:sync-error", { detail: { error: msg } }));
      }
      return { success: false, error: msg };
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error || `Server responded with ${res.status}`;
      return {
        success: true,
        session: fullSessionPayload,
        error: msg
      };
    }
    const data = await res.json();
    if (data.organizerToken) {
      setOrganizerToken(cleanId, data.organizerToken);
    }
    return { success: true, session: data.session || fullSessionPayload };
  } catch (err: any) {
    const cleanId = sessionId.trim().toUpperCase();
    if (cleanId) {
      saveSessionOfflineCache(cleanId, { id: cleanId, ...payload, updatedAt: Date.now() });
    }
    return {
      success: true,
      session: { id: cleanId, ...payload, updatedAt: Date.now() } as SessionData,
      error: "Saved offline on this device (data is currently off)"
    };
  }
}

export async function fetchSessionFromCloud(sessionId: string): Promise<{ success: boolean; session?: SessionData; error?: string }> {
  try {
    const cleanId = extractSessionId(sessionId);
    if (!cleanId) return { success: false, error: "Please provide a valid session ID" };
    const token = getOrganizerToken(cleanId);
    try {
      const firestoreResult = await fetchSessionFromFirestore(cleanId);
      if (firestoreResult.success && firestoreResult.session) {
        const s: any = firestoreResult.session;
        if (s.organizerToken && token && s.organizerToken === token) {
          s.isOrganizer = true;
        } else {
          s.isOrganizer = !!token;
        }
        saveSessionOfflineCache(cleanId, s);
        return { success: true, session: s };
      }
    } catch (fsErr) {
      console.debug("Firestore lookup fallback to local server:", fsErr);
    }
    const headers: Record<string, string> = {};
    if (token) {
      headers["x-organizer-token"] = token;
    }
    try {
      const res = await fetch(`/api/sessions/${cleanId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          const sessionData = data.session;
          if (sessionData.organizerToken) {
            setOrganizerToken(cleanId, sessionData.organizerToken);
          }
          saveSessionOfflineCache(cleanId, sessionData);
          return { success: true, session: sessionData };
        }
      }
    } catch (netErr) {
      console.debug("Server fetch offline fallback notice:", netErr);
    }
    const offlineCached = getOfflineSession(cleanId);
    if (offlineCached) {
      console.log(`[FairPlay Sync] Successfully served session ${cleanId} from offline cache`);
      return { success: true, session: offlineCached };
    }
    return {
      success: false,
      error: `Session "${cleanId}" was not found on server or offline cache`
    };
  } catch (err: any) {
    const cleanId = extractSessionId(sessionId);
    if (cleanId) {
      const offlineCached = getOfflineSession(cleanId);
      if (offlineCached) {
        return { success: true, session: offlineCached };
      }
    }
    return {
      success: false,
      error: err?.message || "Network error retrieving session"
    };
  }
}

export async function loadAndApplySession(targetId: string, isExplicitTransfer: boolean = false): Promise<{ success: boolean; session?: SessionData; error?: string }> {
  const cleanId = extractSessionId(targetId);
  if (!cleanId) return { success: false, error: "Please enter a valid session ID or paste a session link" };
  const res = await fetchSessionFromCloud(cleanId);
  if (!res.success || !res.session) {
    return {
      success: false,
      error: res.error || `Session "${cleanId}" was not found on the server. Please verify the code or generate a new session.`
    };
  }
  const s = res.session;
  applySessionToLocalStorage(s);
  if (typeof window !== "undefined") {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("session", cleanId);
      window.history.replaceState({}, "", url.toString());
    } catch {
    }
    window.dispatchEvent(
      new CustomEvent(SESSION_LOADED_EVENT, {
        detail: { session: s, isExplicitTransfer }
      })
    );
    const activePlayers = s.players || s.openPlay?.players;
    if (activePlayers && Array.isArray(activePlayers)) {
      window.dispatchEvent(
        new CustomEvent("fairplay:sync-roster", {
          detail: { source: "cloud", updatedPlayers: activePlayers }
        })
      );
    }
    if (s.openPlay) {
      window.dispatchEvent(
        new CustomEvent("openplay-session-sync", {
          detail: { openPlay: s.openPlay }
        })
      );
    }
    emitOpenPlayCloudSynced(cleanId, s.updatedAt || Date.now());
  }
  return { success: true, session: s };
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    try {
      const currentId = localStorage.getItem("fairclub_session_id_v1");
      if (currentId) {
        const cached = getOfflineSession(currentId);
        if (cached && cached.organizerToken) {
          saveSessionToCloud(currentId, cached).then(() => {
            console.log(`[FairPlay Sync] Auto-synced offline session ${currentId} to cloud upon reconnect`);
          }).catch(() => {
          });
        }
      }
    } catch {
    }
  });
}

export {
  auth,
  db,
  saveSessionToFirestore,
  fetchSessionFromFirestore,
  subscribeToSessionFirestore
} from "../lib/firebase";
