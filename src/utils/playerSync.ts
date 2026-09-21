import { Player } from '../types';
import { OpenPlayPlayer, OpenPlayMatch } from '../types/openPlay';
import { AVATAR_COLORS } from './sampleData';
import { OPENPLAY_STORAGE_KEYS } from './openPlay';

export const SOCIAL_STORAGE_KEYS = {
  PLAYERS: 'fairclub_players_v1',
  ROUNDS: 'fairclub_rounds_v1',
  CONFIG: 'fairclub_config_v1',
};

export const ROSTER_SYNC_EVENT = 'fairplay:sync-roster';

/**
 * Dispatches a cross-mode notification event to keep all views in sync.
 */
export function emitRosterSync(source: 'social' | 'openplay', updatedPlayers?: Player[]) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(ROSTER_SYNC_EVENT, {
          detail: { source, timestamp: Date.now(), updatedPlayers },
        })
      );
    } catch {}
  }
}

/**
 * Load raw Social players from localStorage.
 */
export function getStoredSocialPlayers(): Player[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SOCIAL_STORAGE_KEYS.PLAYERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((p) => p && !p.id?.startsWith('op-'));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Save Social players to localStorage.
 */
export function setStoredSocialPlayers(players: Player[]) {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = players.filter((p) => !p.id.startsWith('op-'));
    localStorage.setItem(SOCIAL_STORAGE_KEYS.PLAYERS, JSON.stringify(cleaned));
  } catch {}
}

export function getStoredOpenPlayPlayers(): Player[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OPENPLAY_STORAGE_KEYS.PLAYERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((p) => p && !p.id?.startsWith('op-'));
    }
    return [];
  } catch {
    return [];
  }
}

export function setStoredOpenPlayPlayers(players: Player[]) {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = players.filter((p) => !p.id.startsWith('op-'));
    localStorage.setItem(OPENPLAY_STORAGE_KEYS.PLAYERS, JSON.stringify(cleaned));
  } catch {}
}

export const OPENPLAY_BUCKET_KEYS = {
  WINNERS_QUEUE: 'openplay_winners_queue_v2',
  LOSERS_QUEUE: 'openplay_losers_queue_v2',
  RESTING_BENCH: 'openplay_resting_bench_v2',
  ACTIVE_MATCHES: 'openplay_active_matches_v1',
  HISTORY: 'openplay_history_v1',
};

/**
 * Load Open Play buckets (winners, losers, bench) from localStorage.
 */
export function getStoredOpenPlayBuckets(): {
  winnersQueue: string[];
  losersQueue: string[];
  restingBench: string[];
} {
  if (typeof window === 'undefined') {
    return { winnersQueue: [], losersQueue: [], restingBench: [] };
  }
  try {
    const winnersRaw = localStorage.getItem(OPENPLAY_BUCKET_KEYS.WINNERS_QUEUE);
    const losersRaw = localStorage.getItem(OPENPLAY_BUCKET_KEYS.LOSERS_QUEUE);
    const benchRaw = localStorage.getItem(OPENPLAY_BUCKET_KEYS.RESTING_BENCH);

    const winnersQueue: string[] = winnersRaw ? JSON.parse(winnersRaw) : [];
    const losersQueue: string[] = losersRaw ? JSON.parse(losersRaw) : [];
    const restingBench: string[] = benchRaw ? JSON.parse(benchRaw) : [];

    return {
      winnersQueue: Array.isArray(winnersQueue) ? winnersQueue.filter((id) => typeof id === 'string' && !id.startsWith('op-')) : [],
      losersQueue: Array.isArray(losersQueue) ? losersQueue.filter((id) => typeof id === 'string' && !id.startsWith('op-')) : [],
      restingBench: Array.isArray(restingBench) ? restingBench.filter((id) => typeof id === 'string' && !id.startsWith('op-')) : [],
    };
  } catch {
    return { winnersQueue: [], losersQueue: [], restingBench: [] };
  }
}

/**
 * Save Open Play buckets to localStorage.
 */
export function setStoredOpenPlayBuckets(buckets: {
  winnersQueue?: string[];
  losersQueue?: string[];
  restingBench?: string[];
}) {
  if (typeof window === 'undefined') return;
  try {
    if (buckets.winnersQueue !== undefined) {
      localStorage.setItem(OPENPLAY_BUCKET_KEYS.WINNERS_QUEUE, JSON.stringify(buckets.winnersQueue));
    }
    if (buckets.losersQueue !== undefined) {
      localStorage.setItem(OPENPLAY_BUCKET_KEYS.LOSERS_QUEUE, JSON.stringify(buckets.losersQueue));
    }
    if (buckets.restingBench !== undefined) {
      localStorage.setItem(OPENPLAY_BUCKET_KEYS.RESTING_BENCH, JSON.stringify(buckets.restingBench));
    }
  } catch {}
}

/**
 * Get count of all unique players registered across Open Play
 */
export function getStoredOpenPlayPlayerCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const social = getStoredOpenPlayPlayers();
    const buckets = getStoredOpenPlayBuckets();
    const allIds = new Set<string>();
    social.forEach((p) => allIds.add(p.id));
    buckets.winnersQueue.forEach((id) => allIds.add(id));
    buckets.losersQueue.forEach((id) => allIds.add(id));
    buckets.restingBench.forEach((id) => allIds.add(id));
    return allIds.size;
  } catch {
    return 0;
  }
}

export function getStoredOpenPlayRegistry(): Record<string, OpenPlayPlayer> {
  return {};
}

export function setStoredOpenPlayRegistry(_registry: Record<string, OpenPlayPlayer>) {}

export function getStoredOpenPlayQueue(): OpenPlayPlayer[] {
  return [];
}

export function setStoredOpenPlayQueue(_queue: OpenPlayPlayer[]) {}

/**
 * Convert a Social Player to an OpenPlayPlayer
 */
export function convertSocialToOpenPlay(
  player: Player,
  existing?: OpenPlayPlayer,
  queueIndex?: number
): OpenPlayPlayer {
  return {
    id: player.id,
    playerProfileId: player.playerProfileId || existing?.playerProfileId,
    name: player.name,
    avatarColor: player.avatarColor || AVATAR_COLORS[0],
    joinedQueueAt: existing?.joinedQueueAt || Date.now() + (queueIndex ?? 0) * 10,
    status: existing
      ? player.active
        ? existing.status === 'paused'
          ? 'waiting'
          : existing.status
        : 'paused'
      : player.active
      ? 'waiting'
      : 'paused',
    courtAssigned: existing?.courtAssigned ?? null,
    gamesPlayed: existing?.gamesPlayed ?? 0,
    wins: existing?.wins ?? 0,
    losses: existing?.losses ?? 0,
    currentStreak: existing?.currentStreak ?? 0,
    bestStreak: existing?.bestStreak ?? 0,
  };
}

/**
 * Convert an OpenPlayPlayer to a Social Player
 */
export function convertOpenPlayToSocial(
  opPlayer: OpenPlayPlayer,
  existing?: Player,
  currentRoundNumber: number = 1
): Player {
  return {
    id: opPlayer.id,
    playerProfileId: opPlayer.playerProfileId || existing?.playerProfileId,
    name: opPlayer.name,
    active: opPlayer.status !== 'paused',
    avatarColor: opPlayer.avatarColor,
    joinedAtRound: existing?.joinedAtRound ?? currentRoundNumber,
    notes: existing?.notes,
    duoPartnerId: existing?.duoPartnerId ?? null,
  };
}

/**
 * Synchronize Social players into Open Play state (registry + waiting queue).
 * Ensures that any player on the Social squad or bench is available in Open Play.
 */
export function reconcileSocialIntoOpenPlay(
  socialPlayers: Player[],
  currentRegistry: Record<string, OpenPlayPlayer>,
  currentQueue: OpenPlayPlayer[],
  activeMatches: Record<number, OpenPlayMatch> = {}
): {
  updatedRegistry: Record<string, OpenPlayPlayer>;
  updatedQueue: OpenPlayPlayer[];
  changesMade: boolean;
} {
  let changesMade = false;
  const updatedRegistry = { ...currentRegistry };
  const updatedQueue = [...currentQueue];

  // Currently playing IDs in Open Play active courts
  const currentlyPlayingIds = new Set<string>();
  Object.values(activeMatches).forEach((m) => {
    if (m && m.status === 'in_progress') {
      m.team1.forEach((id) => currentlyPlayingIds.add(id));
      m.team2.forEach((id) => currentlyPlayingIds.add(id));
    }
  });

  const socialIds = new Set(socialPlayers.map((p) => p.id));
  const queueIds = new Set(updatedQueue.map((p) => p.id));

  // 1. Sync every social player into Open Play registry & queue
  socialPlayers.forEach((sp, idx) => {
    const existingInReg = updatedRegistry[sp.id];
    const opPlayer = convertSocialToOpenPlay(sp, existingInReg, idx);

    // If currently on court in Open Play, keep status 'playing'
    const shouldStatus: OpenPlayPlayer['status'] = currentlyPlayingIds.has(sp.id)
      ? 'playing'
      : !sp.active
      ? 'paused'
      : existingInReg?.status === 'paused'
      ? 'waiting'
      : existingInReg?.status || 'waiting';

    opPlayer.status = shouldStatus;

    if (
      !existingInReg ||
      existingInReg.name !== opPlayer.name ||
      existingInReg.avatarColor !== opPlayer.avatarColor ||
      existingInReg.status !== shouldStatus
    ) {
      updatedRegistry[sp.id] = opPlayer;
      changesMade = true;
    }

    // If not in active matches and not in waiting queue, add to waiting queue!
    if (!currentlyPlayingIds.has(sp.id) && !queueIds.has(sp.id)) {
      updatedQueue.push(opPlayer);
      queueIds.add(sp.id);
      changesMade = true;
    } else if (queueIds.has(sp.id)) {
      // Update info in queue if changed
      const queueIdx = updatedQueue.findIndex((p) => p.id === sp.id);
      if (queueIdx !== -1) {
        const currentInQueue = updatedQueue[queueIdx];
        const nextQueueStatus: OpenPlayPlayer['status'] = !sp.active
          ? 'paused'
          : currentInQueue.status === 'paused'
          ? 'waiting'
          : currentInQueue.status;

        if (
          currentInQueue.name !== sp.name ||
          currentInQueue.avatarColor !== sp.avatarColor ||
          currentInQueue.status !== nextQueueStatus
        ) {
          updatedQueue[queueIdx] = {
            ...currentInQueue,
            name: sp.name,
            avatarColor: sp.avatarColor,
            status: nextQueueStatus,
          };
          changesMade = true;
        }
      }
    }
  });

  return { updatedRegistry, updatedQueue, changesMade };
}

/**
 * Synchronize Open Play players into Social players.
 * Ensures that any player added in Open Play is added into Social tournament squad.
 */
export function reconcileOpenPlayIntoSocial(
  openPlayPlayers: OpenPlayPlayer[],
  socialPlayers: Player[],
  currentRoundNumber: number = 1
): {
  updatedSocialPlayers: Player[];
  changesMade: boolean;
} {
  let changesMade = false;
  const updatedSocialPlayers = [...socialPlayers];
  const socialMap = new Map<string, Player>();
  socialPlayers.forEach((p) => socialMap.set(p.id, p));

  openPlayPlayers.forEach((op) => {
    const existing = socialMap.get(op.id);
    if (!existing) {
      // New player created in Open Play -> add to Social
      const newSocialPlayer = convertOpenPlayToSocial(op, undefined, currentRoundNumber);
      updatedSocialPlayers.push(newSocialPlayer);
      socialMap.set(op.id, newSocialPlayer);
      changesMade = true;
    } else {
      // Update name or active status if changed
      const shouldBeActive = op.status !== 'paused';
      if (existing.name !== op.name || existing.active !== shouldBeActive) {
        const idx = updatedSocialPlayers.findIndex((p) => p.id === op.id);
        if (idx !== -1) {
          updatedSocialPlayers[idx] = {
            ...existing,
            name: op.name,
            avatarColor: op.avatarColor,
            active: shouldBeActive,
          };
          changesMade = true;
        }
      }
    }
  });

  return { updatedSocialPlayers, changesMade };
}

export interface BidirectionalSyncResult {
  updatedSocialPlayers: Player[];
  updatedBuckets: {
    winnersQueue: string[];
    losersQueue: string[];
    restingBench: string[];
  };
  changesMade: boolean;
  totalSyncedCount: number;
}

/**
 * Bidirectional synchronization between Social Tournament Squad and Open Play.
 * Merges players so that both modes share the exact same complete roster:
 * - Any player in Open Play is added to Social squad
 * - Any player in Social squad is added to Open Play buckets (into restingBench if not already queued or on court)
 * - Removes any dangling / non-existent IDs from queues
 * - Saves updated lists to localStorage for both modes
 */
export function syncSquadBidirectional(
  socialPlayers: Player[] = [],
  openPlayBuckets?: {
    winnersQueue?: string[];
    losersQueue?: string[];
    restingBench?: string[];
  },
  activeMatches: Record<number, OpenPlayMatch> = {},
  currentRoundNumber: number = 1
): BidirectionalSyncResult {
  let changesMade = false;

  // 1. Gather all players from localStorage and memory
  const storedSocial = getStoredSocialPlayers();
  const storedBuckets = getStoredOpenPlayBuckets();

  const currentWinners = openPlayBuckets?.winnersQueue ?? storedBuckets.winnersQueue;
  const currentLosers = openPlayBuckets?.losersQueue ?? storedBuckets.losersQueue;
  const currentBench = openPlayBuckets?.restingBench ?? storedBuckets.restingBench;

  // Build merged map of Player objects
  const playerMap = new Map<string, Player>();

  // Add stored social players
  storedSocial.forEach((p) => {
    if (p && p.id && !p.id.startsWith('op-')) {
      playerMap.set(p.id, { ...p });
    }
  });

  // Add memory social players (takes precedence for latest edits)
  socialPlayers.forEach((p) => {
    if (p && p.id && !p.id.startsWith('op-')) {
      playerMap.set(p.id, { ...p });
    }
  });

  // Check active matches for any players
  const currentlyPlayingIds = new Set<string>();
  Object.values(activeMatches).forEach((m) => {
    if (m && m.status === 'in_progress') {
      [...m.team1, ...m.team2].forEach((id) => {
        if (id && !id.startsWith('op-')) {
          currentlyPlayingIds.add(id);
          if (!playerMap.has(id)) {
            playerMap.set(id, {
              id,
              name: `Player ${playerMap.size + 1}`,
              active: true,
              avatarColor: AVATAR_COLORS[playerMap.size % AVATAR_COLORS.length],
              joinedAtRound: currentRoundNumber,
            });
            changesMade = true;
          }
        }
      });
    }
  });

  // Check queue IDs for any players not yet in map
  const allQueueIds = [...currentWinners, ...currentLosers, ...currentBench];
  allQueueIds.forEach((id) => {
    if (id && !id.startsWith('op-') && !playerMap.has(id)) {
      playerMap.set(id, {
        id,
        name: `Player ${playerMap.size + 1}`,
        active: true,
        avatarColor: AVATAR_COLORS[playerMap.size % AVATAR_COLORS.length],
        joinedAtRound: currentRoundNumber,
      });
      changesMade = true;
    }
  });

  const updatedSocialPlayers = Array.from(playerMap.values());
  const validPlayerIds = new Set(updatedSocialPlayers.map((p) => p.id));

  // 2. Clean and reconcile queues
  const nextWinners = currentWinners.filter((id) => validPlayerIds.has(id));
  const nextLosers = currentLosers.filter((id) => validPlayerIds.has(id));
  const nextBench = currentBench.filter((id) => validPlayerIds.has(id));

  const queuedOrPlaying = new Set<string>([
    ...nextWinners,
    ...nextLosers,
    ...nextBench,
    ...currentlyPlayingIds,
  ]);

  // Any player in updatedSocialPlayers not yet in winners, losers, bench, or court -> place into restingBench
  updatedSocialPlayers.forEach((p) => {
    if (!queuedOrPlaying.has(p.id)) {
      nextBench.push(p.id);
      queuedOrPlaying.add(p.id);
      changesMade = true;
    }
  });

  if (
    nextWinners.length !== currentWinners.length ||
    nextLosers.length !== currentLosers.length ||
    nextBench.length !== currentBench.length
  ) {
    changesMade = true;
  }

  // 3. Persist to storage
  setStoredSocialPlayers(updatedSocialPlayers);
  setStoredOpenPlayBuckets({
    winnersQueue: nextWinners,
    losersQueue: nextLosers,
    restingBench: nextBench,
  });

  return {
    updatedSocialPlayers,
    updatedBuckets: {
      winnersQueue: nextWinners,
      losersQueue: nextLosers,
      restingBench: nextBench,
    },
    changesMade,
    totalSyncedCount: updatedSocialPlayers.length,
  };
}
