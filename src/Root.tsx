import React, { useState, useEffect } from 'react';
import App from './App';
import { OpenPlayPage } from './components/openplay/OpenPlayPage';
import { NotFoundPage } from './components/common/NotFoundPage';
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
  saveSessionOfflineCache,
  getOfflineSession,
  loadAndApplySession,
  SESSION_LOADED_EVENT,
} from './utils/sessionSync';

export function Root() {
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname;
    }
    return '/';
  });

  const [sessionId, setSessionId] = useState(() => {
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
    saveSessionOfflineCache(newId, {
      id: newId,
      players: INITIAL_PLAYERS,
      rounds: [],
      organizerToken: token,
      updatedAt: Date.now(),
    });
    return newId;
  });

  const [socialPlayers, setSocialPlayers] = useState<Player[]>(() => {
    try {
      const cached = getOfflineSession(sessionId);
      if (cached && Array.isArray(cached.players)) {
        const seen2 = new Set();
        return cached.players.filter((p) => {
          if (!p || !p.id || seen2.has(p.id)) return false;
          if (p.id.startsWith('op-')) return false;
          seen2.add(p.id);
          return true;
        });
      }
      const saved = localStorage.getItem(SOCIAL_STORAGE_KEYS.PLAYERS);
      const parsed = saved ? JSON.parse(saved) : INITIAL_PLAYERS;
      const seen = new Set();
      return parsed.filter((p: Player) => {
        if (!p || !p.id || seen.has(p.id)) return false;
        if (p.id.startsWith('op-')) return false;
        seen.add(p.id);
        return true;
      });
    } catch {
      return INITIAL_PLAYERS;
    }
  });

  const [openPlayPlayers, setOpenPlayPlayers] = useState<Player[]>(() => {
    try {
      const cached = getOfflineSession(sessionId);
      if (cached?.openPlay?.players && Array.isArray(cached.openPlay.players)) {
        const seen2 = new Set();
        return cached.openPlay.players.filter((p) => {
          if (!p || !p.id || seen2.has(p.id)) return false;
          if (p.id.startsWith('op-')) return false;
          seen2.add(p.id);
          return true;
        });
      }
      if (cached?.players && Array.isArray(cached.players)) {
        const seen2 = new Set();
        return cached.players.filter((p) => {
          if (!p || !p.id || seen2.has(p.id)) return false;
          if (p.id.startsWith('op-')) return false;
          seen2.add(p.id);
          return true;
        });
      }
      const saved = localStorage.getItem(OPENPLAY_STORAGE_KEYS.PLAYERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        const seen2 = new Set();
        return parsed.filter((p: Player) => {
          if (!p || !p.id || seen2.has(p.id)) return false;
          if (p.id.startsWith('op-')) return false;
          seen2.add(p.id);
          return true;
        });
      }
      const socialSaved = localStorage.getItem(SOCIAL_STORAGE_KEYS.PLAYERS);
      const parsedSocial = socialSaved ? JSON.parse(socialSaved) : INITIAL_PLAYERS;
      const seen = new Set();
      return parsedSocial.filter((p: Player) => {
        if (!p || !p.id || seen.has(p.id)) return false;
        if (p.id.startsWith('op-')) return false;
        seen.add(p.id);
        return true;
      });
    } catch {
      return INITIAL_PLAYERS;
    }
  });

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

  useEffect(() => {
    const handleSessionLoaded = (e: Event) => {
      const ce = e as CustomEvent<{ session: any }>;
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

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SOCIAL_STORAGE_KEYS.PLAYERS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setSocialPlayers(parsed.filter((p: Player) => p && !p.id.startsWith('op-')));
        } catch {}
      }
      if (e.key === OPENPLAY_STORAGE_KEYS.PLAYERS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setOpenPlayPlayers(parsed.filter((p: Player) => p && !p.id.startsWith('op-')));
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
              const parsed = JSON.parse(savedSocial);
              setSocialPlayers(parsed.filter((p: Player) => p && !p.id.startsWith('op-')));
            }
          }
        }
        if (!ce.detail || ce.detail.source === 'openplay') {
          if (ce.detail?.updatedPlayers) {
            setOpenPlayPlayers(ce.detail.updatedPlayers.filter((p) => p && !p.id.startsWith('op-')));
          } else {
            const savedOpenPlay = localStorage.getItem(OPENPLAY_STORAGE_KEYS.PLAYERS);
            if (savedOpenPlay) {
              const parsed = JSON.parse(savedOpenPlay);
              setOpenPlayPlayers(parsed.filter((p: Player) => p && !p.id.startsWith('op-')));
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

  const handleNavigateSession = (newSessionId: string) => {
    const clean = sanitizeSessionCode(newSessionId);
    if (!clean) return;
    setSessionId(clean);
    navigateTo(`/?session=${encodeURIComponent(clean)}`);
    loadAndApplySession(clean).catch(() => {});
  };

  const normalizedPath = currentPath.toLowerCase().split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  const isOpenPlay = normalizedPath === '/openplay' || normalizedPath.startsWith('/openplay/') || normalizedPath === '/queue';
  const isSocial = normalizedPath === '/' || normalizedPath === '/index.html' || normalizedPath === '/social' || normalizedPath === '/tournament' || normalizedPath === '/matches' || normalizedPath === '/schedule' || normalizedPath.startsWith('/s/') || normalizedPath.startsWith('/session/') || normalizedPath.startsWith('/join/');

  if (!isOpenPlay && !isSocial) {
    return (
      <NotFoundPage
        currentPath={currentPath}
        onNavigateHome={() => navigateTo('/')}
        onNavigateOpenPlay={() => navigateTo('/openplay')}
        onNavigateSession={handleNavigateSession}
      />
    );
  }

  return isOpenPlay ? (
    <OpenPlayPage
      onNavigateToSocial={() => navigateTo('/')}
      socialPlayers={openPlayPlayers}
      setSocialPlayers={setOpenPlayPlayers}
      onPullFromSocial={handleOverwriteOpenPlayWithSocial}
      sessionId={sessionId}
      setSessionId={setSessionId}
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
  );
}
