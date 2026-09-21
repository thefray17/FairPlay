import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, User } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  arrayUnion,
  onSnapshot,
  collection,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import rawConfig from '../../firebase-applet-config.json';
import { SessionData } from '../utils/sessionSync';
import { Club, PlayerProfile } from '../types';

// Merge with user-specified custom parameters like databaseURL and measurementId
export const firebaseConfig = {
  ...rawConfig,
  databaseURL:
    (rawConfig as any).databaseURL ||
    'https://debt-ledger-c4c93-default-rtdb.asia-southeast1.firebasedatabase.app',
  measurementId: (rawConfig as any).measurementId || 'G-X889YVRPEC',
};

// Singleton initialization
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Auth instance for accounts/profiles and device session ownership
export const auth = getAuth(app);

// Anonymous auth helper to authenticate client device without requiring intrusive signup
let authInitPromise: Promise<User | null> | null = null;
export async function ensureFirebaseAuth(): Promise<User | null> {
  if (typeof window === 'undefined') return null;
  if (auth.currentUser) return auth.currentUser;

  if (!authInitPromise) {
    authInitPromise = signInAnonymously(auth)
      .then((cred) => cred.user)
      .catch((err) => {
        console.warn('Anonymous Firebase auth notice:', err);
        return auth.currentUser || null;
      });
  }
  return authInitPromise;
}

// Auto-initialize anonymous auth on browser load
if (typeof window !== 'undefined') {
  ensureFirebaseAuth().catch(() => {});
}

// Firestore instance targeting provisioned database
export const db = rawConfig.firestoreDatabaseId
  ? getFirestore(app, rawConfig.firestoreDatabaseId)
  : getFirestore(app);

// Safe Analytics initialization (prevents crashing in server or unsupported environments)
export let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== 'undefined') {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch((err) => {
      console.debug('Firebase analytics not supported in this environment:', err);
    });
}

/**
 * User account profile interface for future account & club management
 */
export interface UserProfile {
  id: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: 'organizer' | 'player' | 'admin';
  clubName?: string;
  createdAt?: number;
  updatedAt?: number;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const err = error as { code?: string; message?: string };
  const authUser = auth.currentUser;
  const errorInfo: FirestoreErrorInfo = {
    error: err?.message || String(error),
    operationType,
    path,
    authInfo: {
      userId: authUser?.uid || null,
      email: authUser?.email || null,
      emailVerified: authUser?.emailVerified || null,
      isAnonymous: authUser?.isAnonymous || null,
      tenantId: authUser?.tenantId || null,
      providerInfo: authUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
  };
  throw new Error(JSON.stringify(errorInfo));
}

function cleanFirestoreData<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * Save or update session in Firestore with strict ownership and write token verification
 */
export async function saveSessionToFirestore(
  sessionId: string,
  data: Partial<SessionData>,
  organizerToken?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanId = sessionId.trim().toUpperCase();
    if (!cleanId) return { success: false, error: 'Invalid session ID' };

    if (!organizerToken) {
      return { success: false, error: 'Write denied: missing organizer token for Firestore save' };
    }

    // Authenticate device anonymously to satisfy request.auth if supported
    const user = await ensureFirebaseAuth();
    const sessionRef = doc(db, 'sessions', cleanId);

    const rawPayload: Record<string, any> = {
      ...data,
      id: cleanId,
      updatedAt: Date.now(),
      organizerToken,
    };

    if (user?.uid && !rawPayload.ownerUid) {
      rawPayload.ownerUid = user.uid;
    }

    const payload = cleanFirestoreData(rawPayload);
    await setDoc(sessionRef, payload, { merge: true });

    return { success: true };
  } catch (err: any) {
    console.warn('Firestore saveSession note:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to save session to Firestore' };
  }
}

/**
 * Fetch session from Firestore
 */
export async function fetchSessionFromFirestore(
  sessionId: string
): Promise<{ success: boolean; session?: SessionData; error?: string }> {
  try {
    const cleanId = sessionId.trim().toUpperCase();
    if (!cleanId) return { success: false, error: 'Invalid session ID' };

    const sessionRef = doc(db, 'sessions', cleanId);
    const snap = await getDoc(sessionRef);

    if (!snap.exists()) {
      return { success: false, error: `Session ${cleanId} not found in Firestore` };
    }

    return { success: true, session: snap.data() as SessionData };
  } catch (err: any) {
    console.error('Firestore fetchSession error:', err);
    return { success: false, error: err?.message || 'Failed to fetch session from Firestore' };
  }
}

/**
 * Real-time listener for session changes across organizer and player devices
 */
export function subscribeToSessionFirestore(
  sessionId: string,
  onData: (session: SessionData) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const cleanId = sessionId.trim().toUpperCase();
  const sessionRef = doc(db, 'sessions', cleanId);

  return onSnapshot(
    sessionRef,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as SessionData);
      }
    },
    (err) => {
      console.warn('Firestore onSnapshot listener error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Save user profile (foundation for accounts/profiles)
 */
export async function saveUserProfile(
  profile: UserProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!profile.id) return { success: false, error: 'User ID is required' };
    const userRef = doc(db, 'users', profile.id);
    await setDoc(
      userRef,
      {
        ...profile,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save profile' };
  }
}

/**
 * Fetch user profile
 */
export async function getUserProfile(
  userId: string
): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      return { success: false, error: 'Profile not found' };
    }
    return { success: true, profile: snap.data() as UserProfile };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to fetch profile' };
  }
}

/**
 * Save or update PlayerProfile document in Firestore
 */
export async function savePlayerProfileToFirestore(
  profile: PlayerProfile
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!profile.id) return { success: false, error: 'Profile ID is required' };
    const profileRef = doc(db, 'playerProfiles', profile.id);
    const payload = cleanFirestoreData({
      ...profile,
      updatedAt: Date.now(),
      createdAt: profile.createdAt || Date.now(),
      matchesPlayed: profile.matchesPlayed ?? 0,
      wins: profile.wins ?? 0,
      losses: profile.losses ?? 0,
    });
    await setDoc(profileRef, payload, { merge: true });
    return { success: true };
  } catch (err: any) {
    console.warn('savePlayerProfileToFirestore error:', err);
    return { success: false, error: err?.message || 'Failed to save player profile' };
  }
}

/**
 * Fetch a PlayerProfile document by its unique ID
 */
export async function fetchPlayerProfileFromFirestore(
  profileId: string
): Promise<{ success: boolean; profile?: PlayerProfile; error?: string }> {
  try {
    const cleanId = profileId.trim();
    if (!cleanId) return { success: false, error: 'Invalid profile ID' };
    const profileRef = doc(db, 'playerProfiles', cleanId);
    const snap = await getDoc(profileRef);
    if (!snap.exists()) {
      return { success: false, error: `Profile ${cleanId} not found` };
    }
    return { success: true, profile: snap.data() as PlayerProfile };
  } catch (err: any) {
    console.error('fetchPlayerProfileFromFirestore error:', err);
    return { success: false, error: err?.message || 'Failed to fetch player profile' };
  }
}

/**
 * Fetch all player profiles from Firestore
 */
export async function fetchAllPlayerProfilesFromFirestore(): Promise<Record<string, PlayerProfile>> {
  const result: Record<string, PlayerProfile> = {};
  try {
    const q = query(collection(db, 'playerProfiles'));
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      if (docSnap.exists()) {
        result[docSnap.id] = docSnap.data() as PlayerProfile;
      }
    });
  } catch (err) {
    console.warn('fetchAllPlayerProfilesFromFirestore error:', err);
  }
  return result;
}

/**
 * Batch fetch multiple player profiles by their IDs
 */
export async function fetchPlayerProfilesByIds(
  profileIds: string[]
): Promise<Record<string, PlayerProfile>> {
  const result: Record<string, PlayerProfile> = {};
  if (!profileIds || profileIds.length === 0) return result;

  try {
    const promises = profileIds.map(async (id) => {
      if (!id) return;
      const res = await fetchPlayerProfileFromFirestore(id);
      if (res.success && res.profile) {
        result[id] = res.profile;
      }
    });
    await Promise.all(promises);
  } catch (err) {
    console.warn('Error batch fetching player profiles:', err);
  }
  return result;
}

/**
 * Record completed match results directly into playerProfiles in Firestore,
 * enabling cross-session career stats aggregation!
 */
export async function updatePlayerProfilesMatchStats(
  winnerProfileIds: string[],
  loserProfileIds: string[]
): Promise<void> {
  const allIds = Array.from(new Set([...winnerProfileIds, ...loserProfileIds])).filter(Boolean);
  if (allIds.length === 0) return;

  try {
    await Promise.all(
      allIds.map(async (pId) => {
        const isWinner = winnerProfileIds.includes(pId);
        const isLoser = loserProfileIds.includes(pId);
        const snap = await getDoc(doc(db, 'playerProfiles', pId));
        if (snap.exists()) {
          const data = snap.data() as PlayerProfile;
          await setDoc(
            doc(db, 'playerProfiles', pId),
            {
              matchesPlayed: (data.matchesPlayed || 0) + 1,
              wins: (data.wins || 0) + (isWinner ? 1 : 0),
              losses: (data.losses || 0) + (isLoser ? 1 : 0),
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        }
      })
    );
  } catch (err) {
    console.warn('Failed to update player profiles match stats in Firestore:', err);
  }
}

/**
 * Save or update Club document in Firestore
 */
export async function saveClubToFirestore(
  club: Club
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!club.id) return { success: false, error: 'Club ID is required' };
    const clubRef = doc(db, 'clubs', club.id);
    const payload = cleanFirestoreData({
      ...club,
      updatedAt: Date.now(),
    });
    await setDoc(clubRef, payload, { merge: true });
    return { success: true };
  } catch (err: any) {
    console.warn('saveClubToFirestore error:', err);
    return { success: false, error: err?.message || 'Failed to save club' };
  }
}

/**
 * Fetch a Club document by its unique ID
 */
export async function fetchClubFromFirestore(
  clubId: string
): Promise<{ success: boolean; club?: Club; error?: string }> {
  try {
    const cleanId = clubId.trim();
    if (!cleanId) return { success: false, error: 'Invalid club ID' };
    const clubRef = doc(db, 'clubs', cleanId);
    const snap = await getDoc(clubRef);
    if (!snap.exists()) {
      return { success: false, error: `Club ${cleanId} not found` };
    }
    return { success: true, club: snap.data() as Club };
  } catch (err: any) {
    console.error('fetchClubFromFirestore error:', err);
    return { success: false, error: err?.message || 'Failed to fetch club' };
  }
}

/**
 * Query a Club by its short 4-digit join code
 */
export async function fetchClubByCodeFromFirestore(
  code: string
): Promise<{ success: boolean; club?: Club; error?: string }> {
  try {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return { success: false, error: 'Join code is required' };
    const clubsRef = collection(db, 'clubs');
    const q = query(clubsRef, where('code', '==', cleanCode));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: false, error: `No club found with join code "${cleanCode}"` };
    }

    const docSnap = querySnapshot.docs[0];
    return { success: true, club: docSnap.data() as Club };
  } catch (err: any) {
    console.error('fetchClubByCodeFromFirestore error:', err);
    return { success: false, error: err?.message || 'Failed to look up club code' };
  }
}

/**
 * Real-time listener for a Club document
 */
export function subscribeToClubFirestore(
  clubId: string,
  onData: (club: Club) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const cleanId = clubId.trim();
  const clubRef = doc(db, 'clubs', cleanId);

  return onSnapshot(
    clubRef,
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as Club);
      }
    },
    (err) => {
      console.warn('subscribeToClubFirestore error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Attach a Session ID to a Club's sessionIds array
 */
export async function addSessionIdToClub(
  clubId: string,
  sessionId: string
): Promise<boolean> {
  try {
    const cleanClubId = clubId.trim();
    const cleanSessionId = sessionId.trim().toUpperCase();
    if (!cleanClubId || !cleanSessionId) return false;

    const clubRef = doc(db, 'clubs', cleanClubId);
    await updateDoc(clubRef, {
      sessionIds: arrayUnion(cleanSessionId),
      updatedAt: Date.now(),
    });
    return true;
  } catch (err) {
    console.warn('addSessionIdToClub note:', err);
    // If updateDoc failed because document needs creation or merge
    try {
      const fetchRes = await fetchClubFromFirestore(clubId);
      if (fetchRes.success && fetchRes.club) {
        const existing = fetchRes.club.sessionIds || [];
        if (!existing.includes(sessionId)) {
          await saveClubToFirestore({
            ...fetchRes.club,
            sessionIds: [...existing, sessionId],
          });
          return true;
        }
      }
    } catch {}
    return false;
  }
}

/**
 * Add a member profile ID to a Club's memberProfileIds array
 */
export async function addMemberProfileIdToClub(
  clubId: string,
  profileId: string
): Promise<boolean> {
  try {
    const cleanClubId = clubId.trim();
    const cleanProfileId = profileId.trim();
    if (!cleanClubId || !cleanProfileId) return false;

    const clubRef = doc(db, 'clubs', cleanClubId);
    await updateDoc(clubRef, {
      memberProfileIds: arrayUnion(cleanProfileId),
      updatedAt: Date.now(),
    });
    return true;
  } catch (err) {
    console.warn('addMemberProfileIdToClub note:', err);
    return false;
  }
}

