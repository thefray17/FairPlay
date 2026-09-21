import { PlayerProfile } from '../types';
import {
  ensureFirebaseAuth,
  savePlayerProfileToFirestore,
  fetchPlayerProfileFromFirestore,
  auth,
} from '../lib/firebase';
import { AVATAR_COLORS } from './sampleData';

export const DEVICE_IDENTITY_KEYS = {
  PROFILE_ID: 'fairplay_device_profile_id_v1',
  PROFILE_DATA: 'fairplay_device_profile_data_v1',
  PROMPTED_ONCE: 'fairplay_identity_prompted_once_v1',
};

export const IDENTITY_UPDATED_EVENT = 'fairplay:identity-updated';

/**
 * Dispatches an event when the device's identity profile is initialized or updated
 */
export function emitIdentityUpdate(profile: PlayerProfile | null) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(IDENTITY_UPDATED_EVENT, {
          detail: { profile, timestamp: Date.now() },
        })
      );
    } catch {}
  }
}

/**
 * Retrieve the current device's saved PlayerProfile from localStorage
 */
export function getDevicePlayerProfile(): PlayerProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEVICE_IDENTITY_KEYS.PROFILE_DATA);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.id && parsed.name) {
      return parsed as PlayerProfile;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if the user has already been prompted for display name
 */
export function hasBeenPromptedForIdentity(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DEVICE_IDENTITY_KEYS.PROMPTED_ONCE) === 'true';
  } catch {
    return false;
  }
}

export function markPromptedForIdentity() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEVICE_IDENTITY_KEYS.PROMPTED_ONCE, 'true');
  } catch {}
}

/**
 * Save device profile locally and sync to Firestore
 */
export async function saveDevicePlayerProfile(
  profile: PlayerProfile
): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'Window not available' };
  try {
    localStorage.setItem(DEVICE_IDENTITY_KEYS.PROFILE_ID, profile.id);
    localStorage.setItem(DEVICE_IDENTITY_KEYS.PROFILE_DATA, JSON.stringify(profile));
    markPromptedForIdentity();
    emitIdentityUpdate(profile);

    // Save to Firestore asynchronously
    const firestoreRes = await savePlayerProfileToFirestore(profile);
    if (!firestoreRes.success) {
      console.warn('Could not sync player profile to Firestore immediately:', firestoreRes.error);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save profile' };
  }
}

/**
 * On first launch: silently ensure anonymous auth and register the device's display name
 */
export async function initDeviceIdentity(
  displayName: string,
  options?: {
    avatarColor?: string;
    clubId?: string;
  }
): Promise<{ success: boolean; profile?: PlayerProfile; error?: string }> {
  try {
    const cleanName = displayName.trim();
    if (!cleanName) {
      return { success: false, error: 'Display name cannot be empty' };
    }

    // 1. Silently authenticate anonymously via Firebase
    const user = await ensureFirebaseAuth();
    const authUid = user?.uid || auth.currentUser?.uid;

    // Use auth UID if available, else standard profile ID
    const profileId = authUid
      ? `prof_${authUid}`
      : `prof_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Existing profile check if user already had one saved
    const existing = getDevicePlayerProfile();

    const chosenColor =
      options?.avatarColor ||
      existing?.avatarColor ||
      AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const profile: PlayerProfile = {
      id: profileId,
      name: cleanName,
      authUid: authUid,
      avatarColor: chosenColor,
      matchesPlayed: existing?.matchesPlayed || 0,
      wins: existing?.wins || 0,
      losses: existing?.losses || 0,
      clubIds: options?.clubId ? [options.clubId] : existing?.clubIds || [],
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    const saveRes = await saveDevicePlayerProfile(profile);
    if (!saveRes.success) {
      return { success: false, error: saveRes.error };
    }

    return { success: true, profile };
  } catch (err: any) {
    console.error('initDeviceIdentity error:', err);
    return { success: false, error: err?.message || 'Failed to initialize identity' };
  }
}

/**
 * Helper to ensure any newly created Player or OpenPlayPlayer gets a valid playerProfileId.
 * - If the player's name matches the current device profile, assign the device's profile ID!
 * - If it's a new player in a club session, generate a unique playerProfileId and create
 *   a playerProfiles document in Firestore so their career stats can be tracked across sessions.
 */
export async function ensurePlayerProfileId(
  playerName: string,
  options?: {
    avatarColor?: string;
    clubId?: string;
  }
): Promise<{ playerProfileId: string; isDeviceUser: boolean }> {
  const cleanName = playerName.trim();
  const deviceProfile = getDevicePlayerProfile();

  // If this player matches the device's own display name, attach device playerProfileId
  if (deviceProfile && deviceProfile.name.toLowerCase() === cleanName.toLowerCase()) {
    return {
      playerProfileId: deviceProfile.id,
      isDeviceUser: true,
    };
  }

  // Otherwise, generate a dedicated playerProfileId and persist to Firestore
  const generatedId = `prof_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newProfile: PlayerProfile = {
    id: generatedId,
    name: cleanName,
    avatarColor: options?.avatarColor || AVATAR_COLORS[0],
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    clubIds: options?.clubId ? [options.clubId] : [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Asynchronously save to Firestore (non-blocking)
  savePlayerProfileToFirestore(newProfile).catch((err) => {
    console.warn('Background save of new player profile notice:', err);
  });

  return {
    playerProfileId: generatedId,
    isDeviceUser: false,
  };
}
