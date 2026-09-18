import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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

// Auth instance for future accounts/profiles
export const auth = getAuth(app);

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

/**
 * Save or update session in Firestore
 */
export async function saveSessionToFirestore(
  sessionId: string,
  data: Partial<SessionData>
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanId = sessionId.trim().toUpperCase();
    if (!cleanId) return { success: false, error: 'Invalid session ID' };

    const sessionRef = doc(db, 'sessions', cleanId);
    await setDoc(
      sessionRef,
      {
        ...data,
        id: cleanId,
        updatedAt: Date.now(),
        serverTimestamp: serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true };
  } catch (err: any) {
    console.error('Firestore saveSession error:', err);
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
