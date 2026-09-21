import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, User } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import rawConfig from '../../firebase-applet-config.json';
import { SessionData } from '../utils/sessionSync';

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
