import { Player } from '../types';
import { OPENPLAY_STORAGE_KEYS } from './openPlay';

export const SOCIAL_STORAGE_KEYS = {
  PLAYERS: 'fairclub_players_v1',
  ROUNDS: 'fairclub_rounds_v1',
  CONFIG: 'fairclub_config_v1',
};

export const ROSTER_SYNC_EVENT = 'fairplay:sync-roster';

export function emitRosterSync(source: 'social' | 'openplay', updatedPlayers?: Player[]): void {
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

export function getStoredSocialPlayers(): Player[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SOCIAL_STORAGE_KEYS.PLAYERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((p: Player) => p && !p.id?.startsWith('op-'));
    }
    return [];
  } catch {
    return [];
  }
}

export function setStoredSocialPlayers(players: Player[]): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = players.filter((p) => !p.id.startsWith('op-'));
    localStorage.setItem(SOCIAL_STORAGE_KEYS.PLAYERS, JSON.stringify(cleaned));
  } catch {}
}

export function convertSocialToOpenPlay(players: Player[]): any[] {
  return players;
}

export function convertOpenPlayToSocial(players: any[]): Player[] {
  return players;
}

export function syncSquadBidirectional(players: Player[]): Player[] {
  return players;
}

export function getStoredOpenPlayPlayers(): Player[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OPENPLAY_STORAGE_KEYS.PLAYERS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((p: Player) => p && !p.id?.startsWith('op-'));
    }
    return [];
  } catch {
    return [];
  }
}

export function setStoredOpenPlayPlayers(players: Player[]): void {
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
    const winnersQueue = winnersRaw ? JSON.parse(winnersRaw) : [];
    const losersQueue = losersRaw ? JSON.parse(losersRaw) : [];
    const restingBench = benchRaw ? JSON.parse(benchRaw) : [];
    return {
      winnersQueue: Array.isArray(winnersQueue)
        ? winnersQueue.filter((id: string) => typeof id === 'string' && !id.startsWith('op-'))
        : [],
      losersQueue: Array.isArray(losersQueue)
        ? losersQueue.filter((id: string) => typeof id === 'string' && !id.startsWith('op-'))
        : [],
      restingBench: Array.isArray(restingBench)
        ? restingBench.filter((id: string) => typeof id === 'string' && !id.startsWith('op-'))
        : [],
    };
  } catch {
    return { winnersQueue: [], losersQueue: [], restingBench: [] };
  }
}

export function setStoredOpenPlayBuckets(buckets: {
  winnersQueue?: string[];
  losersQueue?: string[];
  restingBench?: string[];
}): void {
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
