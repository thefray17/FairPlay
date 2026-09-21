export interface OpenPlayPlayer {
  id: string;
  playerProfileId?: string; // Cross-session identity profile ID
  name: string;
  avatarColor: string;
  joinedQueueAt: number;
  status: 'waiting' | 'playing' | 'paused' | 'resting';
  bucket?: 'winners' | 'losers' | 'bench';
  benchedAt?: number;
  courtAssigned?: number | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
}

export interface OpenPlayMatch {
  id: string;
  matchNumber: number;
  courtNumber: number;
  team1: string[]; // Player IDs
  team2: string[]; // Player IDs
  score1: number;
  score2: number;
  status: 'in_progress' | 'completed';
  winner?: 1 | 2 | 'draw';
  startedAt: number;
  completedAt?: number;
  winnerIds?: string[];
  loserIds?: string[];
  // Universal Match Cycle & Split tracking
  arrivalOrder: string[]; // 4 players ordered [1, 2, 3, 4] upon court arrival
  matchType: 'bench_start' | 'pure_winners' | 'pure_losers' | 'move_up' | 'standard';
  partnerSplitMode?: '14_vs_23' | '12_vs_34' | '13_vs_24';
  movedUpPlayerIds?: string[]; // Losers promoted into Winners tier via Move-Up rule
  benchRotatedInId?: string; // Player from resting bench who entered
  benchRotatedOutId?: string; // Player from court who took spot on bench
}

export type QueueTurn = 'bench' | 'winners' | 'losers';

export interface OpenPlayConfig {
  sessionName: string;
  sport: 'pickleball' | 'badminton' | 'tennis' | 'table-tennis' | 'padel' | 'volleyball' | 'custom';
  format: 'doubles' | 'singles';
  courtsCount: number;
  targetPoints: number;
  winByTwo: boolean;
  autoDispatchNext: boolean; // Auto-pull next players from queue when court finishes
  benchRotationRule?: 'most_games' | 'random';
  nextQueueTurn?: 'winners' | 'losers';
}

export interface OpenPlayNotification {
  id: string;
  title: string;
  message: string;
  type: 'fallback' | 'match_call' | 'queue_update' | 'bench_rotation' | 'shuffle' | 'court_dispatched' | 'sync_error';
  timestamp: number;
  courtNumber?: number;
  winnersNames?: string[];
  losersNames?: string[];
}
