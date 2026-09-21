export type SportType = 'pickleball' | 'badminton' | 'tennis' | 'table-tennis' | 'padel' | 'volleyball' | 'custom';
export type MatchFormat = 'doubles' | 'singles' | 'triples' | 'quads';

export interface Player {
  id: string;
  playerProfileId?: string; // Cross-session identity profile ID
  name: string;
  active: boolean; // whether player is available for upcoming rounds (can be temporarily paused for rest/injury)
  avatarColor: string;
  notes?: string;
  joinedAtRound: number;
  duoPartnerId?: string | null; // Locked duo partner player ID (inseparable team)
  duprRating?: number | null;
}

export interface PlayerProfile {
  id: string;
  name: string;
  authUid?: string;
  avatarColor?: string;
  gender?: 'M' | 'F';
  skillLevel?: string;
  rating?: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  clubIds?: string[];
  createdAt?: number;
  updatedAt?: number;
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
  recentFormDetails?: { matchId: string; result: 'W' | 'L' | 'D' }[];
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

export type TournamentFormatType = 'round_robin' | 'round_robin_to_bracket' | 'group_double_bracket';

export interface TournamentModeConfig {
  enabled: boolean;
  totalRounds: number; // fixed round count, decided at start
  locked: boolean; // true once the tournament has started
  completedAt?: number; // set when finalized
  bracketCutoff?: number; // e.g. top 4 or top 8 advance to the bracket
  tournamentFormat?: TournamentFormatType;
  finalsFormat?: 'single_final' | 'true_double_elim';
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
  tournamentMode?: TournamentModeConfig;
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

export interface BracketSlot {
  seed: number;
  playerIds: string[]; // 1 player for singles, 2 for doubles
  isBye?: boolean;
}

export interface BracketMatch {
  id: string;
  round: number;          // 1 = first round, increases toward the final
  position: number;       // slot within that round, left-to-right
  slotA: BracketSlot | null;
  slotB: BracketSlot | null;
  score1?: number;
  score2?: number;
  winnerSlot?: 'A' | 'B';
  nextMatchId?: string;   // which match the winner advances into
  nextMatchSlot?: 'A' | 'B';
}

export interface Bracket {
  id: string;
  createdAt: number;
  size: number;           // bracket size, next power of 2 >= entrant count
  matches: BracketMatch[];
  championPlayerIds?: string[];
}

export interface TournamentGroup {
  id: string;
  label: string;             // "Group A", "Group B", etc.
  entrantIds: string[];      // player IDs (or team-representative IDs for doubles)
  rounds: Round[];           // reuse the existing Round/Match shape, scoped to just this group's matches
  standings?: StandingsRow[]; // filled in once matches are scored
}

export interface GroupStage {
  id: string;
  groups: TournamentGroup[];
  completedAt?: number;
  finalsFormat?: 'single_final' | 'true_double_elim';
}

export interface GroupDoubleBracketTournament {
  groupStage: GroupStage;
  winnersBracket: Bracket;
  losersBracket: Bracket;
  finalsFormat: 'single_final' | 'true_double_elim';
  grandFinal?: {
    match1?: { score1?: number; score2?: number; winner?: 'winners' | 'losers' };
    resetMatch?: { score1?: number; score2?: number; winner?: 'winners' | 'losers' };
    championId?: string; // or team representative ID
  };
}

/**
 * Club / Squad layer for multi-session ownership and persistent player identity.
 * A club owns many Session documents and tracks member player profiles.
 */
export interface Club {
  id: string;
  name: string;
  code: string; // short join code (reuses the 4-digit PIN pattern from generateSessionId)
  createdByUid?: string;
  organizerToken?: string; // Private write token for club organizer
  memberProfileIds: string[];
  sessionIds: string[];
  createdAt: number;
  updatedAt?: number;
  description?: string;
  sport?: SportType;
}

export type SessionType = 'social' | 'open_play' | 'tournament';

export interface UnifiedSessionCreationOptions {
  sessionType: SessionType;
  sessionName: string;
  sport: SportType;
  format: MatchFormat;
  courtsCount: number;
  targetPoints: number;
  winByTwo: boolean;
  clubId?: string;
  initialPlayerProfileIds?: string[];
}




