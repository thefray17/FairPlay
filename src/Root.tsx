import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Player } from './types';
import { INITIAL_PLAYERS } from './utils/sampleData';
import { SOCIAL_STORAGE_KEYS, emitRosterSync } from './utils/playerSync';
import { OPENPLAY_STORAGE_KEYS } from './utils/openPlay';
import {
  extractSessionId,
  sanitizeSessionCode,
  generateSessionId,
  generateOrganizerToken,
  setOrganizerToken,
  loadAndApplySession,
  SESSION_LOADED_EVENT,
  SessionData,
} from './utils/sessionSync';

const App = lazy(() => import('./App'));
const OpenPlayPage = lazy(() =>
  import('./components/openplay/OpenPlayPage').then((m) => ({ default: m.OpenPlayPage }))
);

export function Root() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });

  // Social Tournament players state
  const [socialPlayers, setSocialPlayers] = useState<Player[]>(() => {
    try {
      const saved = localStorage.getItem(SOCIAL_STORAGE_KEYS.PLAYERS);
      const parsed: Player[] = saved ? JSON.parse(saved) : INITIAL_PLAYERS;
      const seen = new Set<string>();
      return parsed.filter((p) => {
        if (!p || !p.id || seen.has(p.id)) return false;
        if (p.id.startsWith('op-')) return false;
        seen.add(p.id);
        return true;
      });
    } catch {
      return INITIAL_PLAYERS;
    }
  });

  // Open Play players state
  const [openPlayPlayers, setOpenPlayPlayers] = useState<Player[]>(() => {
    try {
      const saved = localStorage.getItem(OPENPLAY_STORAGE_KEYS.PLAYERS);
      if (saved) {
        const parsed: Player[] = JSON.parse(saved);
        const seen = new Set<string>();
        return parsed.filter((p) => {
          if (!p || !p.id || seen.has(p.id)) return false;
          if (p.id.startsWith('op-')) return false;
          seen.add(p.id);
          return true;
        });
      }
      
      // Fallback: copy social players if no Open Play players exist yet
      const socialSaved = localStorage.getItem(SOCIAL_STORAGE_KEYS.PLAYERS);
      const parsedSocial: Player[] = socialSaved ? JSON.parse(socialSaved) : INITIAL_PLAYERS;
      const seen = new Set<string>();
      return parsedSocial.filter((p) => {
        if (!p || !p.id || seen.has(p.id)) return false;
        if (p.id.startsWith('op-')) return false;
        seen.add(p.id);
        return true;
      });
    } catch {
      return INITIAL_PLAYERS;
    }
  });

  // Unified Session ID for both Social Tournament and Open Play (User-friendly 4-digit PIN)
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const extracted = extractSessionId(window.location.href);
        if (extracted) return extracted;
      }
      const saved = localStorage.getItem('fairclub_session_id_v1');
      if (saved && saved.trim()) {
        const clean = sanitizeSessionCode(saved);
        if (clean) return clean;
      }
    } catch {}
    const newId = generateSessionId();
    const token = generateOrganizerToken();
    setOrganizerToken(newId, token);
    return newId;
  });

  // Auto-fetch if opened with a session link or QR code from another device
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetSession = extractSessionId(window.location.href);
    if (targetSession) {
      loadAndApplySession(targetSession).then((res) => {
        if (res.success && res.session) {
          const s = res.session;
          if (s.id) setSessionId(s.id);
          if (s.players && Array.isArray(s.players)) {
            setSocialPlayers(s.players);
          }
          if (s.openPlay?.players && Array.isArray(s.openPlay.players)) {
            setOpenPlayPlayers(s.openPlay.players);
          } else if (s.players && Array.isArray(s.players)) {
            setOpenPlayPlayers(s.players);
          }
        }
      });
    }
  }, []);

  // Listen for global session loaded events from any modal or component
  useEffect(() => {
    const handleSessionLoaded = (e: Event) => {
      const ce = e as CustomEvent<{ session: SessionData }>;
      const s = ce.detail?.session;
      if (s) {
        if (s.id) setSessionId(s.id);
        if (s.players && Array.isArray(s.players)) {
          setSocialPlayers(s.players);
        }
        if (s.openPlay?.players && Array.isArray(s.openPlay.players)) {
          setOpenPlayPlayers(s.openPlay.players);
        } else if (s.players && Array.isArray(s.players)) {
          setOpenPlayPlayers(s.players);
        }
      }
    };

    window.addEventListener(SESSION_LOADED_EVENT, handleSessionLoaded);
    return () => window.removeEventListener(SESSION_LOADED_EVENT, handleSessionLoaded);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('fairclub_session_id_v1', sessionId);
    } catch {}
  }, [sessionId]);

  // Persist players to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem(SOCIAL_STORAGE_KEYS.PLAYERS, JSON.stringify(socialPlayers));
    } catch (err) {
      console.error('Failed to save social players', err);
    }
  }, [socialPlayers]);

  useEffect(() => {
    try {
      localStorage.setItem(OPENPLAY_STORAGE_KEYS.PLAYERS, JSON.stringify(openPlayPlayers));
    } catch (err) {
      console.error('Failed to save open play players', err);
    }
  }, [openPlayPlayers]);

  // Sync when another component or tab updates the roster
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SOCIAL_STORAGE_KEYS.PLAYERS && e.newValue) {
        try {
          const parsed: Player[] = JSON.parse(e.newValue);
          setSocialPlayers(parsed.filter((p) => p && !p.id.startsWith('op-')));
        } catch {}
      }
      if (e.key === OPENPLAY_STORAGE_KEYS.PLAYERS && e.newValue) {
        try {
          const parsed: Player[] = JSON.parse(e.newValue);
          setOpenPlayPlayers(parsed.filter((p) => p && !p.id.startsWith('op-')));
        } catch {}
      }
    };

    const handleRosterSync = (e: Event) => {
      const ce = e as CustomEvent<{ source: string; updatedPlayers?: Player[] }>;
      try {
        if (!ce.detail || ce.detail.source === 'social') {
          if (ce.detail?.updatedPlayers) {
            setSocialPlayers(ce.detail.updatedPlayers.filter((p) => p && !p.id.startsWith('op-')));
          } else {
            const savedSocial = localStorage.getItem(SOCIAL_STORAGE_KEYS.PLAYERS);
            if (savedSocial) {
              const parsed: Player[] = JSON.parse(savedSocial);
              setSocialPlayers(parsed.filter((p) => p && !p.id.startsWith('op-')));
            }
          }
        }
        if (!ce.detail || ce.detail.source === 'openplay') {
          if (ce.detail?.updatedPlayers) {
            setOpenPlayPlayers(ce.detail.updatedPlayers.filter((p) => p && !p.id.startsWith('op-')));
          } else {
            const savedOpenPlay = localStorage.getItem(OPENPLAY_STORAGE_KEYS.PLAYERS);
            if (savedOpenPlay) {
              const parsed: Player[] = JSON.parse(savedOpenPlay);
              setOpenPlayPlayers(parsed.filter((p) => p && !p.id.startsWith('op-')));
            }
          }
        }
      } catch {}
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('fairplay:sync-roster', handleRosterSync);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('fairplay:sync-roster', handleRosterSync);
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
      window.scrollTo(0, 0);
    }
  };

  const handleOverwriteOpenPlayWithSocial = () => {
    // Make a deep copy to ensure reference change
    const newOpenPlayRoster = JSON.parse(JSON.stringify(socialPlayers));
    setOpenPlayPlayers(newOpenPlayRoster);
    try {
      localStorage.setItem(OPENPLAY_STORAGE_KEYS.PLAYERS, JSON.stringify(newOpenPlayRoster));
    } catch {}
    emitRosterSync('openplay', newOpenPlayRoster);
  };

  const handleOverwriteSocialWithOpenPlay = () => {
    const newSocialRoster = JSON.parse(JSON.stringify(openPlayPlayers));
    setSocialPlayers(newSocialRoster);
    try {
      localStorage.setItem(SOCIAL_STORAGE_KEYS.PLAYERS, JSON.stringify(newSocialRoster));
    } catch {}
    emitRosterSync('social', newSocialRoster);
  };

  const isOpenPlay = currentPath.toLowerCase().startsWith('/openplay');

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-400 font-medium text-sm">Loading court view...</p>
        </div>
      }
    >
      {isOpenPlay ? (
        <OpenPlayPage
          onNavigateToSocial={() => navigateTo('/')}
          socialPlayers={openPlayPlayers}
          setSocialPlayers={setOpenPlayPlayers}
          onPullFromSocial={handleOverwriteOpenPlayWithSocial}
          sessionId={sessionId}
        />
      ) : (
        <App
          onNavigateToOpenPlay={() => navigateTo('/openplay')}
          players={socialPlayers}
          setPlayers={setSocialPlayers}
          onPullFromOpenPlay={handleOverwriteSocialWithOpenPlay}
          sessionId={sessionId}
          setSessionId={setSessionId}
        />
      )}
    </Suspense>
  );
}
