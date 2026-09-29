export type BucketType = 'winners' | 'losers' | 'bench';
export type MatchStatus = 'in_progress' | 'completed';
export type PartnerSplitMode = '14_vs_23' | '12_vs_34' | '13_vs_24';
export type OpenPlayMatchType = 'bench_start' | 'pure_winners' | 'pure_losers' | 'move_up';

export interface OpenPlayPlayer {
  id: string;
  name: string;
  avatarColor: string;
  joinedQueueAt: number;
  status: 'waiting' | 'playing' | 'resting';
  bucket?: BucketType;
  courtAssigned?: number | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  notes?: string;
  duoPartnerId?: string | null;
}

export interface OpenPlayMatch {
  id: string;
  matchNumber: number;
  courtNumber: number;
  team1: string[];
  team2: string[];
  score1: number;
  score2: number;
  status: MatchStatus;
  startedAt: number;
  completedAt?: number;
  arrivalOrder: string[];
  matchType: OpenPlayMatchType | string;
  partnerSplitMode: PartnerSplitMode | string;
  movedUpPlayerIds?: string[];
  winner?: 1 | 2 | 'draw';
  winnerIds?: string[];
  loserIds?: string[];
}

export interface OpenPlayConfig {
  sessionName: string;
  sport: string;
  format: 'doubles' | 'singles';
  courtsCount: number;
  targetPoints: number;
  winByTwo: boolean;
  autoDispatchNext: boolean;
  benchRotationRule: 'most_games' | 'longest_wait' | 'random';
  nextQueueTurn: 'winners' | 'losers';
}

export interface OpenPlayNotification {
  id: string;
  type: string;
  timestamp: number;
  courtNumber?: number;
  title: string;
  message: string;
}
