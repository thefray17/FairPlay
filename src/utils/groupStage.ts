import { GroupStage, Match, Player, Round, StandingsRow, TournamentGroup } from '../types';
import { calculateStandings } from './standings';

/**
 * Determine the optimal number of groups for N entrants given a target size.
 * Enforces balanced group sizes between 3 and 5 (for target 4) where possible,
 * with maximum difference of 1 between any two group sizes.
 */
export function calculateOptimalGroupCount(totalEntrants: number, targetSize: number = 4): number {
  if (totalEntrants <= 0) return 0;
  if (totalEntrants <= 5) return 1;

  // We consider possible group counts k >= 1 such that group sizes are in [3, 5]
  const minGroupSize = 3;
  const maxGroupSize = 5;

  const maxK = Math.max(1, Math.floor(totalEntrants / minGroupSize));
  const minK = Math.max(1, Math.ceil(totalEntrants / maxGroupSize));

  let bestK = Math.max(1, Math.round(totalEntrants / targetSize));
  let bestScore = Infinity;

  for (let k = minK; k <= maxK; k++) {
    const baseSize = Math.floor(totalEntrants / k);
    const remainder = totalEntrants % k;
    const maxSz = baseSize + (remainder > 0 ? 1 : 0);
    const minSz = baseSize;

    // Check if group sizes are within acceptable range [3, 5]
    if (minSz < 3 || maxSz > 5) {
      continue;
    }

    // Distance from target size
    const avgSize = totalEntrants / k;
    const dist = Math.abs(avgSize - targetSize);

    // Prefer k where max group size is closer to targetSize
    const score = dist * 10 + (maxSz - minSz);

    // Special preference matching standard tournament convention:
    // e.g., 14 entrants with target 4 -> 3 groups (5, 5, 4)
    if (score < bestScore) {
      bestScore = score;
      bestK = k;
    } else if (score === bestScore && k < bestK) {
      // Prefer fewer, slightly larger groups (e.g., 3 groups of 5,5,4 over 4 groups of 4,4,3,3)
      bestK = k;
    }
  }

  // Fallback if no k satisfied strictly [3, 5] (e.g. very small numbers < 6)
  if (bestScore === Infinity) {
    bestK = Math.max(1, Math.round(totalEntrants / targetSize));
  }

  return bestK;
}

/**
 * Splits entrants into balanced groups of 3–5 as close to targetSize as possible.
 * In random order by default, with optional seedOrder parameter so strong entrants
 * are snake-seeded across groups rather than clustered.
 *
 * @param entrantIds Array of entrant IDs (player IDs or duo team strings)
 * @param targetSize Preferred group size (defaults to 4)
 * @param seedOrder Optional ranked list of entrant IDs (e.g. by DUPR rating or previous standings)
 * @returns Array of TournamentGroup objects with empty rounds and assigned entrants
 */
export function buildGroups(
  entrantIds: string[],
  targetSize: number = 4,
  seedOrder?: string[]
): TournamentGroup[] {
  if (!entrantIds || entrantIds.length === 0) {
    return [];
  }

  const numGroups = calculateOptimalGroupCount(entrantIds.length, targetSize);
  if (numGroups <= 0) return [];

  // Order the entrants
  let orderedEntrants: string[];
  if (seedOrder && seedOrder.length > 0) {
    // Sort entrantIds according to their position in seedOrder
    // Unseeded entrants are placed at the end
    const seedMap = new Map<string, number>();
    seedOrder.forEach((id, idx) => seedMap.set(id, idx));

    orderedEntrants = [...entrantIds].sort((a, b) => {
      const rankA = seedMap.has(a) ? (seedMap.get(a) as number) : 999999;
      const rankB = seedMap.has(b) ? (seedMap.get(b) as number) : 999999;
      return rankA - rankB;
    });
  } else {
    // Random shuffle (Fisher-Yates) by default
    orderedEntrants = [...entrantIds];
    for (let i = orderedEntrants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = orderedEntrants[i];
      orderedEntrants[i] = orderedEntrants[j];
      orderedEntrants[j] = temp;
    }
  }

  // Initialize groups
  const groups: TournamentGroup[] = Array.from({ length: numGroups }, (_, i) => {
    const labelLetter = String.fromCharCode(65 + (i % 26));
    const labelSuffix = i >= 26 ? Math.floor(i / 26) + 1 : '';
    const label = `Group ${labelLetter}${labelSuffix}`;
    const id = `group-${labelLetter.toLowerCase()}${labelSuffix ? `-${labelSuffix}` : ''}-${Date.now()}-${i + 1}`;

    return {
      id,
      label,
      entrantIds: [],
      rounds: [],
    };
  });

  // Distribute entrants via Snake Seeding
  // Round 0: 0 -> k-1
  // Round 1: k-1 -> 0
  // Round 2: 0 -> k-1
  // etc.
  orderedEntrants.forEach((entrantId, index) => {
    const snakeCycle = Math.floor(index / numGroups);
    const posInCycle = index % numGroups;
    const groupIndex = snakeCycle % 2 === 0 ? posInCycle : numGroups - 1 - posInCycle;

    groups[groupIndex].entrantIds.push(entrantId);
  });

  return groups;
}

/**
 * Generates the classic round-robin schedule for a small fixed group using the Circle Method.
 * - Fixes one entrant, rotates the rest each round.
 * - For odd-sized groups, one entrant sits out each round exactly once via Round.restingPlayerIds.
 * - Every pair plays each other exactly once (complete round-robin).
 *
 * @param group TournamentGroup containing entrantIds
 * @returns Array of Round objects scoped to this group
 */
export function generateGroupRoundRobin(group: TournamentGroup): Round[] {
  const entrants = [...group.entrantIds];
  const numEntrants = entrants.length;

  if (numEntrants < 2) {
    return [];
  }

  // If odd number of entrants, add a dummy 'BYE' entry
  const isOdd = numEntrants % 2 !== 0;
  const items: string[] = isOdd ? [...entrants, '__BYE__'] : [...entrants];
  const n = items.length; // Always even (e.g. 4, 6, etc.)
  const totalRounds = n - 1;
  const matchesPerRound = n / 2;

  const rounds: Round[] = [];

  // Helper to extract player IDs from an entrant string (handles singles ID or comma-separated duo IDs)
  const extractPlayerIds = (entrantStr: string): string[] => {
    if (!entrantStr || entrantStr === '__BYE__') return [];
    return entrantStr.includes(',') ? entrantStr.split(',').map((s) => s.trim()) : [entrantStr];
  };

  for (let roundIdx = 0; roundIdx < totalRounds; roundIdx++) {
    const roundNumber = roundIdx + 1;
    const matches: Match[] = [];
    const restingPlayerIds: string[] = [];

    for (let p = 0; p < matchesPerRound; p++) {
      const teamA = items[p];
      const teamB = items[n - 1 - p];

      if (teamA === '__BYE__' || teamB === '__BYE__') {
        // The non-bye team rests this round
        const restingEntrant = teamA === '__BYE__' ? teamB : teamA;
        restingPlayerIds.push(...extractPlayerIds(restingEntrant));
      } else {
        const team1PlayerIds = extractPlayerIds(teamA);
        const team2PlayerIds = extractPlayerIds(teamB);

        const match: Match = {
          id: `${group.id}-r${roundNumber}-m${matches.length + 1}-${Date.now()}-${roundIdx}-${p}`,
          roundNumber,
          courtNumber: matches.length + 1,
          team1: { playerIds: team1PlayerIds },
          team2: { playerIds: team2PlayerIds },
          score1: 0,
          score2: 0,
          status: 'pending',
          completed: false,
        };

        matches.push(match);
      }
    }

    rounds.push({
      roundNumber,
      matches,
      restingPlayerIds,
      generatedAt: Date.now(),
      completed: false,
    });

    // Rotate elements 1..n-1 clockwise (Berger circle method)
    // Keep items[0] fixed at index 0
    const last = items[n - 1];
    for (let i = n - 1; i > 1; i--) {
      items[i] = items[i - 1];
    }
    items[1] = last;
  }

  return rounds;
}

/**
 * Calculates standings for a specific group by passing only the group's entrants
 * and the group's internal matches to calculateStandings.
 *
 * @param group TournamentGroup containing entrantIds and rounds
 * @param players Full roster of Player objects to look up names, ratings, etc.
 * @returns Sorted array of StandingsRow objects
 */
export function getGroupStandings(group: TournamentGroup, players: Player[]): StandingsRow[] {
  // Collect all player IDs in this group (including players in duo pairs if comma-separated)
  const groupPlayerIdSet = new Set<string>();
  group.entrantIds.forEach((entrant) => {
    if (entrant.includes(',')) {
      entrant.split(',').forEach((id) => groupPlayerIdSet.add(id.trim()));
    } else {
      groupPlayerIdSet.add(entrant);
    }
  });

  const groupPlayers = players.filter((p) => groupPlayerIdSet.has(p.id));

  // If some player IDs in entrantIds are not in players (e.g. simulated/string IDs), construct minimal Player objects
  group.entrantIds.forEach((entrant) => {
    if (!entrant.includes(',') && !groupPlayerIdSet.has(entrant)) {
      groupPlayers.push({
        id: entrant,
        name: `Entrant ${entrant}`,
        avatarColor: 'bg-indigo-600',
        joinedAtRound: 1,
        duprRating: 3.5,
        active: true,
      });
    }
  });

  return calculateStandings(groupPlayers, group.rounds);
}

/**
 * Calculates overall progress of the group stage across all groups.
 */
export function getGroupStageProgress(stage: GroupStage): {
  totalMatches: number;
  completedMatches: number;
  percentage: number;
  isComplete: boolean;
  matchesByGroup: Record<string, { total: number; completed: number }>;
} {
  let totalMatches = 0;
  let completedMatches = 0;
  const matchesByGroup: Record<string, { total: number; completed: number }> = {};

  stage.groups.forEach((group) => {
    let groupTotal = 0;
    let groupCompleted = 0;

    group.rounds.forEach((r) => {
      r.matches.forEach((m) => {
        groupTotal++;
        if (m.completed) {
          groupCompleted++;
        }
      });
    });

    matchesByGroup[group.id] = { total: groupTotal, completed: groupCompleted };
    totalMatches += groupTotal;
    completedMatches += groupCompleted;
  });

  const percentage = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;
  const isComplete = totalMatches > 0 && completedMatches === totalMatches;

  return {
    totalMatches,
    completedMatches,
    percentage,
    isComplete,
    matchesByGroup,
  };
}

/**
 * Updates a match's score and completion state inside a GroupStage.
 */
export function updateGroupMatchScore(
  stage: GroupStage,
  matchId: string,
  score1: number,
  score2: number,
  completed?: boolean
): GroupStage {
  let matchFound = false;

  const updatedGroups = stage.groups.map((group) => {
    let groupUpdated = false;

    const updatedRounds = group.rounds.map((round) => {
      const updatedMatches = round.matches.map((m) => {
        if (m.id === matchId) {
          matchFound = true;
          groupUpdated = true;
          const isDone = completed !== undefined ? completed : m.completed;
          return {
            ...m,
            score1,
            score2,
            completed: isDone,
            status: isDone ? 'completed' : score1 > 0 || score2 > 0 ? 'in_progress' : m.status,
          };
        }
        return m;
      });

      const allMatchesDone = updatedMatches.length > 0 && updatedMatches.every((m) => m.completed);

      return {
        ...round,
        matches: updatedMatches,
        completed: allMatchesDone,
      };
    });

    if (groupUpdated) {
      return {
        ...group,
        rounds: updatedRounds,
      };
    }
    return group;
  });

  return {
    ...stage,
    groups: updatedGroups,
  };
}

/**
 * Assigns or updates the court number for a match within a GroupStage.
 */
export function assignGroupMatchCourt(
  stage: GroupStage,
  matchId: string,
  courtNumber: number
): GroupStage {
  const updatedGroups = stage.groups.map((group) => {
    const updatedRounds = group.rounds.map((round) => {
      const updatedMatches = round.matches.map((m) => {
        if (m.id === matchId) {
          return {
            ...m,
            courtNumber,
          };
        }
        return m;
      });

      return {
        ...round,
        matches: updatedMatches,
      };
    });

    return {
      ...group,
      rounds: updatedRounds,
    };
  });

  return {
    ...stage,
    groups: updatedGroups,
  };
}

/**
 * Formats a clean, readable text summary of the Group Stage results for clipboard sharing.
 */
export function formatGroupStageForSharing(
  sessionName: string,
  stage: GroupStage,
  players: Player[]
): string {
  let text = `🏆 *${sessionName.toUpperCase()} — GROUP STAGE RESULTS*\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  stage.groups.forEach((group) => {
    const groupStandings = getGroupStandings(group, players);
    text += `\n*${group.label.toUpperCase()} STANDINGS:*\n`;

    groupStandings.forEach((row, idx) => {
      const qualifierTag =
        idx === 0
          ? '🥇 (1st ➔ Winners Bracket)'
          : idx === 1
          ? '🥈 (2nd ➔ Losers Bracket)'
          : `#${idx + 1}`;
      text += `${qualifierTag} ${row.playerName}: ${row.won}W-${row.lost}L | Diff: ${
        row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff
      } | ${row.winRate}%\n`;
    });
  });

  text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Generated with FairPlay Rotation & Tournament Engine`;

  return text;
}

