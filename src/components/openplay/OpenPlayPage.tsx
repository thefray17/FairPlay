import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  OpenPlayPlayer,
  OpenPlayMatch,
  OpenPlayConfig,
  OpenPlayNotification
} from '../../types/openPlay';
import { Player } from '../../types';
import {
  OPENPLAY_STORAGE_KEYS,
  DEFAULT_OPENPLAY_CONFIG,
  generateNextMatchWithBuckets,
  completeOpenPlayMatchWithBuckets,
  dispatchAvailableCourtsWithBuckets,
  cyclePartnerSplit,
} from '../../utils/openPlay';
import {
  convertSocialToOpenPlay,
  getStoredSocialPlayers,
  setStoredSocialPlayers,
  syncSquadBidirectional,
  emitRosterSync,
  ROSTER_SYNC_EVENT,
} from '../../utils/playerSync';
import { AVATAR_COLORS } from '../../utils/sampleData';
import { OpenPlayNavbar } from './OpenPlayNavbar';
import { OpenPlayCourtCard } from './OpenPlayCourtCard';
import { OpenPlayQueueBoard } from './OpenPlayQueueBoard';
import { OpenPlayFinishModal } from './OpenPlayFinishModal';
import { OpenPlayHistory } from './OpenPlayHistory';
import { OpenPlayLeaderboard } from './OpenPlayLeaderboard';
import { OpenPlayConfigModal } from './OpenPlayConfigModal';
import { OpenPlayResetModal } from './OpenPlayResetModal';
import { OpenPlayMobileBottomNav, OpenPlayTabType } from './OpenPlayMobileBottomNav';
import { EditLineupModal } from '../EditLineupModal';
import { TransferSessionModal } from '../TransferSessionModal';
import {
  saveSessionToCloud,
  fetchSessionFromCloud,
  loadAndApplySession,
  extractSessionId,
  sanitizeSessionCode,
  generateSessionId,
  generateOrganizerToken,
  setOrganizerToken,
  applyOpenPlayData,
  emitOpenPlayCloudSynced,
  OpenPlaySessionData,
  SESSION_LOADED_EVENT,
  SessionData,
} from '../../utils/sessionSync';
import { soundFx } from '../../utils/audio';
import { ArrowRightLeft, Play, X, Zap, Users, AlertCircle } from 'lucide-react';
import { ensurePlayerProfileId } from '../../utils/identitySync';
import { updatePlayerProfilesMatchStats } from '../../lib/firebase';
import { getActiveClub } from '../../utils/clubSync';

interface OpenPlayPageProps {
  onNavigateToSocial: () => void;
  socialPlayers?: Player[];
  setSocialPlayers?: React.Dispatch<React.SetStateAction<Player[]>>;
  sessionId?: string;
  onOpenTransfer?: () => void;
  isSyncing?: boolean;
  onPullFromSocial?: () => void;
}

export const OpenPlayPage: React.FC<OpenPlayPageProps> = ({
  onNavigateToSocial,
  socialPlayers: externalSocialPlayers,
  setSocialPlayers: externalSetSocialPlayers,
  sessionId: externalSessionId,
  onOpenTransfer: externalOnOpenTransfer,
  isSyncing: externalIsSyncing,
  onPullFromSocial,
}) => {
  const [internalSessionId, setInternalSessionId] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const querySession = params.get('session') || params.get('s');
      if (querySession && querySession.trim()) {
        const clean = extractSessionId(querySession);
        if (clean) return clean;
      }
      const saved = localStorage.getItem('fairclub_session_id_v1');
      if (saved && saved.trim()) return sanitizeSessionCode(saved);
    } catch {}
    const newId = generateSessionId();
    const token = generateOrganizerToken();
    setOrganizerToken(newId, token);
    return newId;
  });

  const activeSessionId = externalSessionId || internalSessionId;

  const [internalIsSyncing, setInternalIsSyncing] = useState(false);
  const isSyncing = externalIsSyncing ?? internalIsSyncing;
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('fairplay_openplay_last_synced');
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Configuration
  const [config, setConfig] = useState<OpenPlayConfig>(() => {
    try {
      const saved = localStorage.getItem(OPENPLAY_STORAGE_KEYS.CONFIG);
      return saved ? JSON.parse(saved) : DEFAULT_OPENPLAY_CONFIG;
    } catch {
      return DEFAULT_OPENPLAY_CONFIG;
    }
  });

  // Social Players Roster
  const [internalSocialPlayers, setInternalSocialPlayers] = useState<Player[]>(() => {
    return getStoredSocialPlayers();
  });

  const socialPlayers = externalSocialPlayers ?? internalSocialPlayers;
  const setSocialPlayers = externalSetSocialPlayers ?? setInternalSocialPlayers;

  // Active Court Matches (courtNumber -> OpenPlayMatch)
  const [activeMatches, setActiveMatches] = useState<Record<number, OpenPlayMatch>>(() => {
    try {
      const saved = localStorage.getItem(OPENPLAY_STORAGE_KEYS.ACTIVE_MATCHES);
      if (saved) {
        const parsed: Record<number, OpenPlayMatch> = JSON.parse(saved);
        const cleaned: Record<number, OpenPlayMatch> = {};
        Object.entries(parsed).forEach(([k, match]) => {
          if (match && ![...match.team1, ...match.team2].some((id) => id.startsWith('op-'))) {
            cleaned[Number(k)] = match;
          }
        });
        return cleaned;
      }
    } catch {}
    return {};
  });

  // Match History
  const [history, setHistory] = useState<OpenPlayMatch[]>(() => {
    try {
      const saved = localStorage.getItem(OPENPLAY_STORAGE_KEYS.HISTORY);
      if (saved) {
        const parsed: OpenPlayMatch[] = JSON.parse(saved);
        return parsed.filter(
          (match) => ![...match.team1, ...match.team2].some((id) => id.startsWith('op-'))
        );
      }
    } catch {}
    return [];
  });

  // ----------------------------------------------------
  // THE 3 CORE BUCKETS (Persistent State)
  // 1. Winners Queue (FIFO)
  // 2. Losers Queue (FIFO)
  // 3. Resting Bench (All players start here until all have played!)
  // ----------------------------------------------------
  const [winnersQueue, setWinnersQueue] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('openplay_winners_queue_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [restingBench, setRestingBench] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('openplay_resting_bench_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    // Initial: all non-playing players start in the bench queue until all have played!
    const playingIds = new Set<string>();
    (Object.values(activeMatches) as (OpenPlayMatch | null | undefined)[]).forEach((m) => {
      if (m && m.status === 'in_progress') {
        [...m.team1, ...m.team2].forEach((id) => playingIds.add(id));
      }
    });
    return (socialPlayers || []).filter((p) => !playingIds.has(p.id)).map((p) => p.id);
  });

  const [losersQueue, setLosersQueue] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('openplay_losers_queue_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [nextQueueTurn, setNextQueueTurn] = useState<'winners' | 'losers'>(() => {
    try {
      const saved = localStorage.getItem(OPENPLAY_STORAGE_KEYS.NEXT_QUEUE_TURN);
      if (saved === 'winners' || saved === 'losers') return saved;
    } catch {}
    return config.nextQueueTurn || 'winners';
  });

  useEffect(() => {
    try {
      localStorage.setItem(OPENPLAY_STORAGE_KEYS.NEXT_QUEUE_TURN, nextQueueTurn);
    } catch {}
  }, [nextQueueTurn]);

  // Save 3 buckets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('openplay_winners_queue_v2', JSON.stringify(winnersQueue));
    } catch {}
  }, [winnersQueue]);

  useEffect(() => {
    try {
      localStorage.setItem('openplay_losers_queue_v2', JSON.stringify(losersQueue));
    } catch {}
  }, [losersQueue]);

  useEffect(() => {
    try {
      localStorage.setItem('openplay_resting_bench_v2', JSON.stringify(restingBench));
    } catch {}
  }, [restingBench]);

  // Auto-reconcile players: Ensure every player in social squad exists in Open Play buckets
  useEffect(() => {
    

    const validPlayerIds = new Set(socialPlayers.map((p) => p.id));
    const currentlyPlaying = new Set<string>();
    (Object.values(activeMatches) as (OpenPlayMatch | null | undefined)[]).forEach((m) => {
      if (m && m.status === 'in_progress') {
        [...m.team1, ...m.team2].forEach((id) => currentlyPlaying.add(id));
      }
    });

    const inQueues = new Set([
      ...winnersQueue,
      ...losersQueue,
      ...restingBench,
      ...currentlyPlaying,
    ]);

    const missingInBench: string[] = [];
    socialPlayers.forEach((p) => {
      if (p && p.id && !inQueues.has(p.id)) {
        missingInBench.push(p.id);
        inQueues.add(p.id);
      }
    });

    const cleanedWinners = winnersQueue.filter((id) => validPlayerIds.has(id));
    const cleanedLosers = losersQueue.filter((id) => validPlayerIds.has(id));
    const cleanedBench = restingBench.filter((id) => validPlayerIds.has(id));

    if (
      missingInBench.length > 0 ||
      cleanedWinners.length !== winnersQueue.length ||
      cleanedLosers.length !== losersQueue.length ||
      cleanedBench.length !== restingBench.length
    ) {
      if (cleanedWinners.length !== winnersQueue.length) setWinnersQueue(cleanedWinners);
      if (cleanedLosers.length !== losersQueue.length) setLosersQueue(cleanedLosers);
      setRestingBench([...cleanedBench, ...missingInBench]);
    }
  }, [socialPlayers]);

  // Listen for real-time roster sync events
  useEffect(() => {
    const handleSyncEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ source?: string; updatedPlayers?: Player[] }>;
      if (customEvent.detail?.source === 'openplay' && customEvent.detail?.updatedPlayers) {
        setSocialPlayers(customEvent.detail.updatedPlayers);
      } else if (e.type === 'storage') {
        const se = e as StorageEvent;
        if (se.key === OPENPLAY_STORAGE_KEYS.PLAYERS && se.newValue) {
          try {
            const parsed = JSON.parse(se.newValue);
            if (Array.isArray(parsed)) {
              setSocialPlayers(parsed);
            }
          } catch {}
        }
      }
    };

    window.addEventListener(ROSTER_SYNC_EVENT, handleSyncEvent);
    window.addEventListener('storage', handleSyncEvent);
    return () => {
      window.removeEventListener(ROSTER_SYNC_EVENT, handleSyncEvent);
      window.removeEventListener('storage', handleSyncEvent);
    };
  }, []);

  // Persist Open Play players whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(OPENPLAY_STORAGE_KEYS.PLAYERS, JSON.stringify(socialPlayers || []));
    } catch {}
  }, [socialPlayers]);

  // Save active matches, config, and history
  useEffect(() => {
    try {
      localStorage.setItem(OPENPLAY_STORAGE_KEYS.CONFIG, JSON.stringify(config));
    } catch {}
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(OPENPLAY_STORAGE_KEYS.ACTIVE_MATCHES, JSON.stringify(activeMatches));
    } catch {}
  }, [activeMatches]);

  useEffect(() => {
    try {
      localStorage.setItem(OPENPLAY_STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch {}
  }, [history]);

  // Keep URL search query in sync with current session ID
  useEffect(() => {
    if (typeof window !== 'undefined' && activeSessionId) {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('session') !== activeSessionId) {
          url.searchParams.set('session', activeSessionId);
          window.history.replaceState({}, '', url.toString());
        }
      } catch {}
    }
  }, [activeSessionId]);

  // Listen for open transfer modal events from Navbar or elsewhere
  useEffect(() => {
    const handleOpenModal = () => setShowTransferModal(true);
    window.addEventListener('open-transfer-modal', handleOpenModal);
    return () => window.removeEventListener('open-transfer-modal', handleOpenModal);
  }, []);

  // Listen for real-time remote session transfers / cloud sync
  useEffect(() => {
    const handleRemoteSync = (e: Event) => {
      const ce = e as CustomEvent<{ openPlay?: OpenPlaySessionData }>;
      const op = ce.detail?.openPlay;
      if (op) {
        if (op.config) setConfig(op.config);
        if (op.activeMatches) setActiveMatches(op.activeMatches);
        if (op.history) setHistory(op.history);
        if (op.winnersQueue) setWinnersQueue(op.winnersQueue);
        if (op.losersQueue) setLosersQueue(op.losersQueue);
        if (op.restingBench) setRestingBench(op.restingBench);
        if (op.nextQueueTurn) setNextQueueTurn(op.nextQueueTurn);
        if (op.players && Array.isArray(op.players)) setSocialPlayers(op.players);
        const now = Date.now();
        setLastSyncedAt(now);
        try {
          localStorage.setItem('fairplay_openplay_last_synced', String(now));
        } catch {}
      }
    };

    const handleSessionLoaded = (e: Event) => {
      const ce = e as CustomEvent<{ session: SessionData }>;
      const s = ce.detail?.session;
      if (s) {
        if (s.id) setInternalSessionId(s.id);
        if (s.openPlay) {
          if (s.openPlay.config) setConfig(s.openPlay.config);
          if (s.openPlay.activeMatches) setActiveMatches(s.openPlay.activeMatches);
          if (s.openPlay.history) setHistory(s.openPlay.history);
          if (s.openPlay.winnersQueue) setWinnersQueue(s.openPlay.winnersQueue);
          if (s.openPlay.losersQueue) setLosersQueue(s.openPlay.losersQueue);
          if (s.openPlay.restingBench) setRestingBench(s.openPlay.restingBench);
          if (s.openPlay.nextQueueTurn) setNextQueueTurn(s.openPlay.nextQueueTurn);
          if (s.openPlay.players && Array.isArray(s.openPlay.players)) {
            setSocialPlayers(s.openPlay.players);
          } else if (s.players && Array.isArray(s.players)) {
            setSocialPlayers(s.players);
          }
        } else if (s.players && Array.isArray(s.players)) {
          setSocialPlayers(s.players);
        }
        setLastSyncedAt(s.updatedAt || Date.now());
      }
    };

    window.addEventListener('openplay-session-sync', handleRemoteSync);
    window.addEventListener(SESSION_LOADED_EVENT, handleSessionLoaded);
    return () => {
      window.removeEventListener('openplay-session-sync', handleRemoteSync);
      window.removeEventListener(SESSION_LOADED_EVENT, handleSessionLoaded);
    };
  }, [setSocialPlayers]);

  const isInitialMount = useRef(true);

  // Debounced auto-save to cloud server whenever ANY Open Play state changes (matches, scores, queues, config, players)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setInternalIsSyncing(true);
    const timer = setTimeout(async () => {
      try {
        const opData: OpenPlaySessionData = {
          config,
          activeMatches,
          history,
          winnersQueue,
          losersQueue,
          restingBench,
          nextQueueTurn,
          players: socialPlayers,
          updatedAt: Date.now(),
        };

        const res = await saveSessionToCloud(activeSessionId, {
          openPlay: opData,
          players: socialPlayers,
        });

        if (res.success) {
          const now = Date.now();
          setLastSyncedAt(now);
          try {
            localStorage.setItem('fairplay_openplay_last_synced', String(now));
          } catch {}
          emitOpenPlayCloudSynced(activeSessionId, now);
        } else {
          setNotification({
            id: Date.now().toString(),
            type: 'sync_error',
            timestamp: Date.now(),
            courtNumber: 0,
            title: 'Cloud Sync Notice',
            message: res.error || 'Failed to sync Open Play courts with cloud. All data remains safe locally.',
          });
        }
      } catch (err: any) {
        console.error('Failed to auto-sync Open Play to cloud:', err);
        setNotification({
          id: Date.now().toString(),
          type: 'sync_error',
          timestamp: Date.now(),
          courtNumber: 0,
          title: 'Cloud Sync Error',
          message: err?.message || 'Network error auto-saving Open Play to cloud. Your changes remain saved locally.',
        });
      } finally {
        setInternalIsSyncing(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [
    config,
    activeMatches,
    history,
    winnersQueue,
    losersQueue,
    restingBench,
    nextQueueTurn,
    socialPlayers,
    activeSessionId,
  ]);

  // Manual trigger for instant cloud synchronization
  const handleManualSync = async (): Promise<boolean> => {
    setInternalIsSyncing(true);
    try {
      const opData: OpenPlaySessionData = {
        config,
        activeMatches,
        history,
        winnersQueue,
        losersQueue,
        restingBench,
        nextQueueTurn,
        players: socialPlayers,
        updatedAt: Date.now(),
      };

      const res = await saveSessionToCloud(activeSessionId, {
        openPlay: opData,
        players: socialPlayers,
      });

      if (res.success) {
        const now = Date.now();
        setLastSyncedAt(now);
        try {
          localStorage.setItem('fairplay_openplay_last_synced', String(now));
        } catch {}
        emitOpenPlayCloudSynced(activeSessionId, now);
        setNotification({
          id: Date.now().toString(),
          type: 'queue_update',
          timestamp: Date.now(),
          courtNumber: 0,
          title: 'Cloud Synced!',
          message: `All Open Play courts and queues synced to session ${activeSessionId}.`,
        });
        soundFx.playPointChime();
        return true;
      }
      setNotification({
        id: Date.now().toString(),
        type: 'sync_error',
        timestamp: Date.now(),
        courtNumber: 0,
        title: 'Cloud Sync Notice',
        message: res.error || 'Failed to sync Open Play courts with cloud server.',
      });
      return false;
    } catch (err: any) {
      setNotification({
        id: Date.now().toString(),
        type: 'sync_error',
        timestamp: Date.now(),
        courtNumber: 0,
        title: 'Network Error',
        message: err?.message || 'Could not connect to cloud server.',
      });
      return false;
    } finally {
      setInternalIsSyncing(false);
    }
  };

  // Load session from cloud server by session ID or link
  const handleLoadSession = async (targetId: string): Promise<{ success: boolean; error?: string }> => {
    setInternalIsSyncing(true);
    const res = await loadAndApplySession(targetId);
    setInternalIsSyncing(false);

    if (res.success && res.session) {
      const s = res.session;
      if (s.openPlay) {
        if (s.openPlay.config) setConfig(s.openPlay.config);
        if (s.openPlay.activeMatches) setActiveMatches(s.openPlay.activeMatches);
        if (s.openPlay.history) setHistory(s.openPlay.history);
        if (s.openPlay.winnersQueue) setWinnersQueue(s.openPlay.winnersQueue);
        if (s.openPlay.losersQueue) setLosersQueue(s.openPlay.losersQueue);
        if (s.openPlay.restingBench) setRestingBench(s.openPlay.restingBench);
        if (s.openPlay.nextQueueTurn) setNextQueueTurn(s.openPlay.nextQueueTurn);
        if (s.openPlay.players && Array.isArray(s.openPlay.players)) {
          setSocialPlayers(s.openPlay.players);
        } else if (s.players && Array.isArray(s.players)) {
          setSocialPlayers(s.players);
        }
      } else if (s.players && Array.isArray(s.players)) {
        setSocialPlayers(s.players);
      }
      setInternalSessionId(s.id);
      setLastSyncedAt(s.updatedAt || Date.now());
      soundFx.playVictoryFanfare();
      setNotification({
        id: Date.now().toString(),
        type: 'queue_update',
        timestamp: Date.now(),
        courtNumber: 0,
        title: `Session ${s.id} Connected!`,
        message: 'Loaded Open Play matches, queues, and players from cloud.',
      });
      return { success: true };
    }
    setNotification({
      id: Date.now().toString(),
      type: 'sync_error',
      timestamp: Date.now(),
      courtNumber: 0,
      title: 'Cloud Load Error',
      message: res.error || 'Failed to load session from cloud.',
    });
    return { success: false, error: res.error || 'Failed to load session from cloud' };
  };

  // Generate a brand new readable session ID
  const handleGenerateNewSession = () => {
    const newId = generateSessionId();
    const token = generateOrganizerToken();
    setOrganizerToken(newId, token);
    setInternalSessionId(newId);
    try {
      localStorage.setItem('fairclub_session_id_v1', newId);
      const url = new URL(window.location.href);
      url.searchParams.set('session', newId);
      url.searchParams.delete('editToken');
      url.searchParams.delete('token');
      url.searchParams.delete('key');
      window.history.replaceState({}, '', url.toString());
    } catch {}
    handleManualSync();
  };

  // Navigation tabs
  const [currentTab, setCurrentTab] = useState<OpenPlayTabType>('matches');

  // Modals & Notifications
  const [editLineupCourt, setEditLineupCourt] = useState<number | null>(null);
  const [finishModalMatch, setFinishModalMatch] = useState<OpenPlayMatch | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [notification, setNotification] = useState<OpenPlayNotification | null>(null);

  // Auto-dismiss notification after 7s
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 7000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Listen for global sync errors from sessionSync
  useEffect(() => {
    const handleSyncError = (e: Event) => {
      const ce = e as CustomEvent<{ error: string }>;
      if (ce.detail?.error) {
        setNotification({
          id: Date.now().toString(),
          type: 'sync_error',
          timestamp: Date.now(),
          courtNumber: 0,
          title: 'Cloud Sync Notice',
          message: ce.detail.error,
        });
      }
    };
    window.addEventListener('fairplay:sync-error', handleSyncError);
    return () => window.removeEventListener('fairplay:sync-error', handleSyncError);
  }, []);

  // Player Registry
  const playerRegistry: Record<string, OpenPlayPlayer> = useMemo(() => {
    const statsMap: Record<
      string,
      { gamesPlayed: number; wins: number; losses: number; currentStreak: number; bestStreak: number }
    > = {};

    const sortedHistory = [...history].sort((a, b) => a.startedAt - b.startedAt);
    sortedHistory.forEach((m) => {
      const isDraw = m.winner === 'draw';
      const winnerIds = m.winnerIds || (m.winner === 1 ? m.team1 : m.winner === 2 ? m.team2 : []);
      const loserIds = m.loserIds || (m.winner === 1 ? m.team2 : m.winner === 2 ? m.team1 : []);

      [...m.team1, ...m.team2].forEach((id) => {
        if (!statsMap[id]) statsMap[id] = { gamesPlayed: 0, wins: 0, losses: 0, currentStreak: 0, bestStreak: 0 };
        statsMap[id].gamesPlayed += 1;
      });

      winnerIds.forEach((id) => {
        if (!statsMap[id]) statsMap[id] = { gamesPlayed: 1, wins: 0, losses: 0, currentStreak: 0, bestStreak: 0 };
        statsMap[id].wins += 1;
        statsMap[id].currentStreak += 1;
        if (statsMap[id].currentStreak > statsMap[id].bestStreak) {
          statsMap[id].bestStreak = statsMap[id].currentStreak;
        }
      });

      loserIds.forEach((id) => {
        if (!statsMap[id]) statsMap[id] = { gamesPlayed: 1, wins: 0, losses: 0, currentStreak: 0, bestStreak: 0 };
        if (!isDraw) statsMap[id].losses += 1;
        statsMap[id].currentStreak = 0;
      });
    });

    const playingCourtMap: Record<string, number> = {};
    (Object.entries(activeMatches) as [string, OpenPlayMatch][]).forEach(([courtStr, m]) => {
      if (m && m.status === 'in_progress') {
        const courtNum = Number(courtStr);
        [...m.team1, ...m.team2].forEach((id) => {
          playingCourtMap[id] = courtNum;
        });
      }
    });

    const reg: Record<string, OpenPlayPlayer> = {};
    (socialPlayers || []).forEach((sp, idx) => {
      if (!sp || !sp.id) return;
      const stats = statsMap[sp.id] || {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        currentStreak: 0,
        bestStreak: 0,
      };
      const court = playingCourtMap[sp.id] ?? null;
      reg[sp.id] = {
        id: sp.id,
        name: sp.name,
        avatarColor: sp.avatarColor || AVATAR_COLORS[idx % AVATAR_COLORS.length],
        joinedQueueAt: Date.now() - idx * 10000,
        status: court !== null ? 'playing' : restingBench.includes(sp.id) ? 'resting' : 'waiting',
        bucket: winnersQueue.includes(sp.id)
          ? 'winners'
          : losersQueue.includes(sp.id)
          ? 'losers'
          : restingBench.includes(sp.id)
          ? 'bench'
          : undefined,
        courtAssigned: court,
        gamesPlayed: stats.gamesPlayed,
        wins: stats.wins,
        losses: stats.losses,
        currentStreak: stats.currentStreak,
        bestStreak: stats.bestStreak,
      };
    });

    return reg;
  }, [socialPlayers, history, activeMatches, winnersQueue, losersQueue, restingBench]);

  // Counts
  const activeMatchesCount = (Object.values(activeMatches) as (OpenPlayMatch | null | undefined)[]).filter(
    (m): m is OpenPlayMatch => Boolean(m && m.status === 'in_progress')
  ).length;

  const playingCount = (Object.values(activeMatches) as (OpenPlayMatch | null | undefined)[])
    .filter((m): m is OpenPlayMatch => Boolean(m && m.status === 'in_progress'))
    .reduce((acc, m) => acc + m.team1.length + m.team2.length, 0);

  const neededPlayers = config.format === 'singles' ? 2 : 4;
  const canDispatchAny =
    activeMatchesCount < config.courtsCount &&
    (restingBench.length + winnersQueue.length + losersQueue.length >= neededPlayers);

  // Match counter for readable match numbers
  const matchCounter = history.length + activeMatchesCount + 1;

  // ----------------------------------------------------
  // Universal Match Cycle: Start Match on Court
  // 1. Bench Queue priority until all bench players have played
  // 2. Alternating Winners/Losers queue turns
  // ----------------------------------------------------
  const handleStartMatchOnCourt = (courtNumber: number) => {
    const result = generateNextMatchWithBuckets(
      courtNumber,
      restingBench,
      winnersQueue,
      losersQueue,
      nextQueueTurn,
      matchCounter,
      config.format
    );

    if (!result.match) {
      soundFx.playErrorTone();
      setNotification({
        id: Date.now().toString(),
        title: 'Cannot Start Match',
        message: `Need at least ${config.format === 'singles' ? 2 : 4} waiting players across Bench, Winners, or Losers queues.`,
        type: 'queue_update',
        timestamp: Date.now(),
      });
      return;
    }

    const { match, newBenchQueue, newWinnersQueue, newLosersQueue, nextQueueTurn: updatedTurn } = result;

    setActiveMatches((prev) => ({
      ...prev,
      [courtNumber]: match,
    }));
    setRestingBench(newBenchQueue);
    setWinnersQueue(newWinnersQueue);
    setLosersQueue(newLosersQueue);
    setNextQueueTurn(updatedTurn);

    soundFx.playWhistle();

    const team1Names = match.team1.map((id) => playerRegistry[id]?.name || 'Player').join(' & ');
    const team2Names = match.team2.map((id) => playerRegistry[id]?.name || 'Player').join(' & ');

    let matchTypeDesc = 'Match Started';
    if (match.matchType === 'bench_start') matchTypeDesc = '🪑 Bench Round Game';
    else if (match.matchType === 'pure_winners') matchTypeDesc = '🏆 Winners Queue Game';
    else if (match.matchType === 'pure_losers') matchTypeDesc = '🥈 Losers Queue Game';
    else if (match.matchType === 'move_up') matchTypeDesc = '⚡ Move-Up Match (Queue + Challengers)';

    setNotification({
      id: Date.now().toString(),
      title: `Court ${courtNumber}: ${matchTypeDesc}`,
      message: `${team1Names} vs ${team2Names} (Partner split: 1+4 vs 2+3)`,
      type: 'court_dispatched',
      courtNumber,
      timestamp: Date.now(),
    });
  };

  // Dispatch All Available Courts
  const handleDispatchAll = () => {
    const result = dispatchAvailableCourtsWithBuckets(
      config.courtsCount,
      activeMatches,
      restingBench,
      winnersQueue,
      losersQueue,
      nextQueueTurn,
      matchCounter,
      config.format
    );

    if (result.newMatches.length === 0) {
      soundFx.playErrorTone();
      return;
    }

    setActiveMatches(result.updatedActiveMatches);
    setRestingBench(result.newBenchQueue);
    setWinnersQueue(result.newWinnersQueue);
    setLosersQueue(result.newLosersQueue);
    setNextQueueTurn(result.nextQueueTurn);

    soundFx.playWhistle();
    const count = result.newMatches.length;
    const playersCount = count * (config.format === 'singles' ? 2 : 4);
    setNotification({
      id: Date.now().toString(),
      title: `Filled ${count} Court(s)`,
      message: `Dispatched ${playersCount} players using Fair Rotation (Bench first, then alternating queues).`,
      type: 'court_dispatched',
      timestamp: Date.now(),
    });
  };

  // Update Live Score
  const handleUpdateScore = (matchId: string, score1: number, score2: number) => {
    setActiveMatches((prev) => {
      const updated: Record<number, OpenPlayMatch> = { ...prev };
      (Object.entries(updated) as [string, OpenPlayMatch][]).forEach(([courtStr, m]) => {
        if (m && m.id === matchId) {
          updated[Number(courtStr)] = {
            ...m,
            score1,
            score2,
          };
        }
      });
      return updated;
    });
  };

  // ----------------------------------------------------
  // Shuffle Partners on Court (Cycles partner split mode)
  // ----------------------------------------------------
  const handleShufflePartners = (courtNumber: number) => {
    const match = activeMatches[courtNumber];
    if (!match) return;

    const shuffled = cyclePartnerSplit(match);
    setActiveMatches((prev) => ({
      ...prev,
      [courtNumber]: shuffled,
    }));

    const team1Names = shuffled.team1.map((id) => playerRegistry[id]?.name || 'Player').join(' & ');
    const team2Names = shuffled.team2.map((id) => playerRegistry[id]?.name || 'Player').join(' & ');

    setNotification({
      id: Date.now().toString(),
      title: `Court ${courtNumber} Partners Shuffled`,
      message: `New Teams: ${team1Names} vs ${team2Names}`,
      type: 'queue_update',
      timestamp: Date.now(),
    });
  };

  // ----------------------------------------------------
  // Edit Lineup on Court (Manual Squad Assignment)
  // ----------------------------------------------------
  const handleOpenEditLineup = (courtNumber: number) => {
    setEditLineupCourt(courtNumber);
  };

  const handleSaveLineup = (team1: string[], team2: string[]) => {
    if (editLineupCourt === null) return;
    const courtNum = editLineupCourt;
    const currentMatch = activeMatches[courtNum];
    const newArrivalOrder = [...team1, ...team2];

    if (currentMatch) {
      const oldPlayers = [...currentMatch.team1, ...currentMatch.team2];
      const removedPlayers = oldPlayers.filter((id) => !newArrivalOrder.includes(id));
      const addedPlayers = newArrivalOrder.filter((id) => !oldPlayers.includes(id));

      // Return removed players back to the front of their respective queues
      if (removedPlayers.length > 0) {
        if (currentMatch.matchType === 'bench_start') {
          setRestingBench((prev) => [...removedPlayers, ...prev.filter((id) => !removedPlayers.includes(id))]);
        } else if (currentMatch.matchType === 'pure_winners') {
          setWinnersQueue((prev) => [...removedPlayers, ...prev.filter((id) => !removedPlayers.includes(id))]);
        } else {
          setLosersQueue((prev) => [...removedPlayers, ...prev.filter((id) => !removedPlayers.includes(id))]);
        }
      }

      // Remove newly entered players from queues
      if (addedPlayers.length > 0) {
        setRestingBench((prev) => prev.filter((id) => !addedPlayers.includes(id)));
        setWinnersQueue((prev) => prev.filter((id) => !addedPlayers.includes(id)));
        setLosersQueue((prev) => prev.filter((id) => !addedPlayers.includes(id)));
      }

      setActiveMatches((prev) => ({
        ...prev,
        [courtNum]: {
          ...currentMatch,
          team1,
          team2,
          arrivalOrder: newArrivalOrder,
        },
      }));
    } else {
      // Create a new match on this court
      setRestingBench((prev) => prev.filter((id) => !newArrivalOrder.includes(id)));
      setWinnersQueue((prev) => prev.filter((id) => !newArrivalOrder.includes(id)));
      setLosersQueue((prev) => prev.filter((id) => !newArrivalOrder.includes(id)));

      const newMatch: OpenPlayMatch = {
        id: `op-match-${Date.now()}-${courtNum}`,
        matchNumber: matchCounter,
        courtNumber: courtNum,
        team1,
        team2,
        score1: 0,
        score2: 0,
        status: 'in_progress',
        startedAt: Date.now(),
        arrivalOrder: newArrivalOrder,
        matchType: 'standard',
        partnerSplitMode: '14_vs_23',
      };

      setActiveMatches((prev) => ({
        ...prev,
        [courtNum]: newMatch,
      }));
    }

    soundFx.playWhistle();
    const team1Names = team1.map((id) => playerRegistry[id]?.name || 'Player').join(' & ');
    const team2Names = team2.map((id) => playerRegistry[id]?.name || 'Player').join(' & ');

    setNotification({
      id: Date.now().toString(),
      title: `Court ${courtNum} Lineup Updated`,
      message: `New Teams: ${team1Names} vs ${team2Names}`,
      type: 'queue_update',
      courtNumber: courtNum,
      timestamp: Date.now(),
    });

    setEditLineupCourt(null);
  };

  // Cancel match on court (returns players back to front of their respective queues)
  const handleCancelMatch = (courtNumber: number) => {
    const match = activeMatches[courtNumber];
    if (!match) return;

    // Return players to queues: if bench_start, back to bench; if pure winners, back to winners; else to losers
    if (match.matchType === 'bench_start') {
      setRestingBench((prev) => [...match.arrivalOrder, ...prev.filter((id) => !match.arrivalOrder.includes(id))]);
    } else if (match.matchType === 'pure_winners') {
      setWinnersQueue((prev) => [...match.arrivalOrder, ...prev.filter((id) => !match.arrivalOrder.includes(id))]);
    } else {
      setLosersQueue((prev) => [...match.arrivalOrder, ...prev.filter((id) => !match.arrivalOrder.includes(id))]);
    }

    setActiveMatches((prev) => {
      const updated = { ...prev };
      delete updated[courtNumber];
      return updated;
    });

    soundFx.playPointChime();
    setNotification({
      id: Date.now().toString(),
      title: `Court ${courtNumber} Reset`,
      message: 'Match cancelled; players returned to the front of their queues.',
      type: 'queue_update',
      timestamp: Date.now(),
    });
  };

  // ----------------------------------------------------
  // Universal Match Cycle: Complete & Record Match
  // 1. 2 Winners -> Back of Winners Queue (FIFO)
  // 2. 2 Losers -> Back of Losers Queue (FIFO)
  // 3. No bench swap: finished players do not take spots on the bench
  // ----------------------------------------------------
  const handleConfirmFinish = (
    matchId: string,
    score1: number,
    score2: number
  ) => {
    let targetMatch: OpenPlayMatch | null = null;
    let targetCourtNum: number = 1;

    (Object.entries(activeMatches) as [string, OpenPlayMatch][]).forEach(([courtStr, m]) => {
      if (m && m.id === matchId) {
        targetMatch = m;
        targetCourtNum = Number(courtStr);
      }
    });

    if (!targetMatch) return;

    const result = completeOpenPlayMatchWithBuckets(
      targetMatch,
      score1,
      score2,
      winnersQueue,
      losersQueue,
      restingBench,
      playerRegistry
    );

    const { completedMatch } = result;
    let nextWinners = result.newWinnersQueue;
    let nextLosers = result.newLosersQueue;
    let nextBench = result.newRestingBench;

    // Aggregating career stats across sessions into playerProfiles
    const winnerProfiles: string[] = [];
    const loserProfiles: string[] = [];
    completedMatch.winnerIds?.forEach((pId) => {
      const sp = (socialPlayers || []).find((p) => p.id === pId);
      if (sp?.playerProfileId) winnerProfiles.push(sp.playerProfileId);
    });
    completedMatch.loserIds?.forEach((pId) => {
      const sp = (socialPlayers || []).find((p) => p.id === pId);
      if (sp?.playerProfileId) loserProfiles.push(sp.playerProfileId);
    });
    if (winnerProfiles.length > 0 || loserProfiles.length > 0) {
      updatePlayerProfilesMatchStats(winnerProfiles, loserProfiles).catch(() => {});
    }

    // Update history
    setHistory((prev) => [completedMatch, ...prev]);

    // Update active court: auto-dispatch next or display completed match result
    const updatedActiveMatches = { ...activeMatches };

    // Auto-dispatch next match if enabled
    if (config.autoDispatchNext) {
      const autoMatch = generateNextMatchWithBuckets(
        targetCourtNum,
        nextBench,
        nextWinners,
        nextLosers,
        nextQueueTurn,
        matchCounter + 1,
        config.format
      );
      if (autoMatch.match) {
        updatedActiveMatches[targetCourtNum] = autoMatch.match;
        nextBench = autoMatch.newBenchQueue;
        nextWinners = autoMatch.newWinnersQueue;
        nextLosers = autoMatch.newLosersQueue;
        setNextQueueTurn(autoMatch.nextQueueTurn);
      } else {
        // Keep completed match card visible until next match is started
        updatedActiveMatches[targetCourtNum] = completedMatch;
      }
    } else {
      // Keep completed match card visible on court (uniform with Social Match)
      updatedActiveMatches[targetCourtNum] = completedMatch;
    }

    setActiveMatches(updatedActiveMatches);
    setWinnersQueue(nextWinners);
    setLosersQueue(nextLosers);
    setRestingBench(nextBench);

    setNotification({
      id: Date.now().toString(),
      title: `Court ${targetCourtNum} Finished`,
      message: `Score recorded: ${score1} - ${score2}. Players re-queued.`,
      type: 'court_dispatched',
      timestamp: Date.now(),
    });
  };

  // Direct Finish & Record from Court Card (matches Social Match flow)
  const handleCompleteMatch = (matchId: string) => {
    let targetMatch: OpenPlayMatch | null = null;
    (Object.entries(activeMatches) as [string, OpenPlayMatch][]).forEach(([, m]) => {
      if (m && m.id === matchId) {
        targetMatch = m;
      }
    });

    if (!targetMatch) return;
    handleConfirmFinish((targetMatch as OpenPlayMatch).id, (targetMatch as OpenPlayMatch).score1, (targetMatch as OpenPlayMatch).score2);
  };

  // Reopen completed match to edit score or resume (matches Social Match flow)
  const handleReopenMatch = (matchId: string) => {
    let targetMatch: OpenPlayMatch | null = null;
    let targetCourtNum: number | null = null;

    // Check active matches first
    (Object.entries(activeMatches) as [string, OpenPlayMatch][]).forEach(([courtStr, m]) => {
      if (m && m.id === matchId) {
        targetMatch = m;
        targetCourtNum = Number(courtStr);
      }
    });

    // Or check in match history
    if (!targetMatch) {
      const histMatch = history.find((h) => h.id === matchId);
      if (histMatch) {
        targetMatch = histMatch;
        targetCourtNum = histMatch.courtNumber;
      }
    }

    if (!targetMatch || !targetCourtNum) return;

    soundFx.playPointChime();

    // Remove from history if present
    setHistory((prev) => prev.filter((h) => h.id !== matchId));

    // Restore to active court in progress
    const reopenedMatch: OpenPlayMatch = {
      ...targetMatch,
      status: 'in_progress',
      completedAt: undefined,
    };

    setActiveMatches((prev) => ({
      ...prev,
      [targetCourtNum!]: reopenedMatch,
    }));

    setNotification({
      id: Date.now().toString(),
      title: `Court ${targetCourtNum} Reopened`,
      message: `Match reopened on Court ${targetCourtNum} for score editing.`,
      type: 'court_dispatched',
      timestamp: Date.now(),
    });
  };

  // ----------------------------------------------------
  // Queue Management Handlers
  // ----------------------------------------------------
  const handleAddPlayer = async (name: string, targetBucket: 'winners' | 'losers' | 'bench' = 'bench') => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const activeClub = await getActiveClub();
    const avatarColor = AVATAR_COLORS[(socialPlayers?.length || 0) % AVATAR_COLORS.length];
    const { playerProfileId } = await ensurePlayerProfileId(trimmed, {
      avatarColor,
      clubId: activeClub?.id,
    });

    const newPlayer: Player = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      playerProfileId,
      name: trimmed,
      active: true,
      avatarColor,
      joinedAtRound: 1,
    };

    const nextSocial = [...(socialPlayers || []), newPlayer];
    setSocialPlayers(nextSocial);

    if (targetBucket === 'winners') {
      setWinnersQueue((prev) => [...prev, newPlayer.id]);
    } else if (targetBucket === 'losers') {
      setLosersQueue((prev) => [...prev, newPlayer.id]);
    } else {
      setRestingBench((prev) => [...prev, newPlayer.id]);
    }

    try {
      localStorage.setItem(OPENPLAY_STORAGE_KEYS.PLAYERS, JSON.stringify(nextSocial));
      emitRosterSync('openplay', nextSocial);
    } catch {}
  };

  const handleBulkAddPlayers = async (names: string[]) => {
    const trimmedNames = names.map((n) => n.trim()).filter((n) => n.length > 0);
    if (trimmedNames.length === 0) return;

    const activeClub = await getActiveClub();
    const newPlayers: Player[] = await Promise.all(
      trimmedNames.map(async (name, idx) => {
        const avatarColor =
          AVATAR_COLORS[((socialPlayers?.length || 0) + idx) % AVATAR_COLORS.length];
        const { playerProfileId } = await ensurePlayerProfileId(name, {
          avatarColor,
          clubId: activeClub?.id,
        });
        return {
          id: `p-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          playerProfileId,
          name,
          active: true,
          avatarColor,
          joinedAtRound: 1,
        };
      })
    );

    const newIds = newPlayers.map((p) => p.id);
    const nextSocial = [...(socialPlayers || []), ...newPlayers];
    setSocialPlayers(nextSocial);
    setRestingBench((prev) => [...prev, ...newIds]);

    try {
      localStorage.setItem(OPENPLAY_STORAGE_KEYS.PLAYERS, JSON.stringify(nextSocial));
      emitRosterSync('openplay', nextSocial);
    } catch {}

    soundFx.playPointChime();
    setNotification({
      id: Date.now().toString(),
      title: 'Players Added',
      message: `Added ${newPlayers.length} player(s) to Bench Queue.`,
      type: 'queue_update',
      timestamp: Date.now(),
    });
  };

  const handleEditPlayer = (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const nextSocial = (socialPlayers || []).map((p) =>
      p.id === id ? { ...p, name: trimmed } : p
    );
    setSocialPlayers(nextSocial);
    try {
      localStorage.setItem(OPENPLAY_STORAGE_KEYS.PLAYERS, JSON.stringify(nextSocial));
      emitRosterSync('openplay', nextSocial);
    } catch {}
  };

  const handleRemovePlayer = (id: string) => {
    const targetPlayer = (socialPlayers || []).find((p) => p.id === id);
    const targetName = targetPlayer?.name || 'Player';

    // 1. Filter out deleted player from roster and all 3 queues
    const nextSocial = (socialPlayers || []).filter((p) => p.id !== id);
    const nextWinners = winnersQueue.filter((pId) => pId !== id);
    const nextLosers = losersQueue.filter((pId) => pId !== id);
    let nextBench = restingBench.filter((pId) => pId !== id);

    // 2. Check if the player is currently playing on an active court
    let playerWasPlayingOnCourt: number | null = null;
    let replacementPlayerId: string | null = null;
    const updatedMatches: Record<number, OpenPlayMatch> = { ...activeMatches };
    let matchesChanged = false;

    Object.entries(updatedMatches).forEach(([courtStr, match]) => {
      if (!match) return;
      const courtNum = Number(courtStr);
      const inTeam1 = match.team1.includes(id);
      const inTeam2 = match.team2.includes(id);

      if (inTeam1 || inTeam2) {
        playerWasPlayingOnCourt = courtNum;
        matchesChanged = true;

        // Try to substitute an available bench or queue player into the court slot
        const availableCandidateId = nextBench[0] || nextWinners[0] || nextLosers[0] || null;

        if (availableCandidateId) {
          replacementPlayerId = availableCandidateId;
          if (nextBench.includes(availableCandidateId)) {
            nextBench = nextBench.filter((pId) => pId !== availableCandidateId);
          } else if (nextWinners.includes(availableCandidateId)) {
            // Remove candidate from winners queue
          }

          const newTeam1 = inTeam1
            ? match.team1.map((pId) => (pId === id ? availableCandidateId : pId))
            : match.team1;
          const newTeam2 = inTeam2
            ? match.team2.map((pId) => (pId === id ? availableCandidateId : pId))
            : match.team2;

          updatedMatches[courtNum] = {
            ...match,
            team1: newTeam1,
            team2: newTeam2,
          };
        } else {
          // No substitute available: remove player from the team
          const newTeam1 = match.team1.filter((pId) => pId !== id);
          const newTeam2 = match.team2.filter((pId) => pId !== id);

          if (newTeam1.length === 0 || newTeam2.length === 0) {
            delete updatedMatches[courtNum];
          } else {
            updatedMatches[courtNum] = {
              ...match,
              team1: newTeam1,
              team2: newTeam2,
            };
          }
        }
      }
    });

    // 3. Update React state immediately
    setSocialPlayers(nextSocial);
    setWinnersQueue(nextWinners);
    setLosersQueue(nextLosers);
    setRestingBench(nextBench);
    if (matchesChanged) {
      setActiveMatches(updatedMatches);
    }

    // 4. Synchronously write to all Open Play storage keys
    try {
      localStorage.setItem(OPENPLAY_STORAGE_KEYS.PLAYERS, JSON.stringify(nextSocial));
      localStorage.setItem('openplay_winners_queue_v2', JSON.stringify(nextWinners));
      localStorage.setItem('openplay_losers_queue_v2', JSON.stringify(nextLosers));
      localStorage.setItem('openplay_resting_bench_v2', JSON.stringify(nextBench));
      if (matchesChanged) {
        localStorage.setItem(OPENPLAY_STORAGE_KEYS.ACTIVE_MATCHES, JSON.stringify(updatedMatches));
      }
    } catch (e) {
      console.error('Failed to save Open Play player deletion to storage', e);
    }

    // 5. Cleanly sync deletion with Social mode storage if present
    try {
      const storedSocial = getStoredSocialPlayers();
      if (storedSocial.some((p) => p.id === id)) {
        const cleanedSocial = storedSocial.filter((p) => p.id !== id);
        setStoredSocialPlayers(cleanedSocial);
      }
    } catch {}

    // 6. Emit sync with explicit updatedPlayers payload
    emitRosterSync('openplay', nextSocial);

    soundFx.playPointChime();
    if (playerWasPlayingOnCourt) {
      const replName = replacementPlayerId ? (playerRegistry[replacementPlayerId]?.name || 'bench player') : null;
      setNotification({
        id: Date.now().toString(),
        title: `${targetName} Removed`,
        message: replName
          ? `Substituted on Court ${playerWasPlayingOnCourt} by ${replName}.`
          : `Removed from Court ${playerWasPlayingOnCourt}.`,
        type: 'queue_update',
        timestamp: Date.now(),
      });
    } else {
      setNotification({
        id: Date.now().toString(),
        title: `${targetName} Removed`,
        message: 'Removed from Open Play session.',
        type: 'queue_update',
        timestamp: Date.now(),
      });
    }
  };

  const handleMovePlayerWithinBucket = (
    bucket: 'winners' | 'losers' | 'bench',
    index: number,
    direction: 'up' | 'down'
  ) => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const reorder = (arr: string[]) => {
      if (targetIdx < 0 || targetIdx >= arr.length) return arr;
      const copy = [...arr];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    };

    if (bucket === 'winners') setWinnersQueue(reorder);
    else if (bucket === 'losers') setLosersQueue(reorder);
    else setRestingBench(reorder);
  };

  const handleTransferPlayerBucket = (
    playerId: string,
    fromBucket: 'winners' | 'losers' | 'bench',
    toBucket: 'winners' | 'losers' | 'bench'
  ) => {
    if (fromBucket === toBucket) return;

    if (fromBucket === 'winners') setWinnersQueue((prev) => prev.filter((id) => id !== playerId));
    else if (fromBucket === 'losers') setLosersQueue((prev) => prev.filter((id) => id !== playerId));
    else if (fromBucket === 'bench') setRestingBench((prev) => prev.filter((id) => id !== playerId));

    if (toBucket === 'winners') setWinnersQueue((prev) => [...prev, playerId]);
    else if (toBucket === 'losers') setLosersQueue((prev) => [...prev, playerId]);
    else if (toBucket === 'bench') setRestingBench((prev) => [...prev, playerId]);

    soundFx.playPointChime();
  };

  const handleClearQueue = () => {
    // Clear all queues into resting bench
    setRestingBench((prev) => [...prev, ...winnersQueue, ...losersQueue]);
    setWinnersQueue([]);
    setLosersQueue([]);
    setNextQueueTurn('winners');
    localStorage.setItem(OPENPLAY_STORAGE_KEYS.NEXT_QUEUE_TURN, 'winners');
  };

  // Resets
  const handleResetKeepPlayers = () => {
    setActiveMatches({});
    setHistory([]);
    setWinnersQueue([]);
    setLosersQueue([]);
    // All players start in the bench queue until all have played!
    const allIds = (socialPlayers || []).map((p) => p.id);
    setRestingBench(allIds);
    setNextQueueTurn('winners');
    localStorage.setItem(OPENPLAY_STORAGE_KEYS.NEXT_QUEUE_TURN, 'winners');

    soundFx.playVictoryFanfare();
    setNotification({
      id: Date.now().toString(),
      type: 'court_dispatched',
      title: 'Session Cleared',
      message: 'Courts cleared. All players lined up in Bench Queue to play their first round!',
      timestamp: Date.now(),
    });
  };

  const handleResetFull = () => {
    setActiveMatches({});
    setHistory([]);
    setWinnersQueue([]);
    setLosersQueue([]);
    setRestingBench([]);
    setSocialPlayers([]);
    setNextQueueTurn('winners');
    try {
      localStorage.removeItem('openplay_winners_queue_v2');
      localStorage.removeItem('openplay_losers_queue_v2');
      localStorage.removeItem('openplay_resting_bench_v2');
      localStorage.removeItem(OPENPLAY_STORAGE_KEYS.PLAYERS);
      localStorage.removeItem(OPENPLAY_STORAGE_KEYS.ACTIVE_MATCHES);
      localStorage.removeItem(OPENPLAY_STORAGE_KEYS.HISTORY);
      localStorage.removeItem(OPENPLAY_STORAGE_KEYS.NEXT_QUEUE_TURN);
    } catch {}

    emitRosterSync('openplay', []);
    soundFx.playPointChime();
  };

  const handlePullFromSocialWrapper = () => {
    if (onPullFromSocial) {
      onPullFromSocial();
      soundFx.playPointChime();
      setNotification({
        id: Date.now().toString(),
        title: 'Pulled from Social',
        message: 'Successfully imported players from Social Matches roster.',
        type: 'queue_update',
        timestamp: Date.now(),
      });
    }
  };

  // Update Match Score in Open Play History
  const handleUpdateHistoryScore = (matchId: string, score1: number, score2: number) => {
    setHistory((prev) =>
      prev.map((m) => {
        if (m.id !== matchId) return m;
        return {
          ...m,
          score1,
          score2,
        };
      })
    );
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col">
      {/* Clean Top Header (Matches Social Matches Layout) */}
      <OpenPlayNavbar
        config={config}
        winnersCount={winnersQueue.length}
        losersCount={losersQueue.length}
        benchCount={restingBench.length}
        waitingCount={winnersQueue.length + losersQueue.length + restingBench.length}
        playingCount={playingCount}
        activeMatchesCount={activeMatchesCount}
        historyCount={history.length}
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onOpenConfig={() => setShowConfigModal(true)}
        onNavigateToSocial={onNavigateToSocial}
        sessionId={activeSessionId}
        onOpenTransfer={externalOnOpenTransfer || (() => setShowTransferModal(true))}
        isSyncing={isSyncing}
        lastSyncedAt={lastSyncedAt}
        onManualSync={handleManualSync}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-4 pb-36 sm:pb-40 md:pb-10 overflow-x-hidden">
        {/* Notification Banner */}
        {notification && (
          <div
            id="openplay-notification-banner"
            className={`mb-3 p-3 rounded-2xl border text-white shadow-sm flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200 ${
              notification.type === 'sync_error'
                ? 'bg-rose-950 border-rose-800'
                : 'bg-emerald-950 border-emerald-700'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-black shrink-0 ${
                  notification.type === 'sync_error'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-yellow-400 text-emerald-950'
                }`}
              >
                {notification.type === 'sync_error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                ) : (
                  <Zap className="w-4 h-4 fill-emerald-950" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4
                    className={`text-xs font-black ${
                      notification.type === 'sync_error' ? 'text-rose-200' : 'text-yellow-300'
                    }`}
                  >
                    {notification.title}
                  </h4>
                  {notification.type === 'sync_error' && (
                    <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded-sm bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      Offline Resilient
                    </span>
                  )}
                </div>
                <p
                  className={`text-xs mt-0.5 ${
                    notification.type === 'sync_error' ? 'text-rose-200/90 leading-relaxed' : 'text-emerald-100/90 truncate'
                  }`}
                >
                  {notification.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                notification.type === 'sync_error'
                  ? 'text-rose-300 hover:text-white hover:bg-rose-900'
                  : 'text-emerald-300 hover:text-white hover:bg-white/10'
              }`}
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1: Live Matches */}
        {currentTab === 'matches' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left: Active Courts (7 cols on lg) */}
            <div className="lg:col-span-7 space-y-3">
              {/* Courts Summary Bar */}
              <div className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    OP
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h2 className="text-xs sm:text-sm font-black text-slate-900">
                        Open Play Courts
                      </h2>
                      <span className="px-2 py-0.2 rounded-full text-[9px] font-black uppercase bg-emerald-950 text-yellow-300">
                        {activeMatchesCount}/{config.courtsCount} In Play
                      </span>
                      {/* Mobile shortcut to Buckets */}
                      <button
                        type="button"
                        onClick={() => setCurrentTab('buckets')}
                        className="lg:hidden px-2 py-0.2 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 cursor-pointer"
                      >
                        {winnersQueue.length + losersQueue.length + restingBench.length} in Buckets &rarr;
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 font-semibold truncate">
                      {config.targetPoints} pts {config.winByTwo ? '• Win by 2' : ''} • Partner split 1+4 vs 2+3
                    </p>
                  </div>
                </div>

                {canDispatchAny && (
                  <button
                    type="button"
                    id="btn-openplay-call-available"
                    onClick={handleDispatchAll}
                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl font-black text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs active:scale-95 transition-all cursor-pointer shrink-0"
                    title="Fill all available courts"
                    aria-label="Fill all available courts"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span className="hidden sm:inline">Fill Courts</span>
                    <span className="sm:hidden">Fill</span>
                  </button>
                )}
              </div>

              {/* Empty Players State */}
              {(socialPlayers || []).length === 0 && (
                <div id="openplay-no-players" className="bg-white border-2 border-dashed border-emerald-200 rounded-3xl p-6 sm:p-8 text-center space-y-3 shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-slate-900">No Players in Open Play</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      Add players directly to your squad roster or pull registered players from Social Matches to begin queuing for courts.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    <button
                      type="button"
                      id="btn-openplay-empty-add-players"
                      onClick={() => setCurrentTab('squad')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider cursor-pointer shadow-sm"
                    >
                      Add Players
                    </button>
                    {onPullFromSocial && (
                      <button
                        type="button"
                        id="btn-openplay-empty-pull-social"
                        onClick={handlePullFromSocialWrapper}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wider cursor-pointer"
                      >
                        Import from Social
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Courts Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: config.courtsCount }, (_, i) => i + 1).map((courtNum) => (
                  <OpenPlayCourtCard
                    key={courtNum}
                    courtNumber={courtNum}
                    match={activeMatches[courtNum] || null}
                    config={config}
                    playerRegistry={playerRegistry}
                    winnersQueue={winnersQueue}
                    losersQueue={losersQueue}
                    restingBench={restingBench}
                    onStartMatch={handleStartMatchOnCourt}
                    onUpdateScore={handleUpdateScore}
                    onCompleteMatch={handleCompleteMatch}
                    onReopenMatch={handleReopenMatch}
                    onOpenFinishModal={(match) => setFinishModalMatch(match)}
                    onCancelMatch={handleCancelMatch}
                    onShufflePartners={handleShufflePartners}
                    onEditLineup={handleOpenEditLineup}
                  />
                ))}
              </div>
            </div>

            {/* Right: Buckets Board */}
            <div className="hidden lg:block lg:col-span-5">
              <OpenPlayQueueBoard
                winnersQueue={winnersQueue}
                losersQueue={losersQueue}
                restingBench={restingBench}
                playerRegistry={playerRegistry}
                config={config}
                nextQueueTurn={nextQueueTurn}
                onToggleNextQueueTurn={() => {
                  const flipped = nextQueueTurn === 'winners' ? 'losers' : 'winners';
                  setNextQueueTurn(flipped);
                  localStorage.setItem(OPENPLAY_STORAGE_KEYS.NEXT_QUEUE_TURN, flipped);
                }}
                onAddPlayer={handleAddPlayer}
                onBulkAddPlayers={handleBulkAddPlayers}
                onEditPlayer={handleEditPlayer}
                onRemovePlayer={handleRemovePlayer}
                onMovePlayerWithinBucket={handleMovePlayerWithinBucket}
                onTransferPlayerBucket={handleTransferPlayerBucket}
                onClearQueue={handleClearQueue}
                onDispatchAll={handleDispatchAll}
                canDispatchAny={canDispatchAny}
                onPullFromSocial={handlePullFromSocialWrapper}
              />
            </div>
          </div>
        )}

        {/* TAB 2: Standings */}
        {currentTab === 'standings' && (
          <OpenPlayLeaderboard players={Object.values(playerRegistry)} />
        )}

        {/* TAB 3: Buckets & Queues */}
        {(currentTab === 'buckets' || (currentTab as string) === 'squad') && (
          <div className="max-w-4xl mx-auto">
            <OpenPlayQueueBoard
              winnersQueue={winnersQueue}
              losersQueue={losersQueue}
              restingBench={restingBench}
              playerRegistry={playerRegistry}
              config={config}
              nextQueueTurn={nextQueueTurn}
              onToggleNextQueueTurn={() => {
                const flipped = nextQueueTurn === 'winners' ? 'losers' : 'winners';
                setNextQueueTurn(flipped);
                localStorage.setItem(OPENPLAY_STORAGE_KEYS.NEXT_QUEUE_TURN, flipped);
              }}
              onAddPlayer={handleAddPlayer}
              onBulkAddPlayers={handleBulkAddPlayers}
              onEditPlayer={handleEditPlayer}
              onRemovePlayer={handleRemovePlayer}
              onMovePlayerWithinBucket={handleMovePlayerWithinBucket}
              onTransferPlayerBucket={handleTransferPlayerBucket}
              onClearQueue={handleClearQueue}
              onDispatchAll={handleDispatchAll}
              canDispatchAny={canDispatchAny}
                onPullFromSocial={handlePullFromSocialWrapper}
            />
          </div>
        )}

        {/* TAB 4: History */}
        {currentTab === 'history' && (
          <OpenPlayHistory
            history={history}
            playerRegistry={playerRegistry}
            onDeleteMatch={(id) => setHistory((prev) => prev.filter((m) => m.id !== id))}
            onClearHistory={() => setHistory([])}
            onUpdateScore={handleUpdateHistoryScore}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Dock */}
      <OpenPlayMobileBottomNav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        activeMatchesCount={activeMatchesCount}
        totalWaitingCount={winnersQueue.length + losersQueue.length + restingBench.length}
        historyCount={history.length}
        onOpenConfig={() => setShowConfigModal(true)}
      />

      {/* Record Match Outcome Modal */}
      <OpenPlayFinishModal
        isOpen={Boolean(finishModalMatch)}
        onClose={() => setFinishModalMatch(null)}
        match={finishModalMatch}
        config={config}
        playerRegistry={playerRegistry}
        winnersQueue={winnersQueue}
        losersQueue={losersQueue}
        restingBench={restingBench}
        onConfirmFinish={handleConfirmFinish}
      />

      {/* Edit Lineup Modal for Open Play */}
      {editLineupCourt !== null && (
        <EditLineupModal
          isOpen={editLineupCourt !== null}
          onClose={() => setEditLineupCourt(null)}
          title={`Edit Lineup — Court ${editLineupCourt}`}
          subtitle="Tap slots to assign or replace players on court"
          playersPerTeam={config.format === 'singles' ? 1 : 2}
          allActivePlayers={Object.values(playerRegistry).map((p) => ({
            id: p.id,
            name: p.name,
            avatarColor: p.avatarColor,
            gamesPlayed: p.gamesPlayed,
            currentStreak: p.currentStreak,
            status: p.status,
          }))}
          initialTeam1={activeMatches[editLineupCourt]?.team1 || []}
          initialTeam2={activeMatches[editLineupCourt]?.team2 || []}
          onSave={handleSaveLineup}
          prioritizedBenchPlayerIds={[...restingBench, ...winnersQueue, ...losersQueue]}
          playerMatchCounts={Object.fromEntries(
            Object.values(playerRegistry).map((p) => [p.id, p.gamesPlayed])
          )}
        />
      )}

      {/* Settings Modal */}
      <OpenPlayConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={config}
        onSaveConfig={setConfig}
        onResetSession={() => {
          setShowConfigModal(false);
          setShowResetModal(true);
        }}
      />

      {/* Reset Session Modal */}
      <OpenPlayResetModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onResetKeepPlayers={handleResetKeepPlayers}
        onResetFull={handleResetFull}
        playersCount={winnersQueue.length + losersQueue.length + restingBench.length + playingCount}
        activeMatchesCount={activeMatchesCount}
        historyCount={history.length}
      />

      {/* Session Transfer & Cloud Sync Modal */}
      <TransferSessionModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        currentSessionId={activeSessionId}
        lastSyncedAt={lastSyncedAt}
        isSyncing={isSyncing}
        onManualSync={handleManualSync}
        onLoadSession={handleLoadSession}
        onGenerateNewSession={handleGenerateNewSession}
        playersCount={socialPlayers.length}
        roundsCount={history.length}
      />
    </div>
  );
};
