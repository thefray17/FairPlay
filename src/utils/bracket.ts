import {
  Bracket,
  BracketMatch,
  BracketSlot,
  GroupDoubleBracketTournament,
  GroupStage,
  Player,
  SessionConfig,
  StandingsRow,
} from '../types';
import { getGroupStandings } from './groupStage';

export type SeedingMethod = 'rating' | 'standings' | 'random';
export type DoublesPairingMethod = 'duo_or_adjacent' | 'adjacent' | 'snake';

export interface SeedEntrantsOptions {
  format?: 'singles' | 'doubles';
  doublesPairingMethod?: DoublesPairingMethod;
}

/**
 * Standard Fisher-Yates array shuffle.
 */
function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Seeds entrants from a list of players.
 *
 * Seeding methods:
 * - 'rating': Sort by Player.duprRating descending (unrated players placed last in random order among themselves).
 * - 'standings': Sort by StandingsRow order (wins, point differential, points for, win rate, etc.).
 * - 'random': Randomly shuffle all players.
 *
 * For doubles:
 * - Pairs players into 2-person BracketSlots.
 * - If 'duo_or_adjacent' (default): preserves locked duoPartnerId pairings first, then pairs remaining adjacent seeds.
 * - If 'adjacent': pairs seeds 1&2, 3&4, etc.
 * - If 'snake': pairs top with bottom (1&N, 2&N-1, etc.) for balanced pairing.
 */
export function seedEntrants(
  players: Player[],
  method: SeedingMethod,
  standings?: StandingsRow[],
  options?: SeedEntrantsOptions | DoublesPairingMethod
): BracketSlot[] {
  const format =
    typeof options === 'object' && options?.format
      ? options.format
      : 'singles';
  const doublesMethod: DoublesPairingMethod =
    typeof options === 'string'
      ? options
      : options?.doublesPairingMethod || 'duo_or_adjacent';

  // 1. Sort the players according to the selected seeding method
  let sortedPlayers: Player[] = [];

  if (method === 'rating') {
    const rated = players.filter(
      (p) => typeof p.duprRating === 'number' && !isNaN(p.duprRating) && p.duprRating > 0
    );
    const unrated = players.filter(
      (p) => p.duprRating === null || p.duprRating === undefined || isNaN(p.duprRating as number) || p.duprRating <= 0
    );

    rated.sort((a, b) => (b.duprRating as number) - (a.duprRating as number));
    const shuffledUnrated = shuffleArray(unrated);
    sortedPlayers = [...rated, ...shuffledUnrated];
  } else if (method === 'standings') {
    if (standings && standings.length > 0) {
      const rankMap = new Map<string, number>();
      standings.forEach((row, index) => {
        rankMap.set(row.playerId, index);
      });

      sortedPlayers = [...players].sort((a, b) => {
        const rankA = rankMap.has(a.id) ? rankMap.get(a.id)! : Number.MAX_SAFE_INTEGER;
        const rankB = rankMap.has(b.id) ? rankMap.get(b.id)! : Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name);
      });
    } else {
      sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));
    }
  } else {
    // 'random'
    sortedPlayers = shuffleArray(players);
  }

  // 2. Generate BracketSlot objects based on format
  if (format === 'doubles') {
    const pairs: string[][] = [];
    const usedIds = new Set<string>();

    if (doublesMethod === 'duo_or_adjacent') {
      // First, pair locked duos
      for (const p of sortedPlayers) {
        if (usedIds.has(p.id)) continue;
        if (p.duoPartnerId) {
          const partner = sortedPlayers.find((other) => other.id === p.duoPartnerId);
          if (partner && !usedIds.has(partner.id)) {
            pairs.push([p.id, partner.id]);
            usedIds.add(p.id);
            usedIds.add(partner.id);
          }
        }
      }

      // Pair remaining players adjacent to each other
      const remaining = sortedPlayers.filter((p) => !usedIds.has(p.id));
      for (let i = 0; i < remaining.length; i += 2) {
        if (i + 1 < remaining.length) {
          pairs.push([remaining[i].id, remaining[i + 1].id]);
        } else {
          // Odd player left over
          pairs.push([remaining[i].id]);
        }
      }
    } else if (doublesMethod === 'snake') {
      // Snake pairing (1 with N, 2 with N-1, etc.)
      const list = [...sortedPlayers];
      while (list.length > 1) {
        const first = list.shift()!;
        const last = list.pop()!;
        pairs.push([first.id, last.id]);
      }
      if (list.length === 1) {
        pairs.push([list[0].id]);
      }
    } else {
      // 'adjacent': strict 1&2, 3&4, 5&6...
      for (let i = 0; i < sortedPlayers.length; i += 2) {
        if (i + 1 < sortedPlayers.length) {
          pairs.push([sortedPlayers[i].id, sortedPlayers[i + 1].id]);
        } else {
          pairs.push([sortedPlayers[i].id]);
        }
      }
    }

    return pairs.map((playerIds, index) => ({
      seed: index + 1,
      playerIds,
    }));
  }

  // Singles format
  return sortedPlayers.map((player, index) => ({
    seed: index + 1,
    playerIds: [player.id],
  }));
}

/**
 * Generates the standard tournament seeding order for a bracket of size N (must be a power of 2).
 *
 * For N=2: [1, 2]
 * For N=4: [1, 4, 2, 3] -> (1 vs 4), (2 vs 3)
 * For N=8: [1, 8, 4, 5, 2, 7, 3, 6] -> (1 vs 8), (4 vs 5), (2 vs 7), (3 vs 6)
 *
 * This ensures:
 * - Seed 1 & 2 meet in the Final.
 * - Seed 1 & 4 meet in Semifinal 1; Seed 2 & 3 meet in Semifinal 2.
 * - Byes (highest seed numbers) always pair against top seeds (1, 2, 3...).
 */
export function getSeedingOrder(size: number): number[] {
  if (size <= 1) return [1];
  let order = [1, 2];
  while (order.length < size) {
    const nextOrder: number[] = [];
    const currentPairSum = order.length * 2 + 1;
    for (let i = 0; i < order.length; i++) {
      nextOrder.push(order[i]);
      nextOrder.push(currentPairSum - order[i]);
    }
    order = nextOrder;
  }
  return order;
}

/**
 * Calculates the next power of 2 that is >= entrant count.
 * Minimum bracket size is 2.
 */
export function getNextPowerOfTwo(n: number): number {
  if (n <= 2) return 2;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Generates a complete single-elimination tournament bracket.
 *
 * - Pads to the next power of 2 with bye slots (`isBye: true`) where byes automatically go to top seeds.
 * - Builds all rounds of `BracketMatch` objects with correct `nextMatchId` and `nextMatchSlot` wiring.
 * - Auto-resolves first-round bye matches, advancing real entrants immediately without requiring score input.
 */
export function generateBracket(slots: BracketSlot[]): Bracket {
  const entrantCount = slots.length;
  const bracketId = `bracket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  if (entrantCount === 0) {
    return {
      id: bracketId,
      createdAt: Date.now(),
      size: 0,
      matches: [],
    };
  }

  const size = getNextPowerOfTwo(entrantCount);
  const totalRounds = Math.round(Math.log2(size));

  // Map of available real seeds (1 to entrantCount)
  const slotsBySeed = new Map<number, BracketSlot>();
  slots.forEach((s) => {
    slotsBySeed.set(s.seed, s);
  });

  // Create Bye slots for seeds > entrantCount
  for (let seed = entrantCount + 1; seed <= size; seed++) {
    slotsBySeed.set(seed, {
      seed,
      playerIds: [],
      isBye: true,
    });
  }

  // Seeding order for first round
  const seedingOrder = getSeedingOrder(size);

  // Build match topology round by round
  const matches: BracketMatch[] = [];
  const matchLookup = new Map<string, BracketMatch>();

  for (let r = 1; r <= totalRounds; r++) {
    const matchCountInRound = size / Math.pow(2, r);
    for (let p = 1; p <= matchCountInRound; p++) {
      const matchId = `${bracketId}-r${r}-p${p}`;
      const isFinalRound = r === totalRounds;

      let nextMatchId: string | undefined;
      let nextMatchSlot: 'A' | 'B' | undefined;

      if (!isFinalRound) {
        const nextRound = r + 1;
        const nextPosition = Math.ceil(p / 2);
        nextMatchId = `${bracketId}-r${nextRound}-p${nextPosition}`;
        nextMatchSlot = p % 2 === 1 ? 'A' : 'B';
      }

      let slotA: BracketSlot | null = null;
      let slotB: BracketSlot | null = null;

      // Populate Round 1 slots from seeding order
      if (r === 1) {
        const seedA = seedingOrder[(p - 1) * 2];
        const seedB = seedingOrder[(p - 1) * 2 + 1];
        slotA = slotsBySeed.get(seedA) || { seed: seedA, playerIds: [], isBye: true };
        slotB = slotsBySeed.get(seedB) || { seed: seedB, playerIds: [], isBye: true };
      }

      const match: BracketMatch = {
        id: matchId,
        round: r,
        position: p,
        slotA,
        slotB,
        nextMatchId,
        nextMatchSlot,
      };

      matches.push(match);
      matchLookup.set(matchId, match);
    }
  }

  const bracket: Bracket = {
    id: bracketId,
    createdAt: Date.now(),
    size,
    matches,
  };

  // Auto-resolve byes cascading through the tournament tree
  autoResolveByes(bracket);

  return bracket;
}

/**
 * Propagates bye advances through the bracket until all byes are resolved.
 */
function autoResolveByes(bracket: Bracket): void {
  const matchMap = new Map<string, BracketMatch>();
  bracket.matches.forEach((m) => matchMap.set(m.id, m));

  let changed = true;
  let iterations = 0;
  const maxIterations = bracket.matches.length + 5;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const match of bracket.matches) {
      if (match.winnerSlot) continue; // already completed

      const isA = Boolean(match.slotA);
      const isB = Boolean(match.slotB);
      const isABye = Boolean(match.slotA?.isBye);
      const isBBye = Boolean(match.slotB?.isBye);

      // Scenario 1: One real slot and one Bye slot
      if (isA && isB) {
        if (!isABye && isBBye) {
          // Slot A auto-advances
          match.winnerSlot = 'A';
          advanceWinner(match, match.slotA!, matchMap, bracket);
          changed = true;
        } else if (isABye && !isBBye) {
          // Slot B auto-advances
          match.winnerSlot = 'B';
          advanceWinner(match, match.slotB!, matchMap, bracket);
          changed = true;
        } else if (isABye && isBBye) {
          // Double bye (rare) -> advance bye to keep tree moving
          match.winnerSlot = 'A';
          advanceWinner(match, match.slotA!, matchMap, bracket);
          changed = true;
        }
      }
    }
  }
}

/**
 * Helper to advance a winning slot into its downstream match or set champion if final.
 */
function advanceWinner(
  match: BracketMatch,
  winningSlot: BracketSlot,
  matchMap: Map<string, BracketMatch>,
  bracket: Bracket
): void {
  if (match.nextMatchId && match.nextMatchSlot) {
    const nextMatch = matchMap.get(match.nextMatchId);
    if (nextMatch) {
      if (match.nextMatchSlot === 'A') {
        nextMatch.slotA = winningSlot;
      } else {
        nextMatch.slotB = winningSlot;
      }
    }
  } else {
    // Final match completed!
    if (!winningSlot.isBye && winningSlot.playerIds.length > 0) {
      bracket.championPlayerIds = winningSlot.playerIds;
    }
  }
}

/**
 * Records the score of an active bracket match, determines the winner,
 * advances the winning slot into the linked `nextMatchId` slot,
 * and sets `championPlayerIds` if the tournament final is completed.
 */
export function recordBracketResult(
  bracket: Bracket,
  matchId: string,
  score1: number,
  score2: number
): Bracket {
  if (score1 === score2) {
    throw new Error('Single-elimination matches cannot end in a tie.');
  }

  // Deep clone to guarantee immutability
  const clonedMatches: BracketMatch[] = bracket.matches.map((m) => ({
    ...m,
    slotA: m.slotA ? { ...m.slotA, playerIds: [...m.slotA.playerIds] } : null,
    slotB: m.slotB ? { ...m.slotB, playerIds: [...m.slotB.playerIds] } : null,
  }));

  const matchMap = new Map<string, BracketMatch>();
  clonedMatches.forEach((m) => matchMap.set(m.id, m));

  const targetMatch = matchMap.get(matchId);
  if (!targetMatch) {
    throw new Error(`Match with id "${matchId}" was not found in bracket.`);
  }

  if (!targetMatch.slotA || !targetMatch.slotB) {
    throw new Error('Cannot enter score for a match with unpopulated slots.');
  }

  const winnerSlot: 'A' | 'B' = score1 > score2 ? 'A' : 'B';
  const winningSlot = winnerSlot === 'A' ? targetMatch.slotA : targetMatch.slotB;

  targetMatch.score1 = score1;
  targetMatch.score2 = score2;
  targetMatch.winnerSlot = winnerSlot;

  const updatedBracket: Bracket = {
    ...bracket,
    matches: clonedMatches,
    championPlayerIds: bracket.championPlayerIds
      ? [...bracket.championPlayerIds]
      : undefined,
  };

  advanceWinner(targetMatch, winningSlot, matchMap, updatedBracket);

  // Auto-resolve any downstream byes if applicable
  autoResolveByes(updatedBracket);

  return updatedBracket;
}

/**
 * Helper used to label bracket rounds by size instead of hardcoding names.
 *
 * @param roundIndex 1-based round index (1 = first round)
 * @param totalRounds Total number of rounds in the bracket (e.g. an 8-entrant bracket has 3 rounds)
 * @returns Counting backward from the final:
 *   - 'Final' for the last round
 *   - 'Semifinal' for the second-to-last
 *   - 'Quarterfinal' for the one before that
 *   - 'Round of 16', 'Round of 32', etc. for anything earlier
 */
export function getBracketRoundName(roundIndex: number, totalRounds: number): string {
  if (totalRounds <= 0 || roundIndex <= 0) return 'Final';
  const roundsFromFinal = totalRounds - roundIndex;
  if (roundsFromFinal <= 0) return 'Final';
  if (roundsFromFinal === 1) return 'Semifinal';
  if (roundsFromFinal === 2) return 'Quarterfinal';

  // For 3 rounds from final (16 entrants) -> 2^(3+1) = 16 -> 'Round of 16'
  // For 4 rounds from final (32 entrants) -> 2^(4+1) = 32 -> 'Round of 32'
  const entrantCountAtRound = Math.pow(2, roundsFromFinal + 1);
  return `Round of ${entrantCountAtRound}`;
}

/**
 * Returns summary statistics for bracket progress.
 */
export function getBracketProgress(bracket: Bracket): {
  totalMatches: number;
  completedMatches: number;
  percentage: number;
  isComplete: boolean;
} {
  if (!bracket.matches || bracket.matches.length === 0) {
    return { totalMatches: 0, completedMatches: 0, percentage: 0, isComplete: false };
  }

  // Non-bye matches (real matches that required or produced play)
  const realMatches = bracket.matches.filter(
    (m) => !(m.slotA?.isBye && m.slotB?.isBye)
  );
  const completed = realMatches.filter((m) => m.winnerSlot !== undefined);

  const percentage =
    realMatches.length > 0
      ? Math.round((completed.length / realMatches.length) * 100)
      : 0;

  return {
    totalMatches: realMatches.length,
    completedMatches: completed.length,
    percentage,
    isComplete: Boolean(bracket.championPlayerIds && bracket.championPlayerIds.length > 0),
  };
}

interface RankedFinisher {
  groupLabel: string;
  playerIds: string[];
  standing: StandingsRow;
}

/**
 * Computes two seed lists from completed GroupStage:
 * - Winners Bracket entrants: 1st-place finishers across all groups, sorted strongest to weakest
 * - Losers Bracket entrants: 2nd-place finishers across all groups, sorted strongest to weakest
 *
 * Generates two independent Bracket objects using seedEntrants() and generateBracket().
 */
export function generateGroupDoubleBracketTournament(
  groupStage: GroupStage,
  players: Player[],
  config: SessionConfig,
  finalsFormat: 'single_final' | 'true_double_elim' = 'single_final'
): GroupDoubleBracketTournament {
  const isDoubles = config.format === 'doubles';
  const winnersFinishers: RankedFinisher[] = [];
  const losersFinishers: RankedFinisher[] = [];

  groupStage.groups.forEach((group) => {
    const standings = getGroupStandings(group, players);
    if (standings.length === 0) return;

    // Helper to extract playerIds for a standing row
    const getEntrantPlayerIds = (topRow: StandingsRow): string[] => {
      if (isDoubles) {
        // Match against group.entrantIds
        const matchingEntrant = group.entrantIds.find((ent) => {
          if (ent.includes(',')) {
            const ids = ent.split(',').map((s) => s.trim());
            return ids.includes(topRow.playerId);
          }
          return ent === topRow.playerId;
        });

        if (matchingEntrant && matchingEntrant.includes(',')) {
          return matchingEntrant.split(',').map((s) => s.trim());
        }

        const playerObj = players.find((p) => p.id === topRow.playerId);
        if (playerObj?.duoPartnerId) {
          return [playerObj.id, playerObj.duoPartnerId];
        }
      }
      return [topRow.playerId];
    };

    // 1st place finisher -> Winners Bracket
    if (standings.length >= 1) {
      winnersFinishers.push({
        groupLabel: group.label,
        playerIds: getEntrantPlayerIds(standings[0]),
        standing: standings[0],
      });
    }

    // 2nd place finisher -> Losers Bracket
    if (standings.length >= 2) {
      losersFinishers.push({
        groupLabel: group.label,
        playerIds: getEntrantPlayerIds(standings[1]),
        standing: standings[1],
      });
    }
  });

  // Sort function: win rate desc, point differential desc, points for desc, won desc
  const compareFinishers = (a: RankedFinisher, b: RankedFinisher) => {
    if (b.standing.winRate !== a.standing.winRate) {
      return b.standing.winRate - a.standing.winRate;
    }
    if (b.standing.pointDiff !== a.standing.pointDiff) {
      return b.standing.pointDiff - a.standing.pointDiff;
    }
    if (b.standing.pointsFor !== a.standing.pointsFor) {
      return b.standing.pointsFor - a.standing.pointsFor;
    }
    if (b.standing.won !== a.standing.won) {
      return b.standing.won - a.standing.won;
    }
    return a.standing.playerName.localeCompare(b.standing.playerName);
  };

  winnersFinishers.sort(compareFinishers);
  losersFinishers.sort(compareFinishers);

  // Generate BracketSlots with sequential 1..N seeds
  const winnersSlots: BracketSlot[] = winnersFinishers.map((f, idx) => ({
    seed: idx + 1,
    playerIds: f.playerIds,
  }));

  const losersSlots: BracketSlot[] = losersFinishers.map((f, idx) => ({
    seed: idx + 1,
    playerIds: f.playerIds,
  }));

  const winnersBracket = generateBracket(winnersSlots);
  const losersBracket = generateBracket(losersSlots);

  return {
    groupStage,
    winnersBracket,
    losersBracket,
    finalsFormat,
  };
}

/**
 * Records Grand Final match results in a GroupDoubleBracketTournament.
 */
export function recordGrandFinalResult(
  tournament: GroupDoubleBracketTournament,
  matchType: 'match1' | 'resetMatch',
  score1: number,
  score2: number
): GroupDoubleBracketTournament {
  if (score1 === score2) {
    throw new Error('Grand Final matches cannot end in a tie.');
  }

  const winner: 'winners' | 'losers' = score1 > score2 ? 'winners' : 'losers';
  const currentGrandFinal = tournament.grandFinal || {};

  const winnersChampIds = tournament.winnersBracket.championPlayerIds || [];
  const losersChampIds = tournament.losersBracket.championPlayerIds || [];

  if (matchType === 'match1') {
    const match1Result = { score1, score2, winner };

    if (tournament.finalsFormat === 'single_final') {
      const championId = winner === 'winners' ? winnersChampIds.join(',') : losersChampIds.join(',');
      return {
        ...tournament,
        grandFinal: {
          ...currentGrandFinal,
          match1: match1Result,
          championId,
        },
      };
    } else {
      // 'true_double_elim'
      if (winner === 'winners') {
        // Winners bracket champion won without dropping a match in finals
        return {
          ...tournament,
          grandFinal: {
            ...currentGrandFinal,
            match1: match1Result,
            resetMatch: undefined,
            championId: winnersChampIds.join(','),
          },
        };
      } else {
        // Losers bracket champion won Match 1! Triggers Reset Match
        return {
          ...tournament,
          grandFinal: {
            ...currentGrandFinal,
            match1: match1Result,
            championId: undefined,
          },
        };
      }
    }
  } else {
    // resetMatch
    const resetResult = { score1, score2, winner };
    const championId = winner === 'winners' ? winnersChampIds.join(',') : losersChampIds.join(',');

    return {
      ...tournament,
      grandFinal: {
        ...currentGrandFinal,
        resetMatch: resetResult,
        championId,
      },
    };
  }
}

