/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Player, Round, SessionConfig, UpcomingMatch, Bracket, GroupStage, GroupDoubleBracketTournament, Club } from './types';
import { DEFAULT_CONFIG, INITIAL_PLAYERS, AVATAR_COLORS } from './utils/sampleData';
import {
  calculateFairnessMetric,
  generateNextFairRound,
  predictNextTwoMatches,
  getPlayerMatchCounts,
  autoReplacePlayerInRound,
  benchAndReplacePlayerInMatch,
  sanitizeUpcomingOverrides,
  replacePlayerInUpcomingMatches,
  advanceUpcomingQueue,
  sanitizeUpcomingMatches,
  sanitizeRounds,
} from './utils/fairRotation';
import { calculateStandings } from './utils/standings';
import {
  seedEntrants,
  generateBracket,
  recordBracketResult,
  generateGroupDoubleBracketTournament,
  recordGrandFinalResult,
  SeedingMethod,
  DoublesPairingMethod,
} from './utils/bracket';
import { Navbar, TabType } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { ActiveRoundView } from './components/ActiveRoundView';
import { StandingsView } from './components/StandingsView';
import { GroupStageView } from './components/GroupStageView';
import { BracketView } from './components/BracketView';
import { HistoryView } from './components/HistoryView';
import { PlayersView } from './components/PlayersView';
import { FairnessModal } from './components/FairnessModal';
import { SessionConfigModal } from './components/SessionConfigModal';
import { ResetSessionModal } from './components/ResetSessionModal';
import { OnboardingModal } from './components/OnboardingModal';
import { TransferSessionModal } from './components/TransferSessionModal';
import { TournamentCompleteModal } from './components/TournamentCompleteModal';
import { ClubModal } from './components/ClubModal';
import { getActiveClub, CLUB_UPDATED_EVENT, saveClubLocally } from './utils/clubSync';
import { ensurePlayerProfileId, getDevicePlayerProfile } from './utils/identitySync';
import { updatePlayerProfilesMatchStats, saveClubToFirestore } from './lib/firebase';
import {
  generateSessionId,
  generateOrganizerToken,
  setOrganizerToken,
  sanitizeSessionCode,
  saveSessionToCloud,
  fetchSessionFromCloud,
  loadAndApplySession,
  extractSessionId,
  getCurrentOpenPlayData,
  applyOpenPlayData,
  SESSION_LOADED_EVENT,
  SessionData,
} from './utils/sessionSync';
import { soundFx } from './utils/audio';
import confetti from 'canvas-confetti';
import { ArrowRightLeft, X, Link2, Unlink, Smartphone, BatteryCharging, AlertCircle } from 'lucide-react';
import {
  ROSTER_SYNC_EVENT,
  emitRosterSync,
  convertSocialToOpenPlay,
  convertOpenPlayToSocial,
  getStoredSocialPlayers,
  getStoredOpenPlayPlayers,
  setStoredOpenPlayPlayers,
  getStoredOpenPlayBuckets,
  setStoredOpenPlayBuckets,
  getStoredOpenPlayPlayerCount,
  syncSquadBidirectional,
  SOCIAL_STORAGE_KEYS,
} from './utils/playerSync';
import { OpenPlayPlayer } from './types/openPlay';

const STORAGE_KEYS = {
  CONFIG: 'fairclub_config_v1',
  PLAYERS: 'fairclub_players_v1',
  ROUNDS: 'fairclub_rounds_v1',
  UPCOMING: 'fairclub_upcoming_v1',
  ONBOARDED: 'fairclub_onboarded_v1',
  SESSION_ID: 'fairclub_session_id_v1',
  BRACKET: 'fairclub_bracket_v1',
  GROUP_STAGE: 'fairclub_group_stage_v1',
  DOUBLE_TOURNAMENT: 'fairclub_double_tournament_v1',
};

export default function App({
  onNavigateToOpenPlay,
  players: externalPlayers,
  setPlayers: externalSetPlayers,
  onPullFromOpenPlay,
  sessionId: externalSessionId,
  setSessionId: externalSetSessionId,
}: {
  onNavigateToOpenPlay?: () => void;
  players?: Player[];
  setPlayers?: React.Dispatch<React.SetStateAction<Player[]>>;
  onPullFromOpenPlay?: () => void;
  sessionId?: string;
  setSessionId?: React.Dispatch<React.SetStateAction<string>>;
} = {}) {
  // Load initial state from LocalStorage or defaults
  const [config, setConfig] = useState<SessionConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
      return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [internalPlayers, setInternalPlayers] = useState<Player[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PLAYERS);
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

  const players = externalPlayers ?? internalPlayers;
  const setPlayers = externalSetPlayers ?? setInternalPlayers;

  const [rounds, setRounds] = useState<Round[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ROUNDS);
      const parsed: Round[] = saved ? JSON.parse(saved) : [];
      return sanitizeRounds(parsed, INITIAL_PLAYERS);
    } catch {
      return [];
    }
  });

  const [bracket, setBracket] = useState<Bracket | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BRACKET);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [groupStage, setGroupStage] = useState<GroupStage | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GROUP_STAGE);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Sync groupStage to localStorage
  useEffect(() => {
    try {
      if (groupStage) {
        localStorage.setItem(STORAGE_KEYS.GROUP_STAGE, JSON.stringify(groupStage));
      } else {
        localStorage.removeItem(STORAGE_KEYS.GROUP_STAGE);
      }
    } catch {}
  }, [groupStage]);

  const [doubleTournament, setDoubleTournament] = useState<GroupDoubleBracketTournament | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DOUBLE_TOURNAMENT);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Sync doubleTournament to localStorage
  useEffect(() => {
    try {
      if (doubleTournament) {
        localStorage.setItem(STORAGE_KEYS.DOUBLE_TOURNAMENT, JSON.stringify(doubleTournament));
      } else {
        localStorage.removeItem(STORAGE_KEYS.DOUBLE_TOURNAMENT);
      }
    } catch {}
  }, [doubleTournament]);

  const [currentTab, setCurrentTab] = useState<TabType>('active');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showFairnessModal, setShowFairnessModal] = useState(false);
  const [showClubModal, setShowClubModal] = useState(false);
  const [activeClub, setActiveClub] = useState<Club | null>(null);

  // Load and listen for active club updates
  useEffect(() => {
    getActiveClub().then((club) => {
      setActiveClub(club);
    });

    const handleClubEvent = () => {
      getActiveClub().then((club) => {
        setActiveClub(club);
      });
    };

    window.addEventListener(CLUB_UPDATED_EVENT, handleClubEvent);
    return () => {
      window.removeEventListener(CLUB_UPDATED_EVENT, handleClubEvent);
    };
  }, []);

  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      const onboarded = localStorage.getItem(STORAGE_KEYS.ONBOARDED);
      return onboarded !== 'true';
    } catch {
      return true;
    }
  });

  const handleCompleteOnboarding = (newConfig: SessionConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem(STORAGE_KEYS.ONBOARDED, 'true');
    } catch {}
    setShowOnboarding(false);
    // If no players yet, guide user straight to Squad & Bench tab to add players
    if (players.length === 0) {
      setCurrentTab('players');
    }
    soundFx.playPointChime();
  };

  // Auto-replacement & Duo notification banner
  const [replacementNotice, setReplacementNotice] = useState<{
    id: string;
    title: string;
    description: string;
    courtNumber?: number;
    type?: 'replacement' | 'duo' | 'break';
  } | null>(null);

  useEffect(() => {
    if (!replacementNotice) return;
    const timer = setTimeout(() => {
      setReplacementNotice(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [replacementNotice]);

  // Lineup overrides for predicted upcoming matches
  const [upcomingOverrides, setUpcomingOverrides] = useState<{
    match1?: { team1: string[]; team2: string[] };
    match2?: { team1: string[]; team2: string[] };
  }>({});

  // Session ID management for multi-device data transfer (Battery Handover)
  const [internalSessionId, setInternalSessionId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const querySession = params.get('session') || params.get('s');
        if (querySession && querySession.trim()) {
          const clean = extractSessionId(querySession);
          if (clean) return clean;
        }
        const saved = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
        if (saved && saved.trim()) {
          const clean = sanitizeSessionCode(saved);
          if (clean) return clean;
        }
      } catch {}
    }
    const newId = generateSessionId();
    const token = generateOrganizerToken();
    setOrganizerToken(newId, token);
    return newId;
  });

  const sessionId = externalSessionId || internalSessionId;
  const setSessionId = externalSetSessionId || setInternalSessionId;

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTournamentCompleteModal, setShowTournamentCompleteModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [transferToast, setTransferToast] = useState<{
    id: string;
    title: string;
    description: string;
  } | null>(null);
  const [syncAlert, setSyncAlert] = useState<{
    id: string;
    title: string;
    message: string;
  } | null>(null);

  // Sync session ID to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
    } catch {}
  }, [sessionId]);

  // Listen for global sync errors from sessionSync or other tabs
  useEffect(() => {
    const handleSyncError = (e: Event) => {
      const ce = e as CustomEvent<{ error: string }>;
      if (ce.detail?.error) {
        setSyncAlert({
          id: Date.now().toString(),
          title: 'Cloud Sync Notice',
          message: ce.detail.error,
        });
      }
    };
    window.addEventListener('fairplay:sync-error', handleSyncError);
    return () => window.removeEventListener('fairplay:sync-error', handleSyncError);
  }, []);

  // Listen for Open Play cloud sync events to keep lastSyncedAt in sync
  useEffect(() => {
    const handleOpenPlaySync = (e: Event) => {
      const ce = e as CustomEvent<{ sessionId: string; timestamp: number }>;
      if (ce.detail && ce.detail.timestamp) {
        setLastSyncedAt(ce.detail.timestamp);
      }
    };
    window.addEventListener('fairplay:openplay-cloud-synced', handleOpenPlaySync);
    return () => window.removeEventListener('fairplay:openplay-cloud-synced', handleOpenPlaySync);
  }, []);

  // Listen for open transfer modal events from Open Play or other components
  useEffect(() => {
    const handleOpenModal = () => setShowTransferModal(true);
    window.addEventListener('open-transfer-modal', handleOpenModal);
    return () => window.removeEventListener('open-transfer-modal', handleOpenModal);
  }, []);

  // Keep URL search query in sync with current session ID
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionId) {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('session') !== sessionId) {
          url.searchParams.set('session', sessionId);
          window.history.replaceState({}, '', url.toString());
        }
      } catch {}
    }
  }, [sessionId]);

  // Listen for global session loaded events from any modal or QR scan
  useEffect(() => {
    const handleSessionLoaded = (e: Event) => {
      const ce = e as CustomEvent<{ session: SessionData }>;
      const s = ce.detail?.session;
      if (s) {
        if (s.config) setConfig(s.config);
        if (s.players && Array.isArray(s.players)) {
          setPlayers(s.players);
        }
        if (s.rounds && Array.isArray(s.rounds)) {
          setRounds(sanitizeRounds(s.rounds, s.players || []));
        }
        if (s.upcomingMatches && Array.isArray(s.upcomingMatches)) {
          setUpcomingMatches(s.upcomingMatches);
        }
        if (s.id) setSessionId(s.id);
        if (s.bracket !== undefined) {
          setBracket(s.bracket);
        }
        if (s.updatedAt) setLastSyncedAt(s.updatedAt);
        setShowOnboarding(false);

        const opCount = s.openPlay?.activeMatches ? Object.keys(s.openPlay.activeMatches).length : 0;
        const extraMsg = opCount > 0 ? ` & ${opCount} active Open Play courts` : '';
        setTransferToast({
          id: Date.now().toString(),
          title: `Session ${s.id} Transferred!`,
          description: `Transferred ${s.players?.length || 0} players, ${s.rounds?.length || 0} tournament rounds${extraMsg}. Match session ready!`,
        });
        soundFx.playVictoryFanfare();
      }
    };

    window.addEventListener(SESSION_LOADED_EVENT, handleSessionLoaded);
    return () => window.removeEventListener(SESSION_LOADED_EVENT, handleSessionLoaded);
  }, [setPlayers]);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    } catch {}
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(players));
    } catch {}
  }, [players]);

  // Track count of players in Open Play for sync indicator
  const [openPlayPlayersCount, setOpenPlayPlayersCount] = useState<number>(() => {
    return getStoredOpenPlayPlayerCount();
  });

  // Explicit overwrite trigger from Social Tournament view
  const handleSyncWithOpenPlay = () => {
    try {
      if (onPullFromOpenPlay) {
        onPullFromOpenPlay();
        setOpenPlayPlayersCount(players.length);
        soundFx.playPointChime();
        setReplacementNotice({
          id: `sync-openplay-${Date.now()}`,
          title: 'Squad Pulled from Open Play',
          description: 'Successfully imported Open Play roster.',
          type: 'replacement',
        });
        emitRosterSync('social');
      }
    } catch (e) {
      console.error('Failed to sync squad with Open Play', e);
    }
  };

  // Listen for real-time roster changes from Open Play (or other tabs)
  useEffect(() => {
    const handleSyncEvent = (e: Event) => {
      // Update count of Open Play players
      try {
        setOpenPlayPlayersCount(getStoredOpenPlayPlayerCount());
      } catch {}

      const customEvent = e as CustomEvent<{ source?: string; updatedPlayers?: Player[] }>;
      if (customEvent.detail?.source === 'social' && customEvent.detail?.updatedPlayers) {
        setPlayers(customEvent.detail.updatedPlayers);
      } else if (e.type === 'storage') {
        const se = e as StorageEvent;
        if (se.key === SOCIAL_STORAGE_KEYS.PLAYERS && se.newValue) {
          try {
            const parsed = JSON.parse(se.newValue);
            if (Array.isArray(parsed)) {
              setPlayers(parsed);
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ROUNDS, JSON.stringify(rounds));
    } catch {}
  }, [rounds]);

  useEffect(() => {
    try {
      if (bracket) {
        localStorage.setItem(STORAGE_KEYS.BRACKET, JSON.stringify(bracket));
      } else {
        localStorage.removeItem(STORAGE_KEYS.BRACKET);
      }
    } catch {}
  }, [bracket]);

  useEffect(() => {
    setRounds((prevRounds) => sanitizeRounds(prevRounds, players));
  }, []);

  // Players lookup map
  const playersMap = useMemo(() => {
    const map: Record<string, Player> = {};
    players.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [players]);

  // Player match count lookup
  const playerMatchCounts = useMemo(() => {
    return getPlayerMatchCounts(players, rounds);
  }, [players, rounds]);

  // Fairness calculations
  const fairness = useMemo(() => {
    return calculateFairnessMetric(players, rounds);
  }, [players, rounds]);

  // Standings calculation (automated after every match update)
  const standings = useMemo(() => {
    return calculateStandings(players, rounds);
  }, [players, rounds]);

  // Upcoming matches state (On-Deck: Match 1 & In-The-Hole: Match 2)
  // Per user requirements:
  // - When a duo is locked, it MUST NOT replace the players on deck or in the hole!
  // - They must wait for their new generated match for them to be locked together.
  // - Replacement on deck or in the hole should ONLY happen when a player quits, is removed, or break/paused!
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.UPCOMING);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return predictNextTwoMatches({
      players: INITIAL_PLAYERS,
      rounds: [],
      courtsCount: DEFAULT_CONFIG.courtsCount,
      playersPerTeam: DEFAULT_CONFIG.playersPerTeam,
    });
  });

  // Sync upcoming matches to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.UPCOMING, JSON.stringify(upcomingMatches));
    } catch {}
  }, [upcomingMatches]);

  // If upcoming matches are empty on start, generate initial upcoming queue
  useEffect(() => {
    if (
      upcomingMatches.length === 0 &&
      players.filter((p) => p.active).length >= config.playersPerTeam * 2
    ) {
      const initialMatches = predictNextTwoMatches({
        players,
        rounds,
        courtsCount: config.courtsCount,
        playersPerTeam: config.playersPerTeam,
      });
      setUpcomingMatches(initialMatches);
    }
  }, []);

  // When config team size changes, re-predict upcoming matches
  useEffect(() => {
    if (upcomingMatches.length > 0) {
      const match1 = upcomingMatches[0];
      if (match1.team1PlayerIds.length !== config.playersPerTeam) {
        const fresh = predictNextTwoMatches({
          players,
          rounds,
          courtsCount: config.courtsCount,
          playersPerTeam: config.playersPerTeam,
        });
        setUpcomingMatches(fresh);
      }
    }
  }, [config.playersPerTeam, config.courtsCount]);

  const isInitialMount = useRef(true);

  // Debounced auto-save to cloud server whenever tournament state changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      saveSessionToCloud(sessionId, {
        config,
        players,
        rounds,
        upcomingMatches,
        openPlay: getCurrentOpenPlayData(),
      }).then((res) => {
        if (res.success) {
          setLastSyncedAt(Date.now());
        } else {
          setSyncAlert({
            id: Date.now().toString(),
            title: 'Cloud Sync Notice',
            message: res.error || 'Failed to sync with cloud. All tournament data remains safe on this device.',
          });
        }
      }).catch((err: any) => {
        console.warn('Background auto-save caught:', err);
        setSyncAlert({
          id: Date.now().toString(),
          title: 'Cloud Sync Notice',
          message: err?.message || 'Network error saving session to cloud. Your changes remain saved locally.',
        });
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [sessionId, config, players, rounds, upcomingMatches]);

  // Manual cloud sync
  const handleManualSync = async (): Promise<boolean> => {
    setIsSyncing(true);
    const res = await saveSessionToCloud(sessionId, {
      config,
      players,
      rounds,
      upcomingMatches,
      openPlay: getCurrentOpenPlayData(),
    });
    setIsSyncing(false);
    if (res.success) {
      setLastSyncedAt(Date.now());
      soundFx.playPointChime();
      return true;
    } else {
      setSyncAlert({
        id: Date.now().toString(),
        title: 'Cloud Sync Notice',
        message: res.error || 'Failed to sync with cloud. All tournament data remains safe on this device.',
      });
      return false;
    }
  };

  // Load a session from another phone by ID or link
  const handleLoadSession = async (targetId: string): Promise<{ success: boolean; error?: string }> => {
    setIsSyncing(true);
    const res = await loadAndApplySession(targetId);
    setIsSyncing(false);

    if (res.success && res.session) {
      const s = res.session;
      if (s.config) setConfig(s.config);
      if (s.players && Array.isArray(s.players)) setPlayers(s.players);
      if (s.rounds && Array.isArray(s.rounds)) setRounds(sanitizeRounds(s.rounds, s.players || []));
      if (s.upcomingMatches && Array.isArray(s.upcomingMatches)) setUpcomingMatches(s.upcomingMatches);
      setSessionId(s.id);
      setLastSyncedAt(s.updatedAt || Date.now());
      setShowOnboarding(false);

      const opCount = s.openPlay?.activeMatches ? Object.keys(s.openPlay.activeMatches).length : 0;
      const extraMsg = opCount > 0 ? ` & ${opCount} active Open Play courts` : '';
      setTransferToast({
        id: Date.now().toString(),
        title: `Session ${s.id} Connected!`,
        description: `Successfully loaded ${s.players?.length || 0} players, ${s.rounds?.length || 0} rounds${extraMsg}. Match control transferred!`,
      });
      soundFx.playVictoryFanfare();
      return { success: true };
    }

    return { success: false, error: res.error || 'Failed to load session from cloud' };
  };

  // Generate brand new session ID
  const handleGenerateNewSession = () => {
    const newId = generateSessionId();
    const token = generateOrganizerToken();
    setOrganizerToken(newId, token);
    setSessionId(newId);
    saveSessionToCloud(newId, {
      config,
      players,
      rounds,
      upcomingMatches,
      openPlay: getCurrentOpenPlayData(),
    }).then((res) => {
      if (res.success) {
        setLastSyncedAt(Date.now());
      } else {
        setSyncAlert({
          id: Date.now().toString(),
          title: 'Cloud Sync Notice',
          message: res.error || 'Failed to sync new session with cloud.',
        });
      }
    }).catch((err: any) => {
      setSyncAlert({
        id: Date.now().toString(),
        title: 'Cloud Sync Notice',
        message: err?.message || 'Network error syncing new session to cloud.',
      });
    });
    setTransferToast({
      id: Date.now().toString(),
      title: `New Session ID: ${newId}`,
      description: 'Session ID refreshed. Share this new link with other phones.',
    });
  };

  // Current active round selection (allows navigating to previous rounds)
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number | null>(null);

  const activeRoundIndex = useMemo(() => {
    if (rounds.length === 0) return 0;
    if (selectedRoundNumber !== null) {
      const foundIdx = rounds.findIndex((r) => r.roundNumber === selectedRoundNumber);
      if (foundIdx !== -1) return foundIdx;
    }
    return rounds.length - 1;
  }, [rounds, selectedRoundNumber]);

  const currentRound = rounds.length > 0 ? rounds[activeRoundIndex] : null;

  // Monitor tournament completion
  useEffect(() => {
    if (
      config.tournamentMode?.enabled &&
      config.tournamentMode.totalRounds > 0 &&
      rounds.length >= config.tournamentMode.totalRounds
    ) {
      const allRoundsDone =
        rounds.length > 0 &&
        rounds.every(
          (r) => r.completed || (r.matches.length > 0 && r.matches.every((m) => m.completed))
        );
      if (allRoundsDone && !config.tournamentMode.completedAt) {
        const now = Date.now();
        setConfig((prev) => ({
          ...prev,
          tournamentMode: {
            ...prev.tournamentMode!,
            completedAt: now,
          },
        }));
        setShowTournamentCompleteModal(true);
        soundFx.playVictoryFanfare();
        try {
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.5 },
          });
        } catch {}
      }
    }
  }, [rounds, config.tournamentMode]);

  const handleRunExtraTournamentRound = () => {
    setConfig((prev) => ({
      ...prev,
      tournamentMode: {
        ...prev.tournamentMode!,
        totalRounds: (prev.tournamentMode?.totalRounds || rounds.length) + 1,
        completedAt: undefined,
      },
    }));
    setShowTournamentCompleteModal(false);
    handleGenerateNextRound();
  };

  const handleStartNewTournament = () => {
    setShowTournamentCompleteModal(false);
    handleResetSession();
    setShowOnboarding(true);
  };

  const handleExitTournamentMode = () => {
    setConfig((prev) => ({
      ...prev,
      tournamentMode: {
        enabled: false,
        totalRounds: 0,
        locked: false,
        completedAt: undefined,
      },
    }));
    setShowTournamentCompleteModal(false);
    setReplacementNotice({
      id: `exit-tournament-${Date.now()}`,
      title: 'Tournament Mode Concluded',
      description: 'Switched to Casual Open Rotation. You can continue playing casual rounds freely.',
      type: 'replacement',
    });
  };

  // Generate Next Fair Round
  const handleGenerateNextRound = () => {
    if (config.tournamentMode?.enabled && !config.tournamentMode.locked) {
      setConfig((prev) => ({
        ...prev,
        tournamentMode: {
          ...prev.tournamentMode!,
          locked: true,
        },
      }));
    }

    const onDeck = upcomingMatches.find((m) => m.matchNumber === 1);
    const newRound = generateNextFairRound({
      players,
      rounds,
      courtsCount: config.courtsCount,
      playersPerTeam: config.playersPerTeam,
      onDeckMatch: onDeck,
    });

    const updatedRounds = [...rounds, newRound];
    setRounds(updatedRounds);
    setSelectedRoundNumber(newRound.roundNumber);
    setCurrentTab('active');

    // If new cycle reached, trigger fanfare!
    const newMetric = calculateFairnessMetric(players, updatedRounds);
    if (newMetric.spread === 0 && newMetric.minPlayed > 0) {
      soundFx.playVictoryFanfare();
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
    }
  };

  // Recalculate / Regenerate Current Active Round Matches
  const handleRegenerateCurrentRound = (roundNumber?: number) => {
    const targetRoundNum = roundNumber ?? (currentRound?.roundNumber ?? rounds.length);
    const targetIndex = rounds.findIndex((r) => r.roundNumber === targetRoundNum);
    if (targetIndex === -1) return;

    // Prior rounds up to targetIndex for fair history matrices and deficits
    const previousRounds = rounds.slice(0, targetIndex);

    // If any active players were added after targetRoundNum, align their joinedAtRound to targetRoundNum
    // so they are fully integrated into this round's stats and rotation without penalty
    const adjustedPlayers = players.map((p) => {
      if (p.active && (p.joinedAtRound || 1) > targetRoundNum) {
        return { ...p, joinedAtRound: targetRoundNum };
      }
      return p;
    });
    setPlayers(adjustedPlayers);

    // If regenerating the latest round, check on-deck match
    const onDeck = targetIndex === rounds.length - 1 ? upcomingMatches.find((m) => m.matchNumber === 1) : undefined;

    const regeneratedRound = generateNextFairRound({
      players: adjustedPlayers,
      rounds: previousRounds,
      courtsCount: config.courtsCount,
      playersPerTeam: config.playersPerTeam,
      onDeckMatch: onDeck,
    });

    const updatedRound: Round = {
      ...regeneratedRound,
      roundNumber: targetRoundNum,
      targetMatchesPerPlayer: targetRoundNum,
      matches: regeneratedRound.matches.map((m, idx) => ({
        ...m,
        id: `m-r${targetRoundNum}-m${idx + 1}-${Date.now()}-${idx + 1}`,
        roundNumber: targetRoundNum,
      })),
    };

    const nextRounds = [...rounds];
    nextRounds[targetIndex] = updatedRound;
    setRounds(nextRounds);

    // If this was the latest round, refresh upcoming predicted matches too
    if (targetIndex === rounds.length - 1) {
      const freshUpcoming = predictNextTwoMatches({
        players: adjustedPlayers,
        rounds: nextRounds,
        courtsCount: config.courtsCount,
        playersPerTeam: config.playersPerTeam,
      });
      setUpcomingMatches(freshUpcoming);
    }

    const activeCount = adjustedPlayers.filter((p) => p.active).length;
    setReplacementNotice({
      id: `redraw-${Date.now()}`,
      title: `Round ${targetRoundNum} Redrawn`,
      description: `Generated all ${updatedRound.matches.length} matches for all ${activeCount} active players. 0 benched players!`,
      type: 'replacement',
    });

    soundFx.playPointChime();
  };

  // Start a pending match onto court (unlocks scores & changes box to live yellow gold)
  const handleStartMatch = (matchId: string) => {
    setRounds((prevRounds) => {
      let targetRoundIndex = -1;

      const nextRounds = prevRounds.map((round, rIdx) => {
        const matchIndex = round.matches.findIndex((m) => m.id === matchId);
        if (matchIndex === -1) return round;

        targetRoundIndex = rIdx;
        const updatedMatches = [...round.matches];
        const match = updatedMatches[matchIndex];

        // Find available court if not yet assigned
        let courtToAssign = match.courtNumber;
        if (!courtToAssign) {
          const occupiedCourts = new Set(
            round.matches
              .filter((m) => m.id !== matchId && m.courtNumber && !m.completed)
              .map((m) => m.courtNumber as number)
          );
          for (let c = 1; c <= config.courtsCount; c++) {
            if (!occupiedCourts.has(c)) {
              courtToAssign = c;
              break;
            }
          }
          if (!courtToAssign) {
            courtToAssign = (matchIndex % config.courtsCount) + 1;
          }
        }

        updatedMatches[matchIndex] = {
          ...match,
          courtNumber: courtToAssign,
          status: 'in_progress',
          startedAt: match.startedAt || Date.now(),
        };

        return {
          ...round,
          matches: updatedMatches,
        };
      });

      if (targetRoundIndex === -1) return prevRounds;
      return nextRounds;
    });

    soundFx.playWhistle();
  };

  // Edit Lineup on Active Court Match
  const handleUpdateMatchLineup = (matchId: string, team1: string[], team2: string[]) => {
    setRounds((prevRounds) =>
      prevRounds.map((round) => {
        const matchIndex = round.matches.findIndex((m) => m.id === matchId);
        if (matchIndex === -1) return round;

        const updatedMatches = [...round.matches];
        updatedMatches[matchIndex] = {
          ...updatedMatches[matchIndex],
          team1: { playerIds: team1 },
          team2: { playerIds: team2 },
        };

        // Recompute resting players for this active round
        const playingIds = new Set<string>();
        updatedMatches.forEach((m) => {
          m.team1.playerIds.forEach((id) => playingIds.add(id));
          m.team2.playerIds.forEach((id) => playingIds.add(id));
        });
        const activePlayers = players.filter((p) => p.active);
        const newResting = activePlayers.filter((p) => !playingIds.has(p.id)).map((p) => p.id);

        return {
          ...round,
          matches: updatedMatches,
          restingPlayerIds: newResting,
        };
      })
    );
  };

  // Update Next 2 Matches Override
  const handleUpdateNextMatch = (matchNumber: 1 | 2, team1: string[], team2: string[]) => {
    setUpcomingMatches((prev) =>
      prev.map((m) =>
        m.matchNumber === matchNumber
          ? { ...m, team1PlayerIds: team1, team2PlayerIds: team2, isOverridden: true }
          : m
      )
    );
  };

  // Reset Next Match Override back to auto fair rotation
  const handleResetNextMatch = (matchNumber: 1 | 2) => {
    const fresh = predictNextTwoMatches({
      players,
      rounds,
      courtsCount: config.courtsCount,
      playersPerTeam: config.playersPerTeam,
    });
    const freshMatch = fresh.find((m) => m.matchNumber === matchNumber);
    if (freshMatch) {
      setUpcomingMatches((prev) =>
        prev.map((m) => (m.matchNumber === matchNumber ? freshMatch : m))
      );
    }
  };

  // Shuffle/Swap Partners in Active Social Match
  const handleShuffleSocialMatch = (matchId: string) => {
    setRounds((prevRounds) =>
      prevRounds.map((round) => {
        const matchIndex = round.matches.findIndex((m) => m.id === matchId);
        if (matchIndex === -1) return round;

        const match = round.matches[matchIndex];
        const allCourtPlayers = [...match.team1.playerIds, ...match.team2.playerIds];

        if (allCourtPlayers.length === 4) {
          const [p1, p2, p3, p4] = allCourtPlayers;
          const combinations: [string[], string[]][] = [
            [[p1, p3], [p2, p4]],
            [[p1, p4], [p2, p3]],
            [[p3, p4], [p1, p2]],
            [[p2, p4], [p1, p3]],
            [[p2, p3], [p1, p4]],
          ];

          const currentT1 = match.team1.playerIds.join(',');
          const next =
            combinations.find(
              ([t1]) => t1.join(',') !== currentT1 && t1.slice().reverse().join(',') !== currentT1
            ) || combinations[0];

          const updatedMatches = [...round.matches];
          updatedMatches[matchIndex] = {
            ...match,
            team1: { playerIds: next[0] },
            team2: { playerIds: next[1] },
          };

          return {
            ...round,
            matches: updatedMatches,
          };
        } else if (allCourtPlayers.length === 2) {
          const updatedMatches = [...round.matches];
          updatedMatches[matchIndex] = {
            ...match,
            team1: { playerIds: [allCourtPlayers[1]] },
            team2: { playerIds: [allCourtPlayers[0]] },
          };
          return {
            ...round,
            matches: updatedMatches,
          };
        }
        return round;
      })
    );
  };

  // Update Match Score
  const handleUpdateScore = (
    matchId: string,
    score1: number,
    score2: number,
    completed?: boolean
  ) => {
    setRounds((prevRounds) => {
      let targetRoundIndex = -1;

      let nextRounds = prevRounds.map((round, rIdx) => {
        const matchIndex = round.matches.findIndex((m) => m.id === matchId);
        if (matchIndex === -1) return round;

        targetRoundIndex = rIdx;
        const updatedMatches = [...round.matches];
        const match = updatedMatches[matchIndex];

        let winner: 1 | 2 | 'draw' | undefined = undefined;
        const isCompleted = completed !== undefined ? completed : match.completed;

        if (score1 > score2) winner = 1;
        else if (score2 > score1) winner = 2;
        else winner = 'draw';

        updatedMatches[matchIndex] = {
          ...match,
          score1,
          score2,
          winner,
          status: isCompleted ? 'completed' : 'in_progress',
          completed: isCompleted,
          startedAt: match.startedAt || Date.now(),
          finishedAt: isCompleted ? Date.now() : match.finishedAt,
        };

        const allDone = updatedMatches.every((m) => m.completed);

        return {
          ...round,
          matches: updatedMatches,
          completed: allDone,
        };
      });

      if (targetRoundIndex === -1) return prevRounds;

      return nextRounds;
    });
  };

  // Mark match as completed and promote next queued match within the current round to open court
  const handleCompleteMatch = (matchId: string) => {
    setRounds((prevRounds) => {
      let completedCourtNumber: number | undefined;
      let targetRoundIndex = -1;

      let nextRounds = prevRounds.map((round, rIdx) => {
        const matchIndex = round.matches.findIndex((m) => m.id === matchId);
        if (matchIndex === -1) return round;

        targetRoundIndex = rIdx;
        const updatedMatches = [...round.matches];
        const match = updatedMatches[matchIndex];
        completedCourtNumber = match.courtNumber;

        let winner: 1 | 2 | 'draw' = 'draw';
        if (match.score1 > match.score2) winner = 1;
        else if (match.score2 > match.score1) winner = 2;

        // Cross-session stats aggregation across sessions
        const t1Profiles = match.team1.playerIds
          .map((id) => players.find((p) => p.id === id)?.playerProfileId)
          .filter(Boolean) as string[];
        const t2Profiles = match.team2.playerIds
          .map((id) => players.find((p) => p.id === id)?.playerProfileId)
          .filter(Boolean) as string[];

        let winners: string[] = [];
        let losers: string[] = [];
        if (winner === 1) {
          winners = t1Profiles;
          losers = t2Profiles;
        } else if (winner === 2) {
          winners = t2Profiles;
          losers = t1Profiles;
        }
        if (winners.length > 0 || losers.length > 0) {
          updatePlayerProfilesMatchStats(winners, losers).catch(() => {});
        }

        updatedMatches[matchIndex] = {
          ...match,
          status: 'completed',
          completed: true,
          winner,
          finishedAt: Date.now(),
        };

        const allDone = updatedMatches.every((m) => m.completed);

        return {
          ...round,
          matches: updatedMatches,
          completed: allDone,
        };
      });

      // If a court was vacated, find next queued match within the SAME current round to step onto this court
      if (completedCourtNumber && targetRoundIndex !== -1) {
        const round = nextRounds[targetRoundIndex];
        const pendingIdx = round.matches.findIndex((m) => !m.courtNumber && m.status === 'pending');
        if (pendingIdx !== -1) {
          const updatedMatches = [...round.matches];
          updatedMatches[pendingIdx] = {
            ...updatedMatches[pendingIdx],
            courtNumber: completedCourtNumber,
            status: 'in_progress',
            startedAt: Date.now(),
          };
          nextRounds[targetRoundIndex] = {
            ...round,
            matches: updatedMatches,
          };
        }
      }

      return nextRounds;
    });
  };

  // Reopen match for score editing
  const handleReopenMatch = (matchId: string) => {
    setRounds((prevRounds) =>
      prevRounds.map((round) => {
        const matchIndex = round.matches.findIndex((m) => m.id === matchId);
        if (matchIndex === -1) return round;

        const updatedMatches = [...round.matches];
        updatedMatches[matchIndex] = {
          ...updatedMatches[matchIndex],
          completed: false,
        };

        return {
          ...round,
          matches: updatedMatches,
          completed: false,
        };
      })
    );
  };

  // Delete Match from History
  const handleDeleteMatch = (matchId: string) => {
    setRounds((prevRounds) => {
      const updated = prevRounds
        .map((round) => ({
          ...round,
          matches: round.matches.filter((m) => m.id !== matchId),
        }))
        .filter((round) => round.matches.length > 0)
        .map((round, idx) => ({
          ...round,
          roundNumber: idx + 1,
          matches: round.matches.map((m) => ({ ...m, roundNumber: idx + 1 })),
        }));
      return updated;
    });
    soundFx.playPointChime();
    setReplacementNotice({
      id: `del-match-${Date.now()}`,
      title: 'Match Removed',
      description: 'Match removed from history. Player win/loss records and rotation counts updated.',
      type: 'replacement',
    });
  };

  // Delete Entire Round from History
  const handleDeleteRound = (roundNumber: number) => {
    setRounds((prevRounds) => {
      const updated = prevRounds
        .filter((round) => round.roundNumber !== roundNumber)
        .map((round, idx) => ({
          ...round,
          roundNumber: idx + 1,
          matches: round.matches.map((m) => ({ ...m, roundNumber: idx + 1 })),
        }));
      return updated;
    });
    setSelectedRoundNumber(null);
    soundFx.playPointChime();
    setReplacementNotice({
      id: `del-round-${Date.now()}`,
      title: `Round ${roundNumber} Deleted`,
      description: `Round ${roundNumber} and all its matches removed from session history.`,
      type: 'replacement',
    });
  };

  // Player Management
  const handleAddPlayer = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const colorIndex = players.length % AVATAR_COLORS.length;
    const nextRoundNumber = rounds.length + 1;

    // Cross-session player profile identity
    const { playerProfileId } = await ensurePlayerProfileId(trimmed, {
      avatarColor: AVATAR_COLORS[colorIndex],
      clubId: activeClub?.id,
    });

    const newPlayer: Player = {
      id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      playerProfileId,
      name: trimmed,
      active: true,
      avatarColor: AVATAR_COLORS[colorIndex],
      joinedAtRound: nextRoundNumber,
    };
    setPlayers((prev) => [...prev, newPlayer]);

    // If session is owned by a club, add this playerProfileId to club members
    if (activeClub && !activeClub.memberProfileIds.includes(playerProfileId)) {
      const updatedClub: Club = {
        ...activeClub,
        memberProfileIds: [...activeClub.memberProfileIds, playerProfileId],
        updatedAt: Date.now(),
      };
      setActiveClub(updatedClub);
      saveClubLocally(updatedClub);
      saveClubToFirestore(updatedClub).catch(() => {});
    }

    if (rounds.length > 0) {
      soundFx.playPointChime();
      setReplacementNotice({
        id: `late-player-${Date.now()}`,
        title: `Late Joiner: ${trimmed}`,
        description: `Prioritized to play FIRST in Round ${nextRoundNumber} with catch-up match scheduling.`,
        type: 'replacement',
      });
    }
  };

  const handleBulkAddPlayers = async (names: string[]) => {
    const nextRoundNumber = rounds.length + 1;
    const newMemberProfileIds: string[] = [];

    const newItems: Player[] = await Promise.all(
      names.map(async (name, i) => {
        const trimmed = name.trim();
        const colorIndex = (players.length + i) % AVATAR_COLORS.length;
        const { playerProfileId } = await ensurePlayerProfileId(trimmed, {
          avatarColor: AVATAR_COLORS[colorIndex],
          clubId: activeClub?.id,
        });

        if (activeClub && !activeClub.memberProfileIds.includes(playerProfileId)) {
          newMemberProfileIds.push(playerProfileId);
        }

        return {
          id: `p-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          playerProfileId,
          name: trimmed,
          active: true,
          avatarColor: AVATAR_COLORS[colorIndex],
          joinedAtRound: nextRoundNumber,
        };
      })
    );

    setPlayers((prev) => [...prev, ...newItems]);

    if (activeClub && newMemberProfileIds.length > 0) {
      const updatedClub: Club = {
        ...activeClub,
        memberProfileIds: Array.from(
          new Set([...activeClub.memberProfileIds, ...newMemberProfileIds])
        ),
        updatedAt: Date.now(),
      };
      setActiveClub(updatedClub);
      saveClubLocally(updatedClub);
      saveClubToFirestore(updatedClub).catch(() => {});
    }

    if (rounds.length > 0) {
      soundFx.playPointChime();
      setReplacementNotice({
        id: `late-bulk-${Date.now()}`,
        title: `${names.length} Late Joiners Added`,
        description: `Prioritized to play FIRST in Round ${nextRoundNumber} with catch-up rotation.`,
        type: 'replacement',
      });
    }
  };

  const handleTogglePlayerActive = (playerId: string) => {
    const targetPlayer = players.find((p) => p.id === playerId);
    if (!targetPlayer) return;

    const willBeActive = !targetPlayer.active;
    const partnerId = targetPlayer.duoPartnerId;
    const shouldBreakDuo = !willBeActive && !!partnerId;
    const partner = partnerId ? players.find((p) => p.id === partnerId) : null;

    const updatedPlayers = players.map((p) => {
      if (p.id === playerId) {
        return {
          ...p,
          active: willBeActive,
          duoPartnerId: shouldBreakDuo ? null : p.duoPartnerId,
        };
      }
      if (shouldBreakDuo && p.id === partnerId) {
        return { ...p, duoPartnerId: null };
      }
      return p;
    });
    setPlayers(updatedPlayers);

    if (shouldBreakDuo) {
      setReplacementNotice({
        id: `duo-break-${Date.now()}`,
        title: `Team Separated`,
        description: `${targetPlayer.name} was paused/benched, breaking the locked duo with ${partner?.name || 'partner'}.`,
        type: 'break',
      });
    }

    // If player was benched / deactivated, auto-replace them in current active round if playing!
    if (!willBeActive && rounds.length > 0) {
      const latestRound = rounds[rounds.length - 1];
      if (!latestRound.completed) {
        const replaceResult = autoReplacePlayerInRound({
          round: latestRound,
          targetPlayerId: playerId,
          players: updatedPlayers,
          rounds,
          targetPlayerName: targetPlayer.name,
        });

        if (replaceResult.replaced) {
          setRounds((prev) => {
            const next = [...prev];
            next[next.length - 1] = replaceResult.updatedRound;
            return next;
          });

          const replacementName = replaceResult.replacementEvent?.replacementPlayer?.name;
          const courtNum = replaceResult.replacementEvent?.courtNumber;
          soundFx.playPointChime();
          setReplacementNotice({
            id: `sub-${Date.now()}`,
            title: `${targetPlayer.name} Benched`,
            description: replacementName
              ? `Automatically replaced on Court ${courtNum} by ${replacementName} (highest fair rotation priority from bench).`
              : `Removed from Court ${courtNum}. No active bench players available to substitute.`,
            courtNumber: courtNum,
            type: 'replacement',
          });
        }
      }
    }

    // REPLACEMENT ON DECK OR IN THE HOLE:
    // Replacement on deck or in hole ONLY happens when a player quits, is removed, or break/paused!
    if (!willBeActive) {
      const courtPlayingIds = new Set<string>();
      if (rounds.length > 0 && !rounds[rounds.length - 1].completed) {
        rounds[rounds.length - 1].matches.forEach((m) => {
          m.team1.playerIds.forEach((id) => courtPlayingIds.add(id));
          m.team2.playerIds.forEach((id) => courtPlayingIds.add(id));
        });
      }
      const { updatedUpcoming, replacementEvents } = replacePlayerInUpcomingMatches({
        upcomingMatches,
        targetPlayerId: playerId,
        players: updatedPlayers,
        rounds,
        targetPlayerName: targetPlayer.name,
        currentlyPlayingCourtPlayerIds: courtPlayingIds,
      });

      if (replacementEvents.length > 0) {
        setUpcomingMatches(updatedUpcoming);
        const event = replacementEvents[0];
        const replName = event.replacementPlayer?.name;
        soundFx.playPointChime();
        setReplacementNotice({
          id: `upcoming-sub-${Date.now()}`,
          title: `${targetPlayer.name} Paused`,
          description: replName
            ? `Replaced on ${event.matchLabel} by ${replName} (highest fair priority). Other scheduled players kept intact.`
            : `Removed from ${event.matchLabel}. No active bench players available to substitute.`,
          type: 'replacement',
        });
      }
    }
  };

  const handleRemovePlayer = (playerId: string) => {
    const targetPlayer = players.find((p) => p.id === playerId);
    if (!targetPlayer) return;

    const partnerId = targetPlayer.duoPartnerId;
    const partner = partnerId ? players.find((p) => p.id === partnerId) : null;

    const remainingPlayers = players
      .filter((p) => p.id !== playerId)
      .map((p) => (partnerId && p.id === partnerId ? { ...p, duoPartnerId: null } : p));
    
    // 1. Immediately write to localStorage so any sync reads have the updated data synchronously!
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(remainingPlayers));
      localStorage.setItem(SOCIAL_STORAGE_KEYS.PLAYERS, JSON.stringify(remainingPlayers));
    } catch (e) {
      console.error(e);
    }
    setPlayers(remainingPlayers);

    if (partnerId) {
      setReplacementNotice({
        id: `duo-del-${Date.now()}`,
        title: `Team Separated: ${targetPlayer.name} Left Squad`,
        description: `${targetPlayer.name} was removed from the squad, breaking the locked duo with ${partner?.name || 'partner'}.`,
        type: 'break',
      });
    }

    // 2. Comprehensive cleanup of all uncompleted rounds
    if (rounds.length > 0) {
      setRounds((prevRounds) => {
        const nextRounds = [...prevRounds];
        let replacementNoticeSet = false;

        for (let i = 0; i < nextRounds.length; i++) {
          if (!nextRounds[i].completed) {
            // Use autoReplace to attempt court substitution
            const replaceResult = autoReplacePlayerInRound({
              round: nextRounds[i],
              targetPlayerId: playerId,
              players: remainingPlayers,
              rounds: nextRounds,
              targetPlayerName: targetPlayer.name,
            });

            // ALWAYS apply the updated round, even if they were just on the bench
            let updatedRound = replaceResult.updatedRound;

            // Failsafe: Hard remove the player from everything in the round just in case
            updatedRound = {
              ...updatedRound,
              restingPlayerIds: (updatedRound.restingPlayerIds || []).filter(id => id !== playerId),
              matches: updatedRound.matches.map(m => {
                if (m.completed) return m;
                return {
                  ...m,
                  team1: { ...m.team1, playerIds: m.team1.playerIds.filter(id => id !== playerId) },
                  team2: { ...m.team2, playerIds: m.team2.playerIds.filter(id => id !== playerId) },
                };
              })
            };

            nextRounds[i] = updatedRound;

            if (replaceResult.replaced && !replacementNoticeSet) {
              const replacementName = replaceResult.replacementEvent?.replacementPlayer?.name;
              const courtNum = replaceResult.replacementEvent?.courtNumber;
              soundFx.playPointChime();
              setReplacementNotice({
                id: `del-${Date.now()}`,
                title: `${targetPlayer.name} Deleted`,
                description: replacementName
                  ? `Automatically replaced on Court ${courtNum} by ${replacementName}.`
                  : `Removed from Court ${courtNum}. No bench players available.`,
                courtNumber: courtNum,
                type: 'replacement',
              });
              replacementNoticeSet = true;
            }
          }
        }
        try {
          localStorage.setItem(STORAGE_KEYS.ROUNDS, JSON.stringify(nextRounds));
        } catch {}
        return nextRounds;
      });
    }

    // 3. REPLACEMENT ON DECK OR IN THE HOLE:
    const courtPlayingIds = new Set<string>();
    if (rounds.length > 0 && !rounds[rounds.length - 1].completed) {
      rounds[rounds.length - 1].matches.forEach((m) => {
        m.team1.playerIds.forEach((id) => courtPlayingIds.add(id));
        m.team2.playerIds.forEach((id) => courtPlayingIds.add(id));
      });
    }
    const { updatedUpcoming, replacementEvents } = replacePlayerInUpcomingMatches({
      upcomingMatches,
      targetPlayerId: playerId,
      players: remainingPlayers,
      rounds,
      targetPlayerName: targetPlayer.name,
      currentlyPlayingCourtPlayerIds: courtPlayingIds,
    });

    if (replacementEvents.length > 0) {
      setUpcomingMatches(updatedUpcoming);
      try {
        localStorage.setItem(STORAGE_KEYS.UPCOMING, JSON.stringify(updatedUpcoming));
      } catch {}
      const event = replacementEvents[0];
      const replName = event.replacementPlayer?.name;
      soundFx.playPointChime();
      setReplacementNotice({
        id: `upcoming-sub-del-${Date.now()}`,
        title: `${targetPlayer.name} Left Squad`,
        description: replName
          ? `Replaced on ${event.matchLabel} by ${replName} (highest fair priority). Other scheduled players kept intact.`
          : `Removed from ${event.matchLabel}.`,
        type: 'replacement',
      });
    }

    // 4. Bidirectional sync: explicitly remove from Open Play buckets and players as well
    try {
      const buckets = getStoredOpenPlayBuckets();
      const nextWinners = buckets.winnersQueue.filter((id) => id !== playerId);
      const nextLosers = buckets.losersQueue.filter((id) => id !== playerId);
      const nextBench = buckets.restingBench.filter((id) => id !== playerId);
      setStoredOpenPlayBuckets({
        winnersQueue: nextWinners,
        losersQueue: nextLosers,
        restingBench: nextBench,
      });

      const storedOpPlayers = getStoredOpenPlayPlayers().filter((p) => p.id !== playerId);
      setStoredOpenPlayPlayers(storedOpPlayers);

      setOpenPlayPlayersCount(getStoredOpenPlayPlayerCount());
    } catch (e) {
      console.error('Failed to sync player deletion to Open Play', e);
    }

    // 5. Emit sync with explicit remainingPlayers payload!
    emitRosterSync('social', remainingPlayers);
  };

  // Explicitly bench a player from an active court match and immediately sub in the prioritized bench player
  const handleBenchAndReplacePlayer = (matchId: string, playerToBenchId: string) => {
    if (rounds.length === 0) return;
    const latestRound = rounds[rounds.length - 1];
    if (latestRound.completed) return;

    const targetPlayer = players.find((p) => p.id === playerToBenchId);
    if (!targetPlayer) return;

    const result = benchAndReplacePlayerInMatch({
      round: latestRound,
      matchId,
      playerToBenchId,
      players,
      rounds,
    });

    if (result.replaced) {
      setRounds((prev) => {
        const next = [...prev];
        next[next.length - 1] = result.updatedRound;
        return next;
      });

      // If the substitute was in upcoming matches, replace them in upcoming matches to prevent double booking
      if (result.replacementPlayer) {
        const activeCourtIds = new Set<string>();
        result.updatedRound.matches.forEach((m) => {
          m.team1.playerIds.forEach((id) => activeCourtIds.add(id));
          m.team2.playerIds.forEach((id) => activeCourtIds.add(id));
        });
        const { updatedUpcoming } = replacePlayerInUpcomingMatches({
          upcomingMatches,
          targetPlayerId: result.replacementPlayer.id,
          players,
          rounds,
          currentlyPlayingCourtPlayerIds: activeCourtIds,
        });
        setUpcomingMatches(updatedUpcoming);
      }

      const replacementName = result.replacementPlayer?.name;
      const match = latestRound.matches.find((m) => m.id === matchId);
      const courtNum = match ? match.courtNumber : 1;

      // If the benched player was in a locked duo, break the duo
      if (targetPlayer.duoPartnerId) {
        const partnerId = targetPlayer.duoPartnerId;
        const partner = players.find((p) => p.id === partnerId);
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === playerToBenchId || p.id === partnerId ? { ...p, duoPartnerId: null } : p
          )
        );

        soundFx.playPointChime();
        setReplacementNotice({
          id: `bench-match-${Date.now()}`,
          title: `Team Separated: ${targetPlayer.name} Benched`,
          description: `${targetPlayer.name} was moved to the bench, breaking the duo with ${partner?.name || 'partner'}. Subbed on Court ${courtNum} by ${replacementName || 'bench player'}.`,
          courtNumber: courtNum,
          type: 'break',
        });
      } else {
        soundFx.playPointChime();
        setReplacementNotice({
          id: `bench-match-${Date.now()}`,
          title: `${targetPlayer.name} Moved to Bench`,
          description: replacementName
            ? `Subbed out of Court ${courtNum} and replaced by ${replacementName} (highest fair priority: ${playerMatchCounts[result.replacementPlayer?.id || ''] || 0} GP).`
            : `Subbed out of Court ${courtNum}. No bench players available.`,
          courtNumber: courtNum,
          type: 'replacement',
        });
      }
    }
  };

  // Locked Duo Linking & Unlinking
  const handleLinkDuo = (player1Id: string, player2Id: string) => {
    if (player1Id === player2Id) return;
    const p1 = players.find((p) => p.id === player1Id);
    const p2 = players.find((p) => p.id === player2Id);
    if (!p1 || !p2) return;

    const oldPartner1 = p1.duoPartnerId;
    const oldPartner2 = p2.duoPartnerId;

    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === player1Id) {
          return { ...p, duoPartnerId: player2Id };
        }
        if (p.id === player2Id) {
          return { ...p, duoPartnerId: player1Id };
        }
        if ((oldPartner1 && p.id === oldPartner1) || (oldPartner2 && p.id === oldPartner2)) {
          return { ...p, duoPartnerId: null };
        }
        return p;
      })
    );

    // CRITICAL (Per user directive):
    // When a duo is locked, it MUST NOT replace the players on deck or in the hole!
    // They must wait for their new generated match for them to be locked together.
    // Upcoming matches remain untouched!
    soundFx.playPointChime();
    setReplacementNotice({
      id: `duo-linked-${Date.now()}`,
      title: `🤝 Locked Duo: ${p1.name} & ${p2.name}`,
      description: `Locked for their next newly generated match! Current On-Deck and In-The-Hole lineups remain untouched.`,
      type: 'duo',
    });
  };

  const handleUnlinkDuo = (playerId: string) => {
    const target = players.find((p) => p.id === playerId);
    if (!target || !target.duoPartnerId) return;
    const partnerId = target.duoPartnerId;
    const partner = players.find((p) => p.id === partnerId);

    setPlayers((prev) =>
      prev.map((p) =>
        p.id === playerId || p.id === partnerId ? { ...p, duoPartnerId: null } : p
      )
    );

    soundFx.playWhistle();
    setReplacementNotice({
      id: `duo-unlinked-${Date.now()}`,
      title: `💔 Duo Separated`,
      description: `${target.name} and ${partner ? partner.name : 'partner'} are no longer locked together as a team. Current scheduled matches remain intact.`,
      type: 'break',
    });
  };

  const handleEditPlayer = (playerId: string, updatedFields: Partial<Player>) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, ...updatedFields } : p))
    );
  };

  // Reset Session (clears rounds and matches, retains roster)
  const handleResetSession = () => {
    try {
      setRounds([]);
      setSelectedRoundNumber(null);
      setReplacementNotice(null);
      setBracket(null);
      setGroupStage(null);
      setDoubleTournament(null);
      localStorage.removeItem(STORAGE_KEYS.ROUNDS);
      localStorage.removeItem(STORAGE_KEYS.BRACKET);
      localStorage.removeItem(STORAGE_KEYS.GROUP_STAGE);
      localStorage.removeItem(STORAGE_KEYS.DOUBLE_TOURNAMENT);
      const fresh = predictNextTwoMatches({
        players,
        rounds: [],
        courtsCount: config.courtsCount,
        playersPerTeam: config.playersPerTeam,
      });
      setUpcomingMatches(fresh);
      localStorage.removeItem(STORAGE_KEYS.UPCOMING);
    } catch (err) {
      console.error('Failed to reset session', err);
    }
  };

  // Clear Roster (clears all players, rounds, and matches)
  const handleClearRoster = () => {
    try {
      setPlayers([]);
      setRounds([]);
      setSelectedRoundNumber(null);
      setUpcomingMatches([]);
      setReplacementNotice(null);
      setBracket(null);
      setGroupStage(null);
      setDoubleTournament(null);
      localStorage.removeItem(STORAGE_KEYS.PLAYERS);
      localStorage.removeItem(SOCIAL_STORAGE_KEYS.PLAYERS);
      localStorage.removeItem(STORAGE_KEYS.ROUNDS);
      localStorage.removeItem(STORAGE_KEYS.UPCOMING);
      localStorage.removeItem(STORAGE_KEYS.BRACKET);
      localStorage.removeItem(STORAGE_KEYS.GROUP_STAGE);
      localStorage.removeItem(STORAGE_KEYS.DOUBLE_TOURNAMENT);
      emitRosterSync('social', []);
    } catch (err) {
      console.error('Failed to clear roster', err);
    }
  };

  // Bracket Mode Handlers
  const handleStartBracket = (
    method: SeedingMethod,
    format: 'singles' | 'doubles',
    doublesPairingMethod: DoublesPairingMethod,
    selectedPlayerIds?: string[]
  ) => {
    const candidatePlayers =
      selectedPlayerIds && selectedPlayerIds.length > 0
        ? players.filter((p) => selectedPlayerIds.includes(p.id))
        : players;

    const entrants = seedEntrants(
      candidatePlayers,
      method,
      standings,
      {
        format,
        doublesPairingMethod,
      }
    );

    const newBracket = generateBracket(entrants);

    setBracket(newBracket);
    setCurrentTab('bracket');
    soundFx.playWhistle();
  };

  const handleRecordBracketResult = (matchId: string, score1: number, score2: number) => {
    if (!bracket) return;
    const updated = recordBracketResult(bracket, matchId, score1, score2);
    setBracket(updated);
    if (updated.championPlayerIds && updated.championPlayerIds.length > 0) {
      soundFx.playVictoryFanfare();
    }
  };

  const handleResetBracket = () => {
    setBracket(null);
    soundFx.playPointChime();
  };

  // Group Stage & Double Bracket Handlers
  const handleUpdateGroupStage = (updatedStage: GroupStage | null) => {
    setGroupStage(updatedStage);
    if (updatedStage && updatedStage.completedAt) {
      const finalsFormat = config.tournamentMode?.finalsFormat || 'single_final';
      const dt = generateGroupDoubleBracketTournament(updatedStage, players, config, finalsFormat);
      setDoubleTournament(dt);
    } else if (!updatedStage) {
      setDoubleTournament(null);
    }
  };

  const handleRecordDoubleBracketResult = (
    bracketType: 'winners' | 'losers',
    matchId: string,
    score1: number,
    score2: number
  ) => {
    if (!doubleTournament) return;
    const targetBracket =
      bracketType === 'winners' ? doubleTournament.winnersBracket : doubleTournament.losersBracket;
    const updatedTargetBracket = recordBracketResult(targetBracket, matchId, score1, score2);

    const updatedTournament: GroupDoubleBracketTournament = {
      ...doubleTournament,
      winnersBracket: bracketType === 'winners' ? updatedTargetBracket : doubleTournament.winnersBracket,
      losersBracket: bracketType === 'losers' ? updatedTargetBracket : doubleTournament.losersBracket,
    };
    setDoubleTournament(updatedTournament);

    if (updatedTargetBracket.championPlayerIds && updatedTargetBracket.championPlayerIds.length > 0) {
      soundFx.playPointChime();
    }
  };

  const handleRecordGrandFinalResult = (
    matchType: 'match1' | 'resetMatch',
    score1: number,
    score2: number
  ) => {
    if (!doubleTournament) return;
    const updated = recordGrandFinalResult(doubleTournament, matchType, score1, score2);
    setDoubleTournament(updated);
    if (updated.grandFinal?.championId) {
      soundFx.playVictoryFanfare();
    }
  };

  const handleResetDoubleTournament = () => {
    setDoubleTournament(null);
    soundFx.playPointChime();
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col">
      {/* Sticky Header Navigation */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        config={config}
        fairness={fairness}
        playersCount={players.length}
        roundsCount={rounds.length}
        onOpenConfig={() => setShowConfigModal(true)}
        onOpenFairness={() => setShowFairnessModal(true)}
        sessionId={sessionId}
        onOpenTransfer={() => setShowTransferModal(true)}
        isSyncing={isSyncing}
        onNavigateToOpenPlay={onNavigateToOpenPlay}
        hasActiveBracket={Boolean(bracket || doubleTournament)}
        hasActiveGroupStage={Boolean(groupStage)}
        activeClub={activeClub}
        onOpenClubModal={() => setShowClubModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-4 pb-36 sm:pb-40 md:pb-10 overflow-x-hidden">
        {/* Multi-Device Transfer Success Alert */}
        {transferToast && (
          <div
            id="alert-session-transferred"
            className="mb-3 sm:mb-4 p-3 sm:p-4 rounded-2xl bg-indigo-900 text-white border border-indigo-700 shadow-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-yellow-400 text-indigo-950 flex items-center justify-center font-black shrink-0 shadow-sm">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black flex items-center gap-2">
                  <span>{transferToast.title}</span>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                    Session Transferred
                  </span>
                </div>
                <p className="text-xs text-indigo-200 mt-0.5 leading-relaxed">
                  {transferToast.description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTransferToast(null)}
              className="p-1.5 rounded-xl bg-indigo-800 hover:bg-indigo-700 text-indigo-200 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Dismiss"
              aria-label="Dismiss transfer notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Cloud Sync Failure / Permission Notice */}
        {syncAlert && (
          <div
            id="alert-cloud-sync"
            className="mb-3 sm:mb-4 p-3 sm:p-4 rounded-2xl bg-rose-950 text-white border border-rose-800 shadow-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-black shrink-0 shadow-sm">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black flex items-center gap-2">
                  <span>{syncAlert.title}</span>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Offline Resilient
                  </span>
                </div>
                <p className="text-xs text-rose-200 mt-0.5 leading-relaxed">
                  {syncAlert.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSyncAlert(null)}
              className="p-1.5 rounded-xl bg-rose-900 hover:bg-rose-800 text-rose-200 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Dismiss"
              aria-label="Dismiss sync notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Dynamic Auto-Replacement & Duo Alert Banner */}
        {replacementNotice && (
          <div
            id="alert-auto-replacement"
            className={`mb-3 sm:mb-4 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-white border shadow-sm flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
              replacementNotice.type === 'duo'
                ? 'bg-emerald-950 border-emerald-700'
                : replacementNotice.type === 'break'
                ? 'bg-rose-950 border-rose-800'
                : 'bg-indigo-950 border-indigo-700'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 shadow-sm ${
                  replacementNotice.type === 'duo'
                    ? 'bg-emerald-400 text-emerald-950'
                    : replacementNotice.type === 'break'
                    ? 'bg-rose-400 text-rose-950'
                    : 'bg-amber-400 text-indigo-950'
                }`}
              >
                {replacementNotice.type === 'duo' ? (
                  <Link2 className="w-5 h-5" />
                ) : replacementNotice.type === 'break' ? (
                  <Unlink className="w-5 h-5" />
                ) : (
                  <ArrowRightLeft className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-black flex items-center gap-2">
                  <span>{replacementNotice.title}</span>
                  <span
                    className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-md border ${
                      replacementNotice.type === 'duo'
                        ? 'bg-emerald-400/20 text-emerald-300 border-emerald-400/30'
                        : replacementNotice.type === 'break'
                        ? 'bg-rose-400/20 text-rose-300 border-rose-400/30'
                        : 'bg-amber-400/20 text-yellow-300 border-amber-400/30'
                    }`}
                  >
                    {replacementNotice.type === 'duo'
                      ? 'Locked Duo'
                      : replacementNotice.type === 'break'
                      ? 'Duo Separated'
                      : 'Auto-Substituted'}
                  </span>
                </div>
                <p
                  className={`text-xs mt-0.5 truncate sm:whitespace-normal ${
                    replacementNotice.type === 'duo'
                      ? 'text-emerald-200'
                      : replacementNotice.type === 'break'
                      ? 'text-rose-200'
                      : 'text-indigo-200'
                  }`}
                >
                  {replacementNotice.description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplacementNotice(null)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {currentTab === 'active' && (
          <ActiveRoundView
            currentRound={currentRound}
            rounds={rounds}
            roundsCount={rounds.length}
            activeRoundIndex={activeRoundIndex}
            onSelectRound={(roundNum) => setSelectedRoundNumber(roundNum)}
            players={players}
            playersMap={playersMap}
            config={config}
            fairness={fairness}
            upcomingMatches={upcomingMatches}
            standings={standings}
            playerMatchCounts={playerMatchCounts}
            onGenerateNextRound={handleGenerateNextRound}
            onRegenerateCurrentRound={handleRegenerateCurrentRound}
            onUpdateScore={handleUpdateScore}
            onCompleteMatch={handleCompleteMatch}
            onReopenMatch={handleReopenMatch}
            onUpdateMatchLineup={handleUpdateMatchLineup}
            onUpdateNextMatch={handleUpdateNextMatch}
            onResetNextMatch={handleResetNextMatch}
            onNavigateToSquad={() => setCurrentTab('players')}
            onOpenFairnessModal={() => setShowFairnessModal(true)}
            onViewFullStandings={() => setCurrentTab('standings')}
            onBenchAndReplacePlayer={handleBenchAndReplacePlayer}
            onStartMatch={handleStartMatch}
            onShuffleLineup={handleShuffleSocialMatch}
            onOpenTournamentComplete={() => setShowTournamentCompleteModal(true)}
          />
        )}

        {currentTab === 'standings' && (
          <StandingsView
            players={players}
            rounds={rounds}
            config={config}
            onNavigateToBracket={() => setCurrentTab('bracket')}
            hasActiveBracket={Boolean(bracket)}
          />
        )}

        {currentTab === 'groups' && (
          <GroupStageView
            groupStage={groupStage}
            players={players}
            config={config}
            onUpdateGroupStage={handleUpdateGroupStage}
            onNavigateToBracket={() => setCurrentTab('bracket')}
          />
        )}

        {currentTab === 'bracket' && (
          <BracketView
            bracket={bracket}
            doubleTournament={doubleTournament}
            players={players}
            standings={standings}
            config={config}
            onStartBracket={handleStartBracket}
            onRecordResult={handleRecordBracketResult}
            onRecordDoubleBracketResult={handleRecordDoubleBracketResult}
            onRecordGrandFinalResult={handleRecordGrandFinalResult}
            onResetBracket={handleResetBracket}
            onResetDoubleTournament={handleResetDoubleTournament}
          />
        )}

        {currentTab === 'history' && (
          <HistoryView
            rounds={rounds}
            playersMap={playersMap}
            config={config}
            onUpdateScore={handleUpdateScore}
            onDeleteMatch={handleDeleteMatch}
            onDeleteRound={handleDeleteRound}
          />
        )}

        {currentTab === 'players' && (
          <PlayersView
            players={players}
            rounds={rounds}
            config={config}
            onAddPlayer={handleAddPlayer}
            onBulkAddPlayers={handleBulkAddPlayers}
            onTogglePlayerActive={handleTogglePlayerActive}
            onRemovePlayer={handleRemovePlayer}
            onEditPlayer={handleEditPlayer}
            onResetSession={handleResetSession}
            onLinkDuo={handleLinkDuo}
            onUnlinkDuo={handleUnlinkDuo}
            onClearRoster={handleClearRoster}
            onPullFromOpenPlay={handleSyncWithOpenPlay}
            openPlayPlayersCount={openPlayPlayersCount}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Dock */}
      <MobileBottomNav
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        roundsCount={rounds.length}
        playersCount={players.length}
        hasActiveRound={Boolean(currentRound)}
        onOpenConfig={() => setShowConfigModal(true)}
        hasActiveBracket={Boolean(bracket || doubleTournament)}
        hasActiveGroupStage={Boolean(groupStage)}
      />

      {/* Modals */}
      <FairnessModal
        isOpen={showFairnessModal}
        onClose={() => setShowFairnessModal(false)}
        fairness={fairness}
        players={players}
        rounds={rounds}
      />

      <SessionConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        config={config}
        onSaveConfig={setConfig}
        onResetSession={handleResetSession}
        onOpenResetModal={() => setShowResetModal(true)}
        onOpenOnboarding={() => {
          setShowConfigModal(false);
          setShowOnboarding(true);
        }}
      />

      <ResetSessionModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        mode="social"
        playersCount={players.length}
        activeMatchesCount={
          currentRound
            ? (currentRound.matches || []).filter((m) => m.status === 'in_progress').length
            : 0
        }
        historyCount={rounds.length}
        onResetKeepPlayers={handleResetSession}
        onResetFull={handleClearRoster}
      />

      <TransferSessionModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        currentSessionId={sessionId}
        lastSyncedAt={lastSyncedAt}
        isSyncing={isSyncing}
        onManualSync={handleManualSync}
        onLoadSession={handleLoadSession}
        onGenerateNewSession={handleGenerateNewSession}
        playersCount={players.length}
        roundsCount={rounds.length}
      />

      <OnboardingModal
        isOpen={showOnboarding}
        initialConfig={config}
        onComplete={handleCompleteOnboarding}
      />

      <TournamentCompleteModal
        isOpen={showTournamentCompleteModal}
        onClose={() => setShowTournamentCompleteModal(false)}
        players={players}
        rounds={rounds}
        config={config}
        bracket={bracket}
        onRunExtraRound={handleRunExtraTournamentRound}
        onStartNewTournament={handleStartNewTournament}
        onExitTournamentMode={handleExitTournamentMode}
        onViewStandingsTab={() => setCurrentTab('standings')}
        onOpenBracket={() => setCurrentTab('bracket')}
        onStartBracket={handleStartBracket}
        onRecordBracketResult={handleRecordBracketResult}
        onResetBracket={handleResetBracket}
      />

      <ClubModal
        isOpen={showClubModal}
        onClose={() => setShowClubModal(false)}
        currentSessionId={sessionId}
        onSwitchSession={(targetSessionId) => {
          handleLoadSession(targetSessionId);
          setShowClubModal(false);
        }}
        onNewSessionInClub={() => {
          handleGenerateNewSession();
          setShowClubModal(false);
        }}
      />
    </div>
  );
}
