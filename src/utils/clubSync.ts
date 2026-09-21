import { Club, SportType } from '../types';
import {
  saveClubToFirestore,
  fetchClubFromFirestore,
  fetchClubByCodeFromFirestore,
  subscribeToClubFirestore,
  addSessionIdToClub,
  addMemberProfileIdToClub,
  fetchSessionFromFirestore,
  ensureFirebaseAuth,
  auth,
} from '../lib/firebase';
import {
  generateSessionId,
  sanitizeSessionCode,
  generateOrganizerToken,
  SessionData,
} from './sessionSync';
import { getDevicePlayerProfile } from './identitySync';
import { Unsubscribe } from 'firebase/firestore';

export const CLUB_STORAGE_KEYS = {
  ACTIVE_ID: 'fairplay_active_club_id_v1',
  SAVED_CLUBS: 'fairplay_saved_clubs_v1',
};

export const CLUB_UPDATED_EVENT = 'fairplay:club-updated';

/**
 * Dispatch an event to notify UI components that club state changed
 */
export function emitClubUpdated(club: Club | null, eventType: 'created' | 'joined' | 'updated' | 'switched' | 'cleared') {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(CLUB_UPDATED_EVENT, {
          detail: { club, eventType, timestamp: Date.now() },
        })
      );
    } catch {}
  }
}

/**
 * Retrieve the currently active club ID from localStorage
 */
export function getActiveClubId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CLUB_STORAGE_KEYS.ACTIVE_ID) || null;
}

/**
 * Set the currently active club ID in localStorage and notify listeners
 */
export function setActiveClubId(clubId: string | null): void {
  if (typeof window === 'undefined') return;
  if (clubId) {
    localStorage.setItem(CLUB_STORAGE_KEYS.ACTIVE_ID, clubId);
  } else {
    localStorage.removeItem(CLUB_STORAGE_KEYS.ACTIVE_ID);
  }
}

/**
 * Retrieve list of all clubs saved/joined on this device
 */
export function getSavedClubsLocally(): Club[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CLUB_STORAGE_KEYS.SAVED_CLUBS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save or update a club in the device's local cache
 */
export function saveClubLocally(club: Club): void {
  if (typeof window === 'undefined' || !club || !club.id) return;
  try {
    const clubs = getSavedClubsLocally();
    const existingIndex = clubs.findIndex((c) => c.id === club.id);
    if (existingIndex >= 0) {
      clubs[existingIndex] = { ...clubs[existingIndex], ...club, updatedAt: Date.now() };
    } else {
      clubs.unshift(club);
    }
    localStorage.setItem(CLUB_STORAGE_KEYS.SAVED_CLUBS, JSON.stringify(clubs));
  } catch (err) {
    console.warn('saveClubLocally note:', err);
  }
}

/**
 * Generate a friendly 4-digit club join code, reusing the PIN pattern from sessionSync
 */
export function generateClubCode(): string {
  return generateSessionId();
}

/**
 * Sanitize club code input (4-digit numeric code)
 */
export function sanitizeClubCode(raw: string): string {
  return sanitizeSessionCode(raw);
}

/**
 * Create a new Club/Squad in Firestore and link it locally
 */
export async function createClub(
  name: string,
  options?: {
    sport?: SportType;
    description?: string;
    initialSessionId?: string;
  }
): Promise<{ success: boolean; club?: Club; error?: string }> {
  const cleanName = (name || '').trim();
  if (!cleanName) {
    return { success: false, error: 'Please enter a club or squad name' };
  }

  try {
    // Authenticate device anonymously to obtain a valid UID
    const user = await ensureFirebaseAuth();
    const createdByUid = user?.uid || auth.currentUser?.uid || 'anon_' + Math.random().toString(36).slice(2, 10);

    const clubId = 'club_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const code = generateClubCode();
    const now = Date.now();

    const sessionIds: string[] = [];
    if (options?.initialSessionId) {
      const cleanSessionId = options.initialSessionId.trim().toUpperCase();
      if (cleanSessionId) sessionIds.push(cleanSessionId);
    }

    const profile = getDevicePlayerProfile();
    const memberProfileIds: string[] = [];
    if (profile?.id) {
      memberProfileIds.push(profile.id);
    }

    const organizerToken = generateOrganizerToken();

    const newClub: Club = {
      id: clubId,
      name: cleanName,
      code,
      createdByUid,
      organizerToken,
      memberProfileIds,
      sessionIds,
      createdAt: now,
      updatedAt: now,
      description: options?.description?.trim() || undefined,
      sport: options?.sport || 'badminton',
    };

    // Save to Firestore
    const res = await saveClubToFirestore(newClub);
    if (!res.success) {
      console.warn('Could not save club to cloud, storing locally:', res.error);
    }

    // Save locally and set as active club
    saveClubLocally(newClub);
    setActiveClubId(newClub.id);
    emitClubUpdated(newClub, 'created');

    return { success: true, club: newClub };
  } catch (err: any) {
    console.error('createClub error:', err);
    return { success: false, error: err?.message || 'Failed to create club' };
  }
}

/**
 * Join an existing club using its 4-digit PIN join code
 */
export async function joinClubByCode(
  code: string
): Promise<{ success: boolean; club?: Club; error?: string }> {
  const cleanCode = sanitizeClubCode(code);
  if (!cleanCode || cleanCode.length < 4) {
    return { success: false, error: 'Please enter a valid 4-digit club code' };
  }

  try {
    const profile = getDevicePlayerProfile();

    // 1. Try local list first for instant response
    const localClubs = getSavedClubsLocally();
    const localMatch = localClubs.find((c) => c.code.toUpperCase() === cleanCode.toUpperCase());
    if (localMatch) {
      if (profile?.id && (!localMatch.memberProfileIds || !localMatch.memberProfileIds.includes(profile.id))) {
        localMatch.memberProfileIds = [...(localMatch.memberProfileIds || []), profile.id];
        addMemberProfileIdToClub(localMatch.id, profile.id).catch(() => {});
      }
      saveClubLocally(localMatch);
      setActiveClubId(localMatch.id);
      emitClubUpdated(localMatch, 'joined');
      // Background refresh from Firestore
      fetchClubFromFirestore(localMatch.id).then((freshRes) => {
        if (freshRes.success && freshRes.club) {
          saveClubLocally(freshRes.club);
          emitClubUpdated(freshRes.club, 'updated');
        }
      });
      return { success: true, club: localMatch };
    }

    // 2. Fetch from Firestore by code query
    const res = await fetchClubByCodeFromFirestore(cleanCode);
    if (!res.success || !res.club) {
      return {
        success: false,
        error: res.error || `No club found with code ${cleanCode}`,
      };
    }

    const foundClub = res.club;
    if (profile?.id && (!foundClub.memberProfileIds || !foundClub.memberProfileIds.includes(profile.id))) {
      foundClub.memberProfileIds = [...(foundClub.memberProfileIds || []), profile.id];
      addMemberProfileIdToClub(foundClub.id, profile.id).catch(() => {});
    }

    saveClubLocally(foundClub);
    setActiveClubId(foundClub.id);
    emitClubUpdated(foundClub, 'joined');

    return { success: true, club: foundClub };
  } catch (err: any) {
    console.error('joinClubByCode error:', err);
    return { success: false, error: err?.message || 'Failed to join club' };
  }
}

/**
 * Get the currently active Club document (from local cache, with background cloud refresh)
 */
export async function getActiveClub(): Promise<Club | null> {
  const activeId = getActiveClubId();
  if (!activeId) return null;

  const localClubs = getSavedClubsLocally();
  const localMatch = localClubs.find((c) => c.id === activeId) || null;

  // Attempt background sync if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    fetchClubFromFirestore(activeId)
      .then((res) => {
        if (res.success && res.club) {
          saveClubLocally(res.club);
          emitClubUpdated(res.club, 'updated');
        }
      })
      .catch(() => {});
  }

  return localMatch;
}

/**
 * Link a session to a club (both in Firestore and locally)
 */
export async function linkSessionToClub(
  sessionId: string,
  clubId?: string
): Promise<boolean> {
  const targetClubId = clubId || getActiveClubId();
  const cleanSessionId = sanitizeSessionCode(sessionId);
  if (!targetClubId || !cleanSessionId) return false;

  try {
    // 1. Update Firestore club document
    addSessionIdToClub(targetClubId, cleanSessionId).catch((err) => {
      console.warn('addSessionIdToClub background note:', err);
    });

    // 2. Update local club cache
    const clubs = getSavedClubsLocally();
    const club = clubs.find((c) => c.id === targetClubId);
    if (club) {
      if (!club.sessionIds) club.sessionIds = [];
      if (!club.sessionIds.includes(cleanSessionId)) {
        club.sessionIds.unshift(cleanSessionId);
        club.updatedAt = Date.now();
        saveClubLocally(club);
        emitClubUpdated(club, 'updated');
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Add a player profile to a club's member roster
 */
export async function addMemberToClub(
  profileId: string,
  clubId?: string
): Promise<boolean> {
  const targetClubId = clubId || getActiveClubId();
  const cleanProfileId = (profileId || '').trim();
  if (!targetClubId || !cleanProfileId) return false;

  try {
    addMemberProfileIdToClub(targetClubId, cleanProfileId).catch(() => {});

    const clubs = getSavedClubsLocally();
    const club = clubs.find((c) => c.id === targetClubId);
    if (club) {
      if (!club.memberProfileIds) club.memberProfileIds = [];
      if (!club.memberProfileIds.includes(cleanProfileId)) {
        club.memberProfileIds.push(cleanProfileId);
        club.updatedAt = Date.now();
        saveClubLocally(club);
        emitClubUpdated(club, 'updated');
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Fetch all session documents owned by a club
 */
export async function fetchClubSessions(clubId: string): Promise<SessionData[]> {
  try {
    const clubRes = await fetchClubFromFirestore(clubId);
    const sessionIds = clubRes.club?.sessionIds || [];
    if (sessionIds.length === 0) return [];

    const results: SessionData[] = [];
    for (const sid of sessionIds) {
      try {
        const sRes = await fetchSessionFromFirestore(sid);
        if (sRes.success && sRes.session) {
          results.push(sRes.session);
        }
      } catch {}
    }
    return results;
  } catch (err) {
    console.error('fetchClubSessions error:', err);
    return [];
  }
}

/**
 * Subscribe to real-time updates for a club
 */
export function subscribeToActiveClub(
  clubId: string,
  onData: (club: Club) => void
): Unsubscribe {
  return subscribeToClubFirestore(
    clubId,
    (freshClub) => {
      saveClubLocally(freshClub);
      onData(freshClub);
    },
    (err) => {
      console.warn('Club subscription notice:', err);
    }
  );
}
