export type SportType = 'pickleball' | 'badminton' | 'tennis' | 'table-tennis' | 'padel' | 'volleyball' | 'custom';
export type MatchFormat = 'doubles' | 'singles' | 'triples' | 'quads';

export interface Player {
  id: string;
  name: string;
  active: boolean; // whether player is available for upcoming rounds (can be temporarily paused for rest/injury)
  avatarColor: string;
  notes?: string;
  joinedAtRound: number;
  duoPartnerId?: string | null; // Locked duo partner player ID (inseparable team)
}

export type MatchStatus = 'pending' | 'in_progress' | 'completed';

export interface MatchTeam {
  playerIds: string[];
}

export interface Match {
  id: string;
  roundNumber: number;
  courtNumber?: number;
  team1: MatchTeam;
  team2: MatchTeam;
  score1: number;
  score2: number;
  completed: boolean;
  status: MatchStatus;
  winner?: 1 | 2 | 'draw';
  startedAt?: number;
  finishedAt?: number;
  fillerPlayerIds?: string[];
  catchUpPlayerIds?: string[];
  isCatchUpMatch?: boolean;
  matchOrder?: number;
}

export interface Round {
  roundNumber: number;
  matches: Match[];
  restingPlayerIds: string[];
  generatedAt: number;
  completed: boolean;
  targetMatchesPerPlayer?: number;
}

export interface StandingsRow {
  playerId: string;
  playerName: string;
  avatarColor: string;
  matchesPlayed: number;
  won: number;
  lost: number;
  tied: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  winRate: number; // percentage 0 - 100
  recentForm: ('W' | 'L' | 'D')[];
  form?: ('W' | 'L' | 'D')[];
  active: boolean;
  fairnessStatus?: string;
  cycleNumber?: number;
}

export interface UpcomingMatch {
  matchNumber: 1 | 2; // 1 = Next Match (On Deck), 2 = Following Match (In The Hole)
  team1PlayerIds: string[];
  team2PlayerIds: string[];
  courtNumber?: number;
  isOverridden?: boolean;
}

export interface SessionConfig {
  sessionName: string;
  sport: SportType;
  format: MatchFormat;
  playersPerTeam: number; // 2 for doubles, 1 for singles, 3 for triples, 4 for quads
  courtsCount: number;
  targetPoints: number; // e.g. 21 for badminton, 11 for pickleball
  winByTwo: boolean;
  allowDraw: boolean;
}

export interface FairnessMetric {
  minPlayed: number;
  maxPlayed: number;
  spread: number; // should always be <= 1 for strict fairness!
  currentCycle: number;
  playersInCurrentCycle: number;
  totalActivePlayers: number;
  isPerfectlyBalanced: boolean;
  fairnessScorePercentage: number;
}

export interface HeadToHeadRecord {
  opponentId: string;
  timesFaced: number;
  completedMatches: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  winRate: number;
}

export interface MatchupCoverage {
  totalPossibleMatchups: number;
  uniqueMatchupsFormed: number;
  coveragePercentage: number;
  neverFacedCount: number;
  opponentMatrix: Record<string, Record<string, number>>;
}

export interface TeamMatchInstance {
  matchId: string;
  roundNumber: number;
  courtNumber: number;
  team1PlayerIds: string[];
  team2PlayerIds: string[];
  score1: number;
  score2: number;
  completed: boolean;
  winner: 1 | 2 | 'draw';
}

export interface TeamVsTeamRecord {
  team1Ids: [string, string];
  team2Ids: [string, string];
  timesFaced: number;
  completedMatches: number;
  team1Wins: number;
  team2Wins: number;
  draws: number;
  team1Points: number;
  team2Points: number;
  pointDiff: number;
  winRateTeam1: number;
  winRateTeam2: number;
  matches: TeamMatchInstance[];
}
