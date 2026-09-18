import {
  Match,
  Player,
  Round,
  FairnessMetric,
  UpcomingMatch,
  HeadToHeadRecord,
  MatchupCoverage,
  TeamVsTeamRecord,
  TeamMatchInstance,
} from '../types';

/**
 * Returns the number of matches each player has played across all given rounds.
 */
export function getPlayerMatchCounts(
  players: Player[],
  rounds: Round[],
  onlyCompleted = false
): Record<string, number> {
  const counts: Record<string, number> = {};
  players.forEach((p) => {
    counts[p.id] = 0;
  });

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      if (onlyCompleted && !match.completed) return;
      const allPlayersInMatch = [...match.team1.playerIds, ...match.team2.playerIds];
      allPlayersInMatch.forEach((pid) => {
        if (counts[pid] !== undefined) {
          counts[pid] += 1;
        } else {
          counts[pid] = 1;
        }
      });
    });
  });

  return counts;
}

/**
 * Computes how many consecutive rounds a player has been on the bench
 * up to the current state.
 */
export function getConsecutiveBenchRounds(
  players: Player[],
  rounds: Round[],
  onlyCompleted = false
): Record<string, number> {
  const benchStreaks: Record<string, number> = {};
  players.forEach((p) => {
    benchStreaks[p.id] = 0;
  });

  const targetRounds = onlyCompleted ? rounds.filter((r) => r.completed) : rounds;
  if (targetRounds.length === 0) return benchStreaks;

  // Walk backwards from latest round
  for (const player of players) {
    let streak = 0;
    for (let i = targetRounds.length - 1; i >= 0; i--) {
      const round = targetRounds[i];
      const isResting = (round.restingPlayerIds || []).includes(player.id);
      const isPlaying = (round.matches || []).some(
        (m) =>
          (m.team1?.playerIds || []).includes(player.id) ||
          (m.team2?.playerIds || []).includes(player.id)
      );

      if (isResting && !isPlaying) {
        streak += 1;
      } else if (isPlaying) {
        break; // streak broke
      }
    }
    benchStreaks[player.id] = streak;
  }

  return benchStreaks;
}

/**
 * Computes how many consecutive rounds a player has played in
 * counting backwards from the most recent round.
 */
export function getConsecutivePlayRounds(
  players: Player[],
  rounds: Round[],
  onlyCompleted = false
): Record<string, number> {
  const playStreaks: Record<string, number> = {};
  players.forEach((p) => {
    playStreaks[p.id] = 0;
  });

  const targetRounds = onlyCompleted ? rounds.filter((r) => r.completed) : rounds;
  if (targetRounds.length === 0) return playStreaks;

  // Walk backwards from latest round
  for (const player of players) {
    let streak = 0;
    for (let i = targetRounds.length - 1; i >= 0; i--) {
      const round = targetRounds[i];
      const isPlaying = (round.matches || []).some(
        (m) =>
          (m.team1?.playerIds || []).includes(player.id) ||
          (m.team2?.playerIds || []).includes(player.id)
      );

      if (isPlaying) {
        streak += 1;
      } else {
        break; // Streak broken by resting or missing round
      }
    }
    playStreaks[player.id] = streak;
  }

  return playStreaks;
}

/**
 * Computes the last round number in which the player played a match.
 */
export function getLastPlayedRound(
  players: Player[],
  rounds: Round[]
): Record<string, number> {
  const lastPlayed: Record<string, number> = {};
  players.forEach((p) => {
    lastPlayed[p.id] = 0;
  });

  rounds.forEach((round) => {
    round.matches.forEach((m) => {
      [...m.team1.playerIds, ...m.team2.playerIds].forEach((pid) => {
        lastPlayed[pid] = round.roundNumber;
      });
    });
  });

  return lastPlayed;
}

/**
 * Calculates mathematical fairness metrics for the current session.
 */
export function calculateFairnessMetric(players: Player[], rounds: Round[]): FairnessMetric {
  const activePlayers = players.filter((p) => p.active);
  if (activePlayers.length === 0) {
    return {
      minPlayed: 0,
      maxPlayed: 0,
      spread: 0,
      currentCycle: 1,
      playersInCurrentCycle: 0,
      totalActivePlayers: 0,
      isPerfectlyBalanced: true,
      fairnessScorePercentage: 100,
    };
  }

  const counts = getPlayerMatchCounts(activePlayers, rounds);
  const playCounts = activePlayers.map((p) => counts[p.id] || 0);
  const minPlayed = Math.min(...playCounts);
  const maxPlayed = Math.max(...playCounts);
  const spread = maxPlayed - minPlayed;

  const currentCycle = minPlayed + 1;
  const playersWhoCompletedCycle = activePlayers.filter((p) => (counts[p.id] || 0) >= currentCycle).length;

  const fairnessScorePercentage = spread <= 1 ? 100 : Math.max(0, 100 - (spread - 1) * 25);

  return {
    minPlayed,
    maxPlayed,
    spread,
    currentCycle,
    playersInCurrentCycle: playersWhoCompletedCycle,
    totalActivePlayers: activePlayers.length,
    isPerfectlyBalanced: spread === 0,
    fairnessScorePercentage,
  };
}

/**
 * Fisher-Yates array shuffle for unbiased random ordering
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Creates an initial randomized pool of active players for Round 1,
 * keeping locked duos together while completely randomizing who is chosen first.
 * This explicitly prevents players from manipulating squad bench order to play first.
 */
export function getRandomizedInitialCandidates(activePlayers: Player[]): Player[] {
  const handledIds = new Set<string>();
  const units: Player[][] = [];

  for (const player of activePlayers) {
    if (handledIds.has(player.id)) continue;

    if (player.duoPartnerId) {
      const partner = activePlayers.find(
        (p) => p.id === player.duoPartnerId && !handledIds.has(p.id)
      );
      if (partner) {
        units.push([player, partner]);
        handledIds.add(player.id);
        handledIds.add(partner.id);
        continue;
      }
    }

    units.push([player]);
    handledIds.add(player.id);
  }

  // Shuffle the units randomly so every player/duo has an equal chance
  const shuffledUnits = shuffleArray(units);

  // Flatten back into player candidates
  return shuffledUnits.flat();
}

/**
 * Computes partner and opponent interaction counts across all rounds
 */
export function getHistoryMatrices(rounds: Round[]): {
  partnerCount: Record<string, Record<string, number>>;
  opponentCount: Record<string, Record<string, number>>;
} {
  const partnerCount: Record<string, Record<string, number>> = {};
  const opponentCount: Record<string, Record<string, number>> = {};

  const inc = (map: Record<string, Record<string, number>>, a: string, b: string) => {
    if (!map[a]) map[a] = {};
    if (!map[b]) map[b] = {};
    map[a][b] = (map[a][b] || 0) + 1;
    map[b][a] = (map[b][a] || 0) + 1;
  };

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      const t1 = match.team1.playerIds;
      const t2 = match.team2.playerIds;

      for (let i = 0; i < t1.length; i++) {
        for (let j = i + 1; j < t1.length; j++) {
          inc(partnerCount, t1[i], t1[j]);
        }
      }
      for (let i = 0; i < t2.length; i++) {
        for (let j = i + 1; j < t2.length; j++) {
          inc(partnerCount, t2[i], t2[j]);
        }
      }
      for (const p1 of t1) {
        for (const p2 of t2) {
          inc(opponentCount, p1, p2);
        }
      }
    });
  });

  return { partnerCount, opponentCount };
}

export interface SelectionUnit {
  players: Player[];
  effectiveMatches: number;
  effectivePlayStreak: number;
  effectiveBenchStreak: number;
}

/**
 * OPTIMAL FAIR MATCHMAKING & ANTI-SUBGROUP ENGINE:
 * 1. Catch-Up Cadence: Players catching up can play up to 2 games in a row before resting.
 *    Any player with play streak >= 2 MUST rest if enough rested players exist.
 * 2. Equal Matches (Strict Priority): Players in the lowest match count tier are ALWAYS picked first.
 * 3. Anti-Subgroup Co-Occurrence Minimization: When picking candidates from a tier,
 *    evaluates combinations to minimize mutual court co-occurrence and penalizes repeats from the previous match.
 *    This mathematically eliminates isolated 4-player subgroup loops (especially with squad sizes that are multiples of 4).
 * 4. Locked Duos: Treated as atomic 2-person units, guaranteeing partners enter court and bench together.
 */
export function selectOptimalCandidatesForMatch({
  pool,
  neededSlots,
  rounds,
  matchCounts,
  playStreaks,
  benchStreaks,
  playersPerTeam,
  excludeIds = new Set<string>(),
  previousRoundPlayerIds = new Set<string>(),
}: {
  pool: Player[];
  neededSlots: number;
  rounds: Round[];
  matchCounts: Record<string, number>;
  playStreaks: Record<string, number>;
  benchStreaks: Record<string, number>;
  playersPerTeam: number;
  excludeIds?: Set<string>;
  previousRoundPlayerIds?: Set<string>;
}): Player[] {
  const available = pool.filter((p) => !excludeIds.has(p.id));
  if (available.length <= neededSlots) return available;

  // Build atomic units
  const units: SelectionUnit[] = [];
  const handled = new Set<string>();

  for (const player of available) {
    if (handled.has(player.id)) continue;

    if (playersPerTeam === 2 && player.duoPartnerId) {
      const partner = available.find(
        (p) => p.id === player.duoPartnerId && !handled.has(p.id)
      );
      if (partner) {
        units.push({
          players: [player, partner],
          effectiveMatches: Math.min(
            matchCounts[player.id] || 0,
            matchCounts[partner.id] || 0
          ),
          effectivePlayStreak: Math.max(
            playStreaks[player.id] || 0,
            playStreaks[partner.id] || 0
          ),
          effectiveBenchStreak: Math.min(
            benchStreaks[player.id] || 0,
            benchStreaks[partner.id] || 0
          ),
        });
        handled.add(player.id);
        handled.add(partner.id);
        continue;
      }
    }

    units.push({
      players: [player],
      effectiveMatches: matchCounts[player.id] || 0,
      effectivePlayStreak: playStreaks[player.id] || 0,
      effectiveBenchStreak: benchStreaks[player.id] || 0,
    });
    handled.add(player.id);
  }

  // When no rounds have been played (Round 1 / initial pool), shuffle units randomly
  // to avoid deterministically following the squad bench sequence
  const orderedUnits = rounds.length === 0 ? shuffleArray(units) : units;

  // Anti-fatigue check: play streak < 2
  const restedUnits = orderedUnits.filter((u) => u.effectivePlayStreak < 2);
  const totalRestedSlots = restedUnits.reduce((acc, u) => acc + u.players.length, 0);

  // If rested units can fill the needed slots, restrict to rested units
  // Otherwise fallback to all units
  let eligibleUnits = totalRestedSlots >= neededSlots ? restedUnits : orderedUnits;

  // Build co-occurrence matrix from history
  const { partnerCount, opponentCount } = getHistoryMatrices(rounds);
  const coOccur: Record<string, Record<string, number>> = {};
  for (const p of pool) {
    coOccur[p.id] = {};
    for (const p2 of pool) {
      coOccur[p.id][p2.id] =
        (partnerCount[p.id]?.[p2.id] || 0) + (opponentCount[p.id]?.[p2.id] || 0);
    }
  }

  // Group eligible units by effective matches ascending (Tiers)
  const matchValues = Array.from(
    new Set(eligibleUnits.map((u) => u.effectiveMatches))
  ).sort((a, b) => a - b);

  const maxPoolPlayed = pool.length > 0 ? Math.max(...pool.map((p) => matchCounts[p.id] || 0)) : 0;
  const selectedUnits: SelectionUnit[] = [];
  let currentSlots = 0;

  for (const matchVal of matchValues) {
    if (currentSlots >= neededSlots) break;

    const tierUnits = eligibleUnits.filter((u) => u.effectiveMatches === matchVal);

    // Prioritize units with longest bench rest and highest match deficit within tier
    tierUnits.sort((a, b) => {
      if (a.effectiveBenchStreak !== b.effectiveBenchStreak) {
        return b.effectiveBenchStreak - a.effectiveBenchStreak;
      }
      const maxDefA = Math.max(...a.players.map((p) => maxPoolPlayed - (matchCounts[p.id] || 0)));
      const maxDefB = Math.max(...b.players.map((p) => maxPoolPlayed - (matchCounts[p.id] || 0)));
      if (maxDefA !== maxDefB) {
        return maxDefB - maxDefA;
      }
      return 0;
    });

    const tierTotalSlots = tierUnits.reduce((acc, u) => acc + u.players.length, 0);

    if (currentSlots + tierTotalSlots <= neededSlots) {
      // Entire tier fits!
      selectedUnits.push(...tierUnits);
      currentSlots += tierTotalSlots;
    } else {
      // Need a subset of tierUnits to fill the remaining slots
      const neededFromTier = neededSlots - currentSlots;

      function findSubsets(
        arr: SelectionUnit[],
        target: number,
        start = 0
      ): SelectionUnit[][] {
        const results: SelectionUnit[][] = [];
        for (let i = start; i < arr.length; i++) {
          const u = arr[i];
          const len = u.players.length;
          if (len === target) {
            results.push([u]);
          } else if (len < target) {
            const sub = findSubsets(arr, target - len, i + 1);
            for (const s of sub) {
              results.push([u, ...s]);
            }
          }
        }
        return results;
      }

      let candidateSubsets =
        tierUnits.length <= 14 ? findSubsets(tierUnits, neededFromTier) : [];

      if (candidateSubsets.length === 0) {
        // Greedy picking if combinations cannot form exact sum (e.g. duo unit size 2 when target 1)
        // or pool is large
        let currentSubset: SelectionUnit[] = [];
        let curCount = 0;
        const remaining = [...tierUnits];

        while (curCount < neededFromTier && remaining.length > 0) {
          const fitUnits = remaining.filter(
            (u) => curCount + u.players.length <= neededFromTier
          );
          const poolToPick = fitUnits.length > 0 ? fitUnits : remaining;

          let bestUnit = poolToPick[0];
          let bestCost = Infinity;
          const currentPlayers = [
            ...selectedUnits.flatMap((u) => u.players),
            ...currentSubset.flatMap((u) => u.players),
          ];

          for (const cand of poolToPick) {
            let cost = 0;
            for (const candPlayer of cand.players) {
              for (const existing of currentPlayers) {
                cost += coOccur[candPlayer.id]?.[existing.id] || 0;
                if (
                  previousRoundPlayerIds.has(candPlayer.id) &&
                  previousRoundPlayerIds.has(existing.id)
                ) {
                  cost += 10;
                }
              }
            }
            cost += Math.random() * 0.001;
            if (cost < bestCost) {
              bestCost = cost;
              bestUnit = cand;
            }
          }

          currentSubset.push(bestUnit);
          curCount += bestUnit.players.length;
          const idx = remaining.findIndex((u) => u === bestUnit);
          if (idx !== -1) remaining.splice(idx, 1);
        }

        candidateSubsets = [currentSubset];
      }

      // Pick subset that minimizes co-occurrence and repetition
      const existingPlayers = selectedUnits.flatMap((u) => u.players);
      let bestSubset = candidateSubsets[0];
      let bestCost = Infinity;

      for (const subset of candidateSubsets) {
        const allCandidates = [
          ...existingPlayers,
          ...subset.flatMap((u) => u.players),
        ];
        let cost = 0;
        for (let i = 0; i < allCandidates.length; i++) {
          for (let j = i + 1; j < allCandidates.length; j++) {
            const id1 = allCandidates[i].id;
            const id2 = allCandidates[j].id;
            cost += coOccur[id1]?.[id2] || 0;
            if (
              previousRoundPlayerIds.has(id1) &&
              previousRoundPlayerIds.has(id2)
            ) {
              cost += 10;
            }
          }
        }
        cost += Math.random() * 0.001;
        if (cost < bestCost) {
          bestCost = cost;
          bestSubset = subset;
        }
      }

      selectedUnits.push(...bestSubset);
      currentSlots += bestSubset.reduce((acc, u) => acc + u.players.length, 0);
    }
  }

  return selectedUnits.flatMap((u) => u.players);
}

/**
 * Backward-compatible candidate sorting wrapper
 */
export function sortCandidatesWithCatchUpCadence(params: {
  candidates: Player[];
  allActivePlayers: Player[];
  matchCounts: Record<string, number>;
  playStreaks: Record<string, number>;
  benchStreaks: Record<string, number>;
  duoPriorityMap?: Map<string, number>;
  currentlyPlayingIds?: Set<string>;
}): Player[] {
  const { candidates, matchCounts, playStreaks, benchStreaks, duoPriorityMap } = params;
  if (candidates.length <= 1) return [...candidates];

  const getEffectiveCount = (p: Player) =>
    duoPriorityMap?.get(p.id) ?? (matchCounts[p.id] || 0);

  const eligible = candidates.filter((p) => (playStreaks[p.id] || 0) < 2);
  const mustRest = candidates.filter((p) => (playStreaks[p.id] || 0) >= 2);

  const sortedEligible = [...eligible].sort((a, b) => {
    const cA = getEffectiveCount(a);
    const cB = getEffectiveCount(b);
    if (cA !== cB) return cA - cB;
    return (benchStreaks[b.id] || 0) - (benchStreaks[a.id] || 0);
  });

  return [...sortedEligible, ...mustRest];
}

export interface SessionHistoryGraph {
  teammateHistory: Record<string, Set<string>>;
  opponentHistory: Record<string, Set<string>>;
  matchCount: Record<string, number>;
  fillerCount: Record<string, number>;
  lastFillerRound: Record<string, number>;
}

/**
 * Builds persistent session graph and adjacency matrices for
 * teammate history, opponent history, match counts, and filler participation.
 */
export function buildSessionGraph(players: Player[], rounds: Round[]): SessionHistoryGraph {
  const teammateHistory: Record<string, Set<string>> = {};
  const opponentHistory: Record<string, Set<string>> = {};
  const matchCount: Record<string, number> = {};
  const fillerCount: Record<string, number> = {};
  const lastFillerRound: Record<string, number> = {};

  players.forEach((p) => {
    teammateHistory[p.id] = new Set();
    opponentHistory[p.id] = new Set();
    matchCount[p.id] = 0;
    fillerCount[p.id] = 0;
    lastFillerRound[p.id] = 0;
  });

  rounds.forEach((rd) => {
    rd.matches.forEach((m) => {
      const t1 = m.team1.playerIds;
      const t2 = m.team2.playerIds;

      // Teammate interactions
      for (let i = 0; i < t1.length; i++) {
        for (let j = i + 1; j < t1.length; j++) {
          teammateHistory[t1[i]]?.add(t1[j]);
          teammateHistory[t1[j]]?.add(t1[i]);
        }
      }
      for (let i = 0; i < t2.length; i++) {
        for (let j = i + 1; j < t2.length; j++) {
          teammateHistory[t2[i]]?.add(t2[j]);
          teammateHistory[t2[j]]?.add(t2[i]);
        }
      }

      // Opponent interactions
      for (const p1 of t1) {
        for (const p2 of t2) {
          opponentHistory[p1]?.add(p2);
          opponentHistory[p2]?.add(p1);
        }
      }

      // Match participation
      [...t1, ...t2].forEach((pid) => {
        matchCount[pid] = (matchCount[pid] || 0) + 1;
      });

      // Filler tracking
      if (m.fillerPlayerIds && m.fillerPlayerIds.length > 0) {
        m.fillerPlayerIds.forEach((fId) => {
          fillerCount[fId] = (fillerCount[fId] || 0) + 1;
          lastFillerRound[fId] = rd.roundNumber;
        });
      }
    });
  });

  return {
    teammateHistory,
    opponentHistory,
    matchCount,
    fillerCount,
    lastFillerRound,
  };
}

/**
 * Regenerates a pending match when a player is dropped, removed, or paused,
 * pulling an eligible filler player using odd-count escalation and teammate constraints.
 */
export function regeneratePendingMatchWithFiller(params: {
  round: Round;
  matchId: string;
  droppedPlayerId: string;
  players: Player[];
  rounds: Round[];
}): { updatedRound: Round; replacementPlayerId: string | null } {
  const { round, matchId, droppedPlayerId, players, rounds } = params;
  const matchIndex = round.matches.findIndex((m) => m.id === matchId);
  if (matchIndex === -1) return { updatedRound: round, replacementPlayerId: null };

  const targetMatch = round.matches[matchIndex];
  if (targetMatch.completed) return { updatedRound: round, replacementPlayerId: null };

  const inTeam1 = targetMatch.team1.playerIds.includes(droppedPlayerId);
  const inTeam2 = targetMatch.team2.playerIds.includes(droppedPlayerId);
  if (!inTeam1 && !inTeam2) return { updatedRound: round, replacementPlayerId: null };

  const activePlayers = players.filter((p) => p.active && p.id !== droppedPlayerId);
  const currentMatchPlayerIds = new Set([
    ...targetMatch.team1.playerIds.filter((id) => id !== droppedPlayerId),
    ...targetMatch.team2.playerIds.filter((id) => id !== droppedPlayerId),
  ]);

  const partnerIds = inTeam1
    ? targetMatch.team1.playerIds.filter((id) => id !== droppedPlayerId)
    : targetMatch.team2.playerIds.filter((id) => id !== droppedPlayerId);

  const history = buildSessionGraph(players, rounds);

  // Filter candidates: active players not already in this match
  const candidates = activePlayers.filter((p) => !currentMatchPlayerIds.has(p.id));

  // Score candidates
  const scoredCandidates = candidates.map((cand) => {
    let teammateConflict = false;
    for (const pid of partnerIds) {
      if (history.teammateHistory[cand.id]?.has(pid)) {
        teammateConflict = true;
      }
    }
    const mc = history.matchCount[cand.id] || 0;
    const fc = history.fillerCount[cand.id] || 0;
    const isRecentFiller = history.lastFillerRound[cand.id] === round.roundNumber;
    return {
      player: cand,
      matchCount: mc,
      teammateConflict,
      fillerScore: fc + (isRecentFiller ? 5 : 0),
    };
  });

  const viable = scoredCandidates.filter((c) => !c.teammateConflict);
  const poolToPick = viable.length > 0 ? viable : scoredCandidates;

  // Group by match count ascending: strictly avoid players with more played games than others
  const minMatches = poolToPick.length > 0 ? Math.min(...poolToPick.map((c) => c.matchCount)) : 0;
  const lowestMatchCandidates = poolToPick.filter((c) => c.matchCount === minMatches);

  // Randomize among equal lowest-match candidates to avoid repetitive picks
  const shuffledEqual = shuffleArray(lowestMatchCandidates);
  shuffledEqual.sort((a, b) => a.fillerScore - b.fillerScore);

  const chosen = (shuffledEqual[0] || poolToPick.sort((a, b) => a.matchCount - b.matchCount)[0])?.player;
  if (!chosen) return { updatedRound: round, replacementPlayerId: null };

  const newTeam1 = inTeam1
    ? targetMatch.team1.playerIds.map((id) => (id === droppedPlayerId ? chosen.id : id))
    : [...targetMatch.team1.playerIds];
  const newTeam2 = inTeam2
    ? targetMatch.team2.playerIds.map((id) => (id === droppedPlayerId ? chosen.id : id))
    : [...targetMatch.team2.playerIds];

  const newFillers = Array.from(new Set([...(targetMatch.fillerPlayerIds || []), chosen.id]));

  const updatedMatches = [...round.matches];
  updatedMatches[matchIndex] = {
    ...targetMatch,
    team1: { playerIds: newTeam1 },
    team2: { playerIds: newTeam2 },
    fillerPlayerIds: newFillers,
  };

  return {
    updatedRound: {
      ...round,
      matches: updatedMatches,
    },
    replacementPlayerId: chosen.id,
  };
}

/**
 * Sanitizes rounds to ensure that:
 * 1. Every match has distinct player IDs (no duplicate player IDs across or within teams).
 * 2. If duplicate player IDs exist (e.g. from corrupt storage or previous runs), they are replaced with
 *    valid available active players who are not already in that match.
 */
export function sanitizeRounds(rounds: Round[], players: Player[]): Round[] {
  if (!Array.isArray(rounds) || rounds.length === 0) return [];
  const activePlayers = players.filter((p) => p.active);
  const allPlayers = players;

  return rounds.map((round) => {
    const updatedMatches = round.matches.map((match) => {
      const seen = new Set<string>();
      let hasDuplicates = false;

      // Check team1
      for (const id of match.team1.playerIds) {
        if (seen.has(id)) hasDuplicates = true;
        seen.add(id);
      }
      // Check team2
      for (const id of match.team2.playerIds) {
        if (seen.has(id)) hasDuplicates = true;
        seen.add(id);
      }

      if (!hasDuplicates) return match;

      // Fix duplicates
      const assigned = new Set<string>();
      const newT1: string[] = [];
      const newT2: string[] = [];

      const getReplacement = (): string | null => {
        const candidate =
          activePlayers.find((p) => !assigned.has(p.id)) ||
          allPlayers.find((p) => !assigned.has(p.id));
        return candidate ? candidate.id : null;
      };

      for (const id of match.team1.playerIds) {
        if (!assigned.has(id)) {
          assigned.add(id);
          newT1.push(id);
        } else {
          const repl = getReplacement();
          if (repl) {
            assigned.add(repl);
            newT1.push(repl);
          }
        }
      }

      for (const id of match.team2.playerIds) {
        if (!assigned.has(id)) {
          assigned.add(id);
          newT2.push(id);
        } else {
          const repl = getReplacement();
          if (repl) {
            assigned.add(repl);
            newT2.push(repl);
          }
        }
      }

      return {
        ...match,
        team1: { playerIds: newT1 },
        team2: { playerIds: newT2 },
      };
    });

    return {
      ...round,
      matches: updatedMatches,
    };
  });
}

/**
 * Master Continuous Round Generator:
 * Eliminates static "resting benches." Every match generated is active or queued directly
 * into the round. Organizes play into distinct target rounds (Round 1: 1 match/player;
 * Round 2: 2 matches/player). Automatically fills remainders using odd-count escalation
 * and enforces anti-repeat constraints (no duplicate teammates, maximum opponent separation).
 * INVARIANT: Every match contains strictly distinct player IDs. No player is ever duplicated within a match.
 */
export function generateNextFairRound(params: {
  players: Player[];
  rounds: Round[];
  courtsCount: number;
  playersPerTeam: number;
  manualOverrides?: {
    team1?: string[];
    team2?: string[];
  };
  onDeckMatch?: UpcomingMatch;
}): Round {
  const { players, rounds, courtsCount, playersPerTeam } = params;
  const activePlayers = players.filter((p) => p.active);
  const matchCapacity = playersPerTeam * 2;
  const roundNumber = rounds.length + 1;

  if (activePlayers.length < matchCapacity || courtsCount <= 0) {
    return {
      roundNumber,
      matches: [],
      restingPlayerIds: activePlayers.map((p) => p.id),
      generatedAt: Date.now(),
      completed: false,
      targetMatchesPerPlayer: roundNumber,
    };
  }

  const history = buildSessionGraph(players, rounds);
  const neededMatches = Math.ceil(activePlayers.length / matchCapacity);
  const rem = activePlayers.length % matchCapacity;
  const neededFillers = rem === 0 ? 0 : matchCapacity - rem;

  // Track player match counts and catch-up deficits
  const playCounts = activePlayers.map((p) => history.matchCount[p.id] || 0);
  const maxPlayed = playCounts.length > 0 ? Math.max(...playCounts) : 0;
  const minPlayed = playCounts.length > 0 ? Math.min(...playCounts) : 0;

  const getPlayerDeficit = (id: string) => maxPlayed - (history.matchCount[id] || 0);
  const isLateJoiner = (p: Player) =>
    (p.joinedAtRound || 1) > 1 && (getPlayerDeficit(p.id) > 0 || (p.joinedAtRound || 1) >= roundNumber);

  // Identify locked duo pairs among active players
  const duoPartnerMap = new Map<string, string>();
  activePlayers.forEach((p) => {
    if (p.duoPartnerId) {
      const partner = activePlayers.find((other) => other.id === p.duoPartnerId);
      if (partner) {
        duoPartnerMap.set(p.id, partner.id);
      }
    }
  });

  // Function to partition a match's distinct player IDs into team1 and team2
  function getBestTeamSplit(matchPlayerIds: string[]): {
    team1: string[];
    team2: string[];
    teammatePenalty: number;
    opponentPenalty: number;
  } {
    let lockedDuo: [string, string] | null = null;
    for (const pid of matchPlayerIds) {
      const partnerId = duoPartnerMap.get(pid);
      if (partnerId && matchPlayerIds.includes(partnerId)) {
        lockedDuo = [pid, partnerId];
        break;
      }
    }

    const allSplits: { t1: string[]; t2: string[] }[] = [];

    function generateCombos(arr: string[], k: number, start = 0, current: string[] = []): void {
      if (current.length === k) {
        const t1 = [...current];
        const t1Set = new Set(t1);
        const t2 = arr.filter((x) => !t1Set.has(x));
        allSplits.push({ t1, t2 });
        return;
      }
      for (let i = start; i < arr.length; i++) {
        current.push(arr[i]);
        generateCombos(arr, k, i + 1, current);
        current.pop();
      }
    }

    generateCombos(matchPlayerIds, playersPerTeam);

    // For Round 1, shuffle candidate splits so team assignments are truly random
    // and do not deterministically default to allSplits[0] (players 0+1 vs 2+3)
    const splitsToEvaluate = roundNumber === 1 ? shuffleArray(allSplits) : allSplits;

    let bestSplit = splitsToEvaluate[0] || {
      t1: matchPlayerIds.slice(0, playersPerTeam),
      t2: matchPlayerIds.slice(playersPerTeam),
    };
    let bestScore = Infinity;
    let bestTScore = Infinity;
    let bestOScore = Infinity;

    for (const split of splitsToEvaluate) {
      if (lockedDuo) {
        const [d1, d2] = lockedDuo;
        const d1InT1 = split.t1.includes(d1);
        const d2InT1 = split.t1.includes(d2);
        if (d1InT1 !== d2InT1) continue;
      }

      let teammateRepeats = 0;
      for (let i = 0; i < split.t1.length; i++) {
        for (let j = i + 1; j < split.t1.length; j++) {
          if (history.teammateHistory[split.t1[i]]?.has(split.t1[j])) teammateRepeats++;
        }
      }
      for (let i = 0; i < split.t2.length; i++) {
        for (let j = i + 1; j < split.t2.length; j++) {
          if (history.teammateHistory[split.t2[i]]?.has(split.t2[j])) teammateRepeats++;
        }
      }

      let oppCollisions = 0;
      for (const p1 of split.t1) {
        for (const p2 of split.t2) {
          if (history.opponentHistory[p1]?.has(p2)) oppCollisions++;
        }
      }

      const score = teammateRepeats * 1000 + oppCollisions;
      if (score < bestScore) {
        bestScore = score;
        bestTScore = teammateRepeats;
        bestOScore = oppCollisions;
        bestSplit = split;
        if (score === 0) break;
      }
    }

    return {
      team1: bestSplit.t1,
      team2: bestSplit.t2,
      teammatePenalty: bestTScore,
      opponentPenalty: bestOScore,
    };
  }

  // Pre-filter candidate fillers:
  // 1. Top priority: Catch up players with deficits / lowest matches played.
  // 2. Avoid players who are above the target matches of the round or have more played games than others.
  // 3. If all players have equal matches, choose a random filler among them.
  function pickFillersForMatch(
    neededCount: number,
    excludedPlayerIds: Set<string>,
    poolPlayers: Player[]
  ): string[] {
    const candidates = poolPlayers.filter((p) => !excludedPlayerIds.has(p.id));
    if (candidates.length === 0) return [];
    if (candidates.length <= neededCount) {
      return candidates.map((p) => p.id);
    }

    const scored = candidates.map((cand) => {
      const mc = history.matchCount[cand.id] || 0;
      const fc = history.fillerCount[cand.id] || 0;
      const wasRecent = history.lastFillerRound[cand.id] === roundNumber - 1 ? 1 : 0;
      return { cand, mc, fc, wasRecent, rand: Math.random() };
    });

    scored.sort((a, b) => {
      // 1. Strict priority: players with LESS games than others
      if (a.mc !== b.mc) return a.mc - b.mc;
      // 2. Avoid back-to-back filler assignments
      if (a.wasRecent !== b.wasRecent) return a.wasRecent - b.wasRecent;
      // 3. Fewer lifetime filler assignments first
      if (a.fc !== b.fc) return a.fc - b.fc;
      // 4. Randomize among equal players
      return a.rand - b.rand;
    });

    return scored.slice(0, neededCount).map((s) => s.cand.id);
  }

  interface FormedMatch {
    team1: string[];
    team2: string[];
    fillerPlayerIds?: string[];
    catchUpPlayerIds?: string[];
    isCatchUpMatch?: boolean;
  }

  let bestRoundMatches: FormedMatch[] | null = null;
  let bestRoundPenalty = Infinity;
  let roundRestingPlayerIds: string[] = [];

  // Build duo units so locked partners stay together
  const visitedDuo = new Set<string>();
  const playerUnits: string[][] = [];
  activePlayers.forEach((p) => {
    if (visitedDuo.has(p.id)) return;
    const partnerId = duoPartnerMap.get(p.id);
    if (partnerId && !visitedDuo.has(partnerId)) {
      visitedDuo.add(p.id);
      visitedDuo.add(partnerId);
      playerUnits.push([p.id, partnerId]);
    } else {
      visitedDuo.add(p.id);
      playerUnits.push([p.id]);
    }
  });

  // For Round 1, completely randomize player units so initial rotation does NOT follow squad bench sequence
  const basePlayerUnits = roundNumber === 1 ? shuffleArray(playerUnits) : playerUnits;

  // Calculate unit priority score to ensure late joiners and catch-up players play in Match 1 (Court 1)
  function getUnitPriority(unit: string[]): {
    deficit: number;
    isLate: boolean;
    joinedRound: number;
    matchCount: number;
  } {
    let maxDef = 0;
    let late = false;
    let maxJR = 1;
    let minMC = Infinity;

    unit.forEach((id) => {
      const p = players.find((pl) => pl.id === id);
      const def = getPlayerDeficit(id);
      const mc = history.matchCount[id] || 0;
      const jr = p?.joinedAtRound || 1;

      if (def > maxDef) maxDef = def;
      if (mc < minMC) minMC = mc;
      if (jr > maxJR) maxJR = jr;
      // Note: On Round 1 (roundNumber === 1), no player is a late joiner
      if (p && (isLateJoiner(p) || (roundNumber > 1 && jr >= roundNumber) || def > 0)) late = true;
    });

    return {
      deficit: maxDef,
      isLate: late,
      joinedRound: maxJR,
      matchCount: minMC === Infinity ? 0 : minMC,
    };
  }

  // Units that have late joiners or a deficit must play FIRST (Court 1 / earliest matches)
  // On Round 1, there are no deficits or late joiners, so priorityUnits is empty
  const priorityUnits = roundNumber === 1 ? [] : basePlayerUnits.filter((u) => {
    const prio = getUnitPriority(u);
    return prio.isLate || prio.deficit > 0;
  });

  if (roundNumber > 1 && priorityUnits.length > 0) {
    priorityUnits.sort((uA, uB) => {
      const pA = getUnitPriority(uA);
      const pB = getUnitPriority(uB);
      if (pA.isLate !== pB.isLate) return pA.isLate ? -1 : 1;
      if (pA.deficit !== pB.deficit) return pB.deficit - pA.deficit; // Largest deficit first!
      if (pA.joinedRound !== pB.joinedRound) return pB.joinedRound - pA.joinedRound; // Latest joiner first!
      if (pA.matchCount !== pB.matchCount) return pA.matchCount - pB.matchCount; // Fewest matches first!
      return 0;
    });
  }

  const standardUnits = roundNumber === 1 ? basePlayerUnits : basePlayerUnits.filter((u) => {
    const prio = getUnitPriority(u);
    return !prio.isLate && prio.deficit === 0;
  });

  const iterations = roundNumber === 1 ? 50 : 200;

  for (let iter = 0; iter < iterations; iter++) {
    // Priority units (late joiners / catch-up players) are ALWAYS placed first in match 1 / court 1!
    const shuffledStandard = shuffleArray(standardUnits);
    const orderedUnits = [...priorityUnits, ...shuffledStandard];

    // Pack units into match buckets, preserving locked duos intact wherever possible
    const matchBuckets: string[][] = [];
    const remainingUnits = orderedUnits.map((u) => [...u]);

    for (let m = 0; m < neededMatches; m++) {
      const slots = m === neededMatches - 1 && rem > 0 ? rem : matchCapacity;
      const bucket: string[] = [];

      while (bucket.length < slots && remainingUnits.length > 0) {
        const space = slots - bucket.length;
        // Prioritize finding a unit that fits cleanly without splitting
        let pickedIdx = remainingUnits.findIndex((u) => u.length <= space);
        if (pickedIdx === -1) {
          pickedIdx = 0;
        }
        const unit = remainingUnits[pickedIdx];
        if (unit.length <= space) {
          bucket.push(...unit);
          remainingUnits.splice(pickedIdx, 1);
        } else {
          bucket.push(...unit.slice(0, space));
          remainingUnits[pickedIdx] = unit.slice(space);
        }
      }
      matchBuckets.push(bucket);
    }

    // If there are any remaining units, append them to buckets that have space
    if (remainingUnits.length > 0) {
      for (const u of remainingUnits) {
        for (const pid of u) {
          const targetB = matchBuckets.find((b, idx) => {
            const slots = idx === neededMatches - 1 && rem > 0 ? rem : matchCapacity;
            return b.length < slots;
          });
          if (targetB) targetB.push(pid);
        }
      }
    }

    let fillerIdsForLastMatch: string[] = [];
    if (neededFillers > 0) {
      const lastMatchAssignedSet = new Set(matchBuckets[neededMatches - 1]);
      const earlierPlayers = activePlayers.filter((p) => !lastMatchAssignedSet.has(p.id));
      fillerIdsForLastMatch = pickFillersForMatch(
        neededFillers,
        lastMatchAssignedSet,
        earlierPlayers
      );
      matchBuckets[neededMatches - 1].push(...fillerIdsForLastMatch);
    }

    // Validate that every match has the exact required matchCapacity and 100% distinct players
    let allMatchesValid = true;
    for (const b of matchBuckets) {
      if (new Set(b).size !== matchCapacity) {
        allMatchesValid = false;
        break;
      }
    }
    if (!allMatchesValid) continue;

    let roundTeammatePen = 0;
    let roundOpponentPen = 0;
    const candidateRound: FormedMatch[] = [];

    for (let m = 0; m < neededMatches; m++) {
      const pids = matchBuckets[m];
      const split = getBestTeamSplit(pids);
      roundTeammatePen += split.teammatePenalty;
      roundOpponentPen += split.opponentPenalty;

      const matchCatchUps: string[] = [];
      const matchPureFillers: string[] = [];

      // Flag catch-up players and fillers in the remainder match
      if (m === neededMatches - 1 && fillerIdsForLastMatch.length > 0) {
        fillerIdsForLastMatch.forEach((fid) => {
          if (getPlayerDeficit(fid) > 0) {
            if (!matchCatchUps.includes(fid)) {
              matchCatchUps.push(fid);
            }
          } else {
            matchPureFillers.push(fid);
          }
        });
      }

      candidateRound.push({
        team1: split.team1,
        team2: split.team2,
        fillerPlayerIds: matchPureFillers.length > 0 ? matchPureFillers : undefined,
        catchUpPlayerIds: matchCatchUps.length > 0 ? matchCatchUps : undefined,
      });
    }

    const totalPen = roundTeammatePen * 1000 + roundOpponentPen;
    if (totalPen < bestRoundPenalty) {
      bestRoundPenalty = totalPen;
      bestRoundMatches = candidateRound;
      roundRestingPlayerIds = [];
      if (totalPen === 0) break;
    }
  }

  // Safe partitioned fallback: guaranteed 100% distinct players per match
  if (!bestRoundMatches) {
    const orderedUnits = [...priorityUnits, ...shuffleArray(standardUnits)];
    const regularAssigned: string[] = [];
    orderedUnits.forEach((u) => regularAssigned.push(...u));

    const matchBuckets: string[][] = [];
    let curIdx = 0;
    for (let m = 0; m < neededMatches; m++) {
      const slots = m === neededMatches - 1 && rem > 0 ? rem : matchCapacity;
      const bucket = regularAssigned.slice(curIdx, curIdx + slots);
      curIdx += slots;
      matchBuckets.push(bucket);
    }

    let fillerIdsForLastMatch: string[] = [];
    if (neededFillers > 0) {
      const lastMatchAssignedSet = new Set(matchBuckets[neededMatches - 1]);
      const earlierPlayers = activePlayers.filter((p) => !lastMatchAssignedSet.has(p.id));
      fillerIdsForLastMatch = pickFillersForMatch(
        neededFillers,
        lastMatchAssignedSet,
        earlierPlayers
      );
      matchBuckets[neededMatches - 1].push(...fillerIdsForLastMatch);
    }

    bestRoundMatches = matchBuckets.map((bucket, m) => {
      const split = getBestTeamSplit(bucket);
      const matchCatchUps: string[] = [];
      const matchPureFillers: string[] = [];
      if (m === neededMatches - 1 && fillerIdsForLastMatch.length > 0) {
        fillerIdsForLastMatch.forEach((fid) => {
          if (getPlayerDeficit(fid) > 0) {
            matchCatchUps.push(fid);
          } else {
            matchPureFillers.push(fid);
          }
        });
      }
      return {
        team1: split.team1,
        team2: split.team2,
        fillerPlayerIds: matchPureFillers.length > 0 ? matchPureFillers : undefined,
        catchUpPlayerIds: matchCatchUps.length > 0 ? matchCatchUps : undefined,
      };
    });
  }

  // If neededMatches <= courtsCount (all matches play simultaneously) and there are players with a deficit,
  // append a dedicated queued Catch-Up Match so late joiners can play an extra match and catch up!
  const hasUnresolvedCatchUp =
    neededMatches <= courtsCount &&
    activePlayers.some((p) => getPlayerDeficit(p.id) > 0);

  if (hasUnresolvedCatchUp && bestRoundMatches) {
    const catchUpPlayers = activePlayers
      .filter((p) => getPlayerDeficit(p.id) > 0)
      .sort((a, b) => getPlayerDeficit(b.id) - getPlayerDeficit(a.id));

    if (catchUpPlayers.length > 0) {
      const catchUpUnit = catchUpPlayers.slice(0, matchCapacity);
      const catchUpIds = catchUpUnit.map((p) => p.id);
      const neededExtraFillers = matchCapacity - catchUpIds.length;

      let extraFillerIds: string[] = [];
      if (neededExtraFillers > 0) {
        const pool = activePlayers.filter((p) => !catchUpIds.includes(p.id));
        extraFillerIds = pickFillersForMatch(neededExtraFillers, new Set(catchUpIds), pool);
      }

      const allCatchUpMatchIds = [...catchUpIds, ...extraFillerIds];
      if (allCatchUpMatchIds.length === matchCapacity) {
        const split = getBestTeamSplit(allCatchUpMatchIds);
        const matchPureFillers = extraFillerIds.filter((id) => getPlayerDeficit(id) === 0);
        const matchCatchUps = [
          ...catchUpIds,
          ...extraFillerIds.filter((id) => getPlayerDeficit(id) > 0),
        ];

        bestRoundMatches.push({
          team1: split.team1,
          team2: split.team2,
          fillerPlayerIds: matchPureFillers.length > 0 ? matchPureFillers : undefined,
          catchUpPlayerIds: matchCatchUps,
          isCatchUpMatch: true,
        });
      }
    }
  }

  const generatedMatches: Match[] = bestRoundMatches.map((bm, idx) => {
    const courtNumber = idx < courtsCount ? idx + 1 : undefined;
    return {
      id: `m-r${roundNumber}-m${idx + 1}-${Date.now()}-${idx + 1}`,
      roundNumber,
      courtNumber,
      team1: { playerIds: bm.team1 },
      team2: { playerIds: bm.team2 },
      score1: 0,
      score2: 0,
      completed: false,
      status: 'pending',
      startedAt: undefined,
      fillerPlayerIds: bm.fillerPlayerIds,
      catchUpPlayerIds: bm.catchUpPlayerIds,
      isCatchUpMatch: bm.isCatchUpMatch,
      matchOrder: idx + 1,
    };
  });

  // Invariant: Verify that all active players are participating in at least one match in this round
  const allParticipatingPlayerIds = new Set<string>();
  bestRoundMatches.forEach((m) => {
    m.team1.forEach((id) => allParticipatingPlayerIds.add(id));
    m.team2.forEach((id) => allParticipatingPlayerIds.add(id));
  });
  const unassignedActivePlayerIds = activePlayers
    .filter((p) => !allParticipatingPlayerIds.has(p.id))
    .map((p) => p.id);

  return {
    roundNumber,
    matches: generatedMatches,
    restingPlayerIds: unassignedActivePlayerIds,
    generatedAt: Date.now(),
    completed: false,
    targetMatchesPerPlayer: roundNumber,
  };
}

/**
 * Returns how many times two players have partnered together as teammates
 */
export function getPairPartnerTimes(
  p1Id: string,
  p2Id: string,
  partnerCount: Record<string, Record<string, number>>
): number {
  if (!p1Id || !p2Id || p1Id === p2Id) return 0;
  return partnerCount[p1Id]?.[p2Id] || 0;
}

/**
 * Counts how many active players a given player has NOT yet partnered with (partnerCount === 0)
 */
export function getUnpairedPartnersCount(
  playerId: string,
  activePlayers: Player[],
  rounds: Round[]
): number {
  const { partnerCount } = getHistoryMatrices(rounds);
  let count = 0;
  for (const p of activePlayers) {
    if (p.id === playerId || !p.active) continue;
    if ((partnerCount[playerId]?.[p.id] || 0) === 0) {
      count++;
    }
  }
  return count;
}

/**
 * Counts how many active players a given player has NOT yet faced as an opponent (opponentCount === 0)
 */
export function getUnfacedOpponentsCount(
  playerId: string,
  activePlayers: Player[],
  rounds: Round[]
): number {
  const { opponentCount } = getHistoryMatrices(rounds);
  let count = 0;
  for (const p of activePlayers) {
    if (p.id === playerId || !p.active) continue;
    if ((opponentCount[playerId]?.[p.id] || 0) === 0) {
      count++;
    }
  }
  return count;
}

export interface PartnershipCoverage {
  totalPossiblePairs: number;
  uniquePairsFormed: number;
  coveragePercentage: number;
  neverPairedCount: number;
  partnerMatrix: Record<string, Record<string, number>>;
}

/**
 * Calculates the overall session partnership diversity and pairing coverage
 */
export function getPartnershipCoverage(
  players: Player[],
  rounds: Round[]
): PartnershipCoverage {
  const active = players.filter((p) => p.active);
  const totalPossiblePairs =
    active.length > 1 ? (active.length * (active.length - 1)) / 2 : 0;
  const { partnerCount } = getHistoryMatrices(rounds);

  let uniquePairsFormed = 0;
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if ((partnerCount[active[i].id]?.[active[j].id] || 0) > 0) {
        uniquePairsFormed++;
      }
    }
  }

  const coveragePercentage =
    totalPossiblePairs > 0
      ? Math.round((uniquePairsFormed / totalPossiblePairs) * 100)
      : 100;

  return {
    totalPossiblePairs,
    uniquePairsFormed,
    coveragePercentage,
    neverPairedCount: Math.max(0, totalPossiblePairs - uniquePairsFormed),
    partnerMatrix: partnerCount,
  };
}

/**
 * Calculates opponent matchup coverage across active players.
 * Measures how many unique opponent pairings have played against each other.
 */
export function getMatchupCoverage(
  players: Player[],
  rounds: Round[]
): MatchupCoverage {
  const active = players.filter((p) => p.active);
  const totalPossibleMatchups =
    active.length > 1 ? (active.length * (active.length - 1)) / 2 : 0;
  const { opponentCount } = getHistoryMatrices(rounds);

  let uniqueMatchupsFormed = 0;
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if ((opponentCount[active[i].id]?.[active[j].id] || 0) > 0) {
        uniqueMatchupsFormed++;
      }
    }
  }

  const coveragePercentage =
    totalPossibleMatchups > 0
      ? Math.round((uniqueMatchupsFormed / totalPossibleMatchups) * 100)
      : 100;

  return {
    totalPossibleMatchups,
    uniqueMatchupsFormed,
    coveragePercentage,
    neverFacedCount: Math.max(0, totalPossibleMatchups - uniqueMatchupsFormed),
    opponentMatrix: opponentCount,
  };
}

/**
 * Calculates head-to-head match records (wins, losses, ties, points)
 * between each player and all opponent players based on completed matches.
 */
export function getHeadToHeadRecords(
  players: Player[],
  rounds: Round[]
): Record<string, Record<string, HeadToHeadRecord>> {
  const records: Record<string, Record<string, HeadToHeadRecord>> = {};

  // Initialize for all active and registered players
  players.forEach((p1) => {
    records[p1.id] = {};
    players.forEach((p2) => {
      if (p1.id !== p2.id) {
        records[p1.id][p2.id] = {
          opponentId: p2.id,
          timesFaced: 0,
          completedMatches: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          pointDiff: 0,
          winRate: 0,
        };
      }
    });
  });

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      const t1 = match.team1.playerIds || [];
      const t2 = match.team2.playerIds || [];

      for (const p1 of t1) {
        for (const p2 of t2) {
          if (!records[p1]) records[p1] = {};
          if (!records[p1][p2]) {
            records[p1][p2] = {
              opponentId: p2,
              timesFaced: 0,
              completedMatches: 0,
              wins: 0,
              losses: 0,
              ties: 0,
              pointsFor: 0,
              pointsAgainst: 0,
              pointDiff: 0,
              winRate: 0,
            };
          }
          if (!records[p2]) records[p2] = {};
          if (!records[p2][p1]) {
            records[p2][p1] = {
              opponentId: p1,
              timesFaced: 0,
              completedMatches: 0,
              wins: 0,
              losses: 0,
              ties: 0,
              pointsFor: 0,
              pointsAgainst: 0,
              pointDiff: 0,
              winRate: 0,
            };
          }

          records[p1][p2].timesFaced += 1;
          records[p2][p1].timesFaced += 1;

          if (match.completed) {
            records[p1][p2].completedMatches += 1;
            records[p2][p1].completedMatches += 1;

            records[p1][p2].pointsFor += match.score1;
            records[p1][p2].pointsAgainst += match.score2;
            records[p2][p1].pointsFor += match.score2;
            records[p2][p1].pointsAgainst += match.score1;

            if (match.score1 > match.score2) {
              records[p1][p2].wins += 1;
              records[p2][p1].losses += 1;
            } else if (match.score2 > match.score1) {
              records[p1][p2].losses += 1;
              records[p2][p1].wins += 1;
            } else {
              records[p1][p2].ties += 1;
              records[p2][p1].ties += 1;
            }
          }
        }
      }
    });
  });

  // Calculate net point diff and win rate
  Object.keys(records).forEach((p1) => {
    Object.keys(records[p1]).forEach((p2) => {
      const rec = records[p1][p2];
      rec.pointDiff = rec.pointsFor - rec.pointsAgainst;
      const totalDecided = rec.wins + rec.losses;
      rec.winRate = totalDecided > 0 ? Math.round((rec.wins / totalDecided) * 100) : 0;
    });
  });

  return records;
}

/**
 * Calculates head-to-head match statistics between two 2-player teams (Team 1 vs Team 2).
 * Allows players to pick 2 vs 2 to inspect their match up standings (wins, losses, ties, points, history).
 */
export function getTeamVsTeamRecord(
  team1Ids: [string, string],
  team2Ids: [string, string],
  rounds: Round[]
): TeamVsTeamRecord {
  const [a1, a2] = team1Ids;
  const [b1, b2] = team2Ids;

  let timesFaced = 0;
  let completedMatches = 0;
  let team1Wins = 0;
  let team2Wins = 0;
  let draws = 0;
  let team1Points = 0;
  let team2Points = 0;
  const matches: TeamMatchInstance[] = [];

  // If IDs are missing or invalid
  if (!a1 || !a2 || !b1 || !b2 || a1 === a2 || b1 === b2) {
    return {
      team1Ids,
      team2Ids,
      timesFaced: 0,
      completedMatches: 0,
      team1Wins: 0,
      team2Wins: 0,
      draws: 0,
      team1Points: 0,
      team2Points: 0,
      pointDiff: 0,
      winRateTeam1: 0,
      winRateTeam2: 0,
      matches: [],
    };
  }

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      const t1 = match.team1.playerIds || [];
      const t2 = match.team2.playerIds || [];

      const t1HasA = t1.includes(a1) && t1.includes(a2);
      const t2HasA = t2.includes(a1) && t2.includes(a2);
      const t1HasB = t1.includes(b1) && t1.includes(b2);
      const t2HasB = t2.includes(b1) && t2.includes(b2);

      // Case 1: Match team1 is Team 1, Match team2 is Team 2
      if (t1HasA && t2HasB) {
        timesFaced++;
        team1Points += match.score1 || 0;
        team2Points += match.score2 || 0;

        let winner: 1 | 2 | 'draw' = 'draw';
        if (match.completed) {
          completedMatches++;
          if (match.score1 > match.score2) {
            team1Wins++;
            winner = 1;
          } else if (match.score2 > match.score1) {
            team2Wins++;
            winner = 2;
          } else {
            draws++;
            winner = 'draw';
          }
        }

        matches.push({
          matchId: match.id,
          roundNumber: match.roundNumber,
          courtNumber: match.courtNumber,
          team1PlayerIds: t1,
          team2PlayerIds: t2,
          score1: match.score1,
          score2: match.score2,
          completed: match.completed,
          winner,
        });
      }
      // Case 2: Match team2 is Team 1, Match team1 is Team 2
      else if (t2HasA && t1HasB) {
        timesFaced++;
        team1Points += match.score2 || 0;
        team2Points += match.score1 || 0;

        let winner: 1 | 2 | 'draw' = 'draw';
        if (match.completed) {
          completedMatches++;
          if (match.score2 > match.score1) {
            team1Wins++;
            winner = 1;
          } else if (match.score1 > match.score2) {
            team2Wins++;
            winner = 2;
          } else {
            draws++;
            winner = 'draw';
          }
        }

        matches.push({
          matchId: match.id,
          roundNumber: match.roundNumber,
          courtNumber: match.courtNumber,
          team1PlayerIds: t2,
          team2PlayerIds: t1,
          score1: match.score2,
          score2: match.score1,
          completed: match.completed,
          winner,
        });
      }
    });
  });

  const totalDecided = team1Wins + team2Wins;
  const winRateTeam1 = totalDecided > 0 ? Math.round((team1Wins / totalDecided) * 100) : 0;
  const winRateTeam2 = totalDecided > 0 ? Math.round((team2Wins / totalDecided) * 100) : 0;

  return {
    team1Ids,
    team2Ids,
    timesFaced,
    completedMatches,
    team1Wins,
    team2Wins,
    draws,
    team1Points,
    team2Points,
    pointDiff: team1Points - team2Points,
    winRateTeam1,
    winRateTeam2,
    matches,
  };
}

export interface PastTeamMatchupOption {
  key: string;
  roundNumber: number;
  courtNumber: number;
  team1Ids: [string, string];
  team2Ids: [string, string];
  score1: number;
  score2: number;
  completed: boolean;
}

/**
 * Returns distinct 2v2 matchups that have occurred across all rounds for quick selection.
 */
export function getPastTeamMatchups(rounds: Round[]): PastTeamMatchupOption[] {
  const list: PastTeamMatchupOption[] = [];
  const seen = new Set<string>();

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      const t1 = match.team1.playerIds || [];
      const t2 = match.team2.playerIds || [];
      if (t1.length >= 2 && t2.length >= 2) {
        const p1 = t1[0];
        const p2 = t1[1];
        const p3 = t2[0];
        const p4 = t2[1];
        const keyA = [p1, p2].sort().join(',');
        const keyB = [p3, p4].sort().join(',');
        const comboKey = [keyA, keyB].sort().join('_vs_');
        if (!seen.has(comboKey)) {
          seen.add(comboKey);
          list.push({
            key: comboKey,
            roundNumber: match.roundNumber,
            courtNumber: match.courtNumber,
            team1Ids: [p1, p2],
            team2Ids: [p3, p4],
            score1: match.score1,
            score2: match.score2,
            completed: match.completed,
          });
        }
      }
    });
  });

  return list;
}

export interface OptimizedCourtMatch {
  courtNumber: number;
  team1: string[];
  team2: string[];
}

/**
 * Optimizes court matches and team lineups so players who have NOT paired together
 * (partnerCount === 0) are strictly prioritized to play together as teammates,
 * while heavily penalizing repeat partnerships.
 */
export function optimizeCourtAndTeamPairings({
  selectedPlayers,
  courtsCount,
  playersPerTeam,
  rounds,
}: {
  selectedPlayers: Player[];
  courtsCount: number;
  playersPerTeam: number;
  rounds: Round[];
}): OptimizedCourtMatch[] {
  if (selectedPlayers.length === 0 || courtsCount === 0) {
    return [];
  }

  const { partnerCount, opponentCount } = getHistoryMatrices(rounds);
  const playersPerMatch = playersPerTeam * 2;
  const maxMatches = Math.floor(selectedPlayers.length / playersPerMatch);
  const courtsToUse = Math.min(courtsCount, maxMatches);

  if (courtsToUse === 0) return [];

  // Map locked duos among currently selected players
  const duoPartnerMap = new Map<string, string>();
  selectedPlayers.forEach((p) => {
    if (p.duoPartnerId && selectedPlayers.some((sp) => sp.id === p.duoPartnerId)) {
      duoPartnerMap.set(p.id, p.duoPartnerId);
    }
  });

  // Teammate partner penalty:
  // - Locked Duo together = massive bonus (-1,000,000 pts)
  // - Locked Duo split = massive penalty (+10,000,000 pts, strictly forbidden)
  // - 0 matches together = 0 penalty (brand-new partnership, top priority!)
  // - 1 match together = 200 penalty
  // - 2+ matches together = 500 * (count^2) penalty
  const getTeamPartnerPenalty = (teamIds: string[]): number => {
    let penalty = 0;

    // Duo integrity check:
    for (const pid of teamIds) {
      const lockedPartnerId = duoPartnerMap.get(pid);
      if (lockedPartnerId) {
        if (teamIds.includes(lockedPartnerId)) {
          penalty -= 1000000; // Locked Duo successfully placed together!
        } else {
          penalty += 10000000; // Strictly forbidden: separating locked partners
        }
      }
    }

    for (let i = 0; i < teamIds.length; i++) {
      for (let j = i + 1; j < teamIds.length; j++) {
        const times = partnerCount[teamIds[i]]?.[teamIds[j]] || 0;
        if (times > 0) {
          penalty += 200 + times * times * 300;
        }
      }
    }
    return penalty;
  };

  // Court opponent rematch penalty
  const getMatchOpponentPenalty = (t1Ids: string[], t2Ids: string[]): number => {
    let penalty = 0;
    for (const p1 of t1Ids) {
      for (const p2 of t2Ids) {
        const times = opponentCount[p1]?.[p2] || 0;
        penalty += times * 10;
      }
    }
    return penalty;
  };

  // Case 1: Singles (1 player per team)
  // There are no teammates; prioritize players who haven't played against each other
  if (playersPerTeam === 1) {
    const playerIds = shuffleArray(selectedPlayers.slice(0, courtsToUse * 2).map((p) => p.id));
    const pairs: [string, string][] = [];
    const available = new Set(playerIds);

    while (available.size >= 2) {
      const p1 = Array.from(available)[0];
      available.delete(p1);

      let bestP2 = '';
      let lowestOppCount = Infinity;

      for (const cand of Array.from(available)) {
        const count = opponentCount[p1]?.[cand] || 0;
        if (count < lowestOppCount) {
          lowestOppCount = count;
          bestP2 = cand;
        }
      }

      available.delete(bestP2);
      pairs.push([p1, bestP2]);
    }

    return pairs.slice(0, courtsToUse).map((pair, idx) => ({
      courtNumber: idx + 1,
      team1: [pair[0]],
      team2: [pair[1]],
    }));
  }

  // Case 2: Standard Doubles (2 players per team - pickleball, badminton, tennis doubles, padel)
  if (playersPerTeam === 2) {
    const totalNeeded = courtsToUse * 4;
    const playerIds = shuffleArray(selectedPlayers.slice(0, totalNeeded).map((p) => p.id));

    // 1 Court (4 players: a, b, c, d) -> exactly 3 options
    if (courtsToUse === 1 && playerIds.length >= 4) {
      const [a, b, c, d] = playerIds;
      const options = shuffleArray([
        { t1: [a, b], t2: [c, d] },
        { t1: [a, c], t2: [b, d] },
        { t1: [a, d], t2: [b, c] },
      ]);

      let bestOption = options[0];
      let lowestScore = Infinity;

      for (const opt of options) {
        const partnerCost =
          getTeamPartnerPenalty(opt.t1) + getTeamPartnerPenalty(opt.t2);
        const oppCost = getMatchOpponentPenalty(opt.t1, opt.t2);
        const totalCost = partnerCost + oppCost;
        if (totalCost < lowestScore) {
          lowestScore = totalCost;
          bestOption = opt;
        }
      }

      return [
        {
          courtNumber: 1,
          team1: bestOption.t1,
          team2: bestOption.t2,
        },
      ];
    }

    // 2 Courts (8 players) -> evaluate all 105 partitions into 4 pairs
    if (courtsToUse === 2 && playerIds.length >= 8) {
      const generatePairPartitions = (items: string[]): string[][][] => {
        if (items.length === 0) return [[]];
        const first = items[0];
        const rest = items.slice(1);
        const partitions: string[][][] = [];

        for (let i = 0; i < rest.length; i++) {
          const partner = rest[i];
          const remaining = rest.filter((_, idx) => idx !== i);
          const subPartitions = generatePairPartitions(remaining);
          for (const sp of subPartitions) {
            partitions.push([[first, partner], ...sp]);
          }
        }
        return partitions;
      };

      const allPartitions = shuffleArray(generatePairPartitions(playerIds));
      let bestCourtAssignment: OptimizedCourtMatch[] = [];
      let lowestGlobalCost = Infinity;

      for (const partition of allPartitions) {
        const partnerPenalty = partition.reduce(
          (sum, pair) => sum + getTeamPartnerPenalty(pair),
          0
        );

        // Assign 4 pairs into Court 1 and Court 2
        const courtPairings = shuffleArray([
          { c1: [partition[0], partition[1]], c2: [partition[2], partition[3]] },
          { c1: [partition[0], partition[2]], c2: [partition[1], partition[3]] },
          { c1: [partition[0], partition[3]], c2: [partition[1], partition[2]] },
        ]);

        for (const cp of courtPairings) {
          const oppCost =
            getMatchOpponentPenalty(cp.c1[0], cp.c1[1]) +
            getMatchOpponentPenalty(cp.c2[0], cp.c2[1]);
          const totalCost = partnerPenalty + oppCost;

          if (totalCost < lowestGlobalCost) {
            lowestGlobalCost = totalCost;
            bestCourtAssignment = [
              { courtNumber: 1, team1: cp.c1[0], team2: cp.c1[1] },
              { courtNumber: 2, team1: cp.c2[0], team2: cp.c2[1] },
            ];
          }
        }
      }

      return bestCourtAssignment;
    }

    // 3+ Courts (12+ players) -> Greedy pair matching + 2-opt local search refinement
    const totalTeams = courtsToUse * 2;
    const candidatePairs: { pair: [string, string]; cost: number }[] = [];
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const p1 = playerIds[i];
        const p2 = playerIds[j];
        candidatePairs.push({
          pair: [p1, p2],
          cost: getTeamPartnerPenalty([p1, p2]),
        });
      }
    }
    candidatePairs.sort((a, b) => a.cost - b.cost);

    const chosenTeams: [string, string][] = [];
    const used = new Set<string>();

    for (const cp of candidatePairs) {
      if (!used.has(cp.pair[0]) && !used.has(cp.pair[1])) {
        chosenTeams.push(cp.pair);
        used.add(cp.pair[0]);
        used.add(cp.pair[1]);
        if (chosenTeams.length === totalTeams) break;
      }
    }

    const unused = playerIds.filter((id) => !used.has(id));
    while (unused.length >= 2) {
      const p1 = unused.pop()!;
      const p2 = unused.pop()!;
      chosenTeams.push([p1, p2]);
    }

    // 2-Opt local refinement (300 iterations)
    for (let iter = 0; iter < 300; iter++) {
      const idxA = Math.floor(Math.random() * chosenTeams.length);
      const idxB = Math.floor(Math.random() * chosenTeams.length);
      if (idxA === idxB) continue;

      const teamA = chosenTeams[idxA];
      const teamB = chosenTeams[idxB];
      const currentCost =
        getTeamPartnerPenalty(teamA) + getTeamPartnerPenalty(teamB);

      const altCost1 =
        getTeamPartnerPenalty([teamA[0], teamB[0]]) +
        getTeamPartnerPenalty([teamA[1], teamB[1]]);
      const altCost2 =
        getTeamPartnerPenalty([teamA[0], teamB[1]]) +
        getTeamPartnerPenalty([teamA[1], teamB[0]]);

      if (altCost1 < currentCost && altCost1 <= altCost2) {
        chosenTeams[idxA] = [teamA[0], teamB[0]];
        chosenTeams[idxB] = [teamA[1], teamB[1]];
      } else if (altCost2 < currentCost) {
        chosenTeams[idxA] = [teamA[0], teamB[1]];
        chosenTeams[idxB] = [teamA[1], teamB[0]];
      }
    }

    // Match pairs into courts minimizing opponent rematches
    const matches: OptimizedCourtMatch[] = [];
    const remainingTeams = [...chosenTeams];

    for (let c = 1; c <= courtsToUse; c++) {
      if (remainingTeams.length < 2) break;
      const t1 = remainingTeams.shift()!;
      let bestT2Idx = 0;
      let minOppCost = Infinity;

      for (let i = 0; i < remainingTeams.length; i++) {
        const oppCost = getMatchOpponentPenalty(t1, remainingTeams[i]);
        if (oppCost < minOppCost) {
          minOppCost = oppCost;
          bestT2Idx = i;
        }
      }

      const t2 = remainingTeams.splice(bestT2Idx, 1)[0];
      matches.push({
        courtNumber: c,
        team1: t1,
        team2: t2,
      });
    }

    return matches;
  }

  // Case 3: Other team sizes (3v3 or 4v4)
  const totalSlots = courtsToUse * playersPerMatch;
  const playerIds = selectedPlayers.slice(0, totalSlots).map((p) => p.id);
  const matches: OptimizedCourtMatch[] = [];
  const unassigned = [...playerIds];

  for (let c = 1; c <= courtsToUse; c++) {
    const courtGroup = unassigned.splice(0, playersPerMatch);
    matches.push({
      courtNumber: c,
      team1: courtGroup.slice(0, playersPerTeam),
      team2: courtGroup.slice(playersPerTeam, playersPerMatch),
    });
  }
  return matches;
}

export interface UpcomingMatchOverrides {
  match1?: { team1: string[]; team2: string[] };
  match2?: { team1: string[]; team2: string[] };
}

/**
 * Checks if a player is currently resting on the bench waiting for their locked duo
 * partner to finish playing an active uncompleted match on court.
 */
export function isPlayerWaitingForDuoPartner(
  player: Player,
  players: Player[],
  currentRound?: Round | null
): { isWaiting: boolean; partner?: Player; courtNumber?: number } {
  if (!player.duoPartnerId || !currentRound || currentRound.completed) {
    return { isWaiting: false };
  }
  const partner = players.find((p) => p.id === player.duoPartnerId);
  if (!partner || !partner.active) {
    return { isWaiting: false };
  }

  // Check if partner is currently playing in an uncompleted court match without this player
  for (const m of currentRound.matches) {
    if (m.completed) continue;
    const inTeam1 = m.team1.playerIds.includes(partner.id);
    const inTeam2 = m.team2.playerIds.includes(partner.id);
    if (inTeam1 || inTeam2) {
      // Is player also in the exact same team?
      const playerInSameTeam =
        (inTeam1 && m.team1.playerIds.includes(player.id)) ||
        (inTeam2 && m.team2.playerIds.includes(player.id));
      if (!playerInSameTeam) {
        return { isWaiting: true, partner, courtNumber: m.courtNumber };
      }
    }
  }

  return { isWaiting: false, partner };
}

/**
 * Ensures that if any player in the candidate selection has a locked duo partner
 * available in the pool, the partner is brought in alongside them (swapping out an unlinked player).
 * If the partner cannot be brought in (e.g. partner is currently playing on court),
 * the player is removed and placed on the waiting bench, replaced by an unlinked candidate.
 */
export function ensureLockedDuosTogether(
  selected: Player[],
  availablePool: Player[],
  playersPerTeam: number
): Player[] {
  if (playersPerTeam !== 2 || selected.length < 2) return selected;
  let result = [...selected];
  let selectedIds = new Set(result.map((p) => p.id));
  const poolMap = new Map(availablePool.map((p) => [p.id, p]));

  for (const p of [...result]) {
    if (p.duoPartnerId) {
      if (selectedIds.has(p.duoPartnerId)) {
        continue;
      }
      const partner = poolMap.get(p.duoPartnerId);
      if (partner && partner.active) {
        // Find an unlinked player from the back of result to swap out
        const swapIdx = [...result].reverse().findIndex(
          (candidate) => candidate.id !== p.id && !candidate.duoPartnerId
        );
        if (swapIdx !== -1) {
          const actualIdx = result.length - 1 - swapIdx;
          const displaced = result[actualIdx];
          result[actualIdx] = partner;
          selectedIds.add(partner.id);
          selectedIds.delete(displaced.id);
        } else {
          // Cannot bring in partner without breaking another locked duo:
          // Player cannot remain alone; swap out for an unlinked candidate
          const unlinkedCand = availablePool.find(
            (c) => !c.duoPartnerId && !selectedIds.has(c.id)
          );
          if (unlinkedCand) {
            const pIdx = result.findIndex((item) => item.id === p.id);
            if (pIdx !== -1) {
              result[pIdx] = unlinkedCand;
              selectedIds.delete(p.id);
              selectedIds.add(unlinkedCand.id);
            }
          }
        }
      } else {
        // Partner is NOT available in the pool (e.g. playing on court or inactive)
        // Player CANNOT stay in this match alone; must wait on the bench for partner
        const unlinkedCand = availablePool.find(
          (c) => !c.duoPartnerId && !selectedIds.has(c.id)
        );
        if (unlinkedCand) {
          const pIdx = result.findIndex((item) => item.id === p.id);
          if (pIdx !== -1) {
            result[pIdx] = unlinkedCand;
            selectedIds.delete(p.id);
            selectedIds.add(unlinkedCand.id);
          }
        }
      }
    }
  }

  return result;
}

/**
 * Predicts who the NEXT 2 MATCHES will feature.
 * Prioritizes resting/bench players first so users always know when they play next!
 * Players whose locked partner is currently playing on court wait on the bench.
 */
export function predictNextTwoMatches(params: {
  players: Player[];
  rounds: Round[];
  playersPerTeam: number;
  courtsCount: number;
  overrides?: UpcomingMatchOverrides;
}): UpcomingMatch[] {
  const { players, rounds, playersPerTeam, overrides } = params;
  const activePlayers = players.filter((p) => p.active);
  const playersPerMatch = playersPerTeam * 2;

  if (activePlayers.length < playersPerMatch) {
    return [];
  }

  const currentRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const currentlyPlayingIds = new Set<string>();
  if (currentRound && !currentRound.completed) {
    currentRound.matches.forEach((m) => {
      if (!m.completed) {
        m.team1.playerIds.forEach((id) => currentlyPlayingIds.add(id));
        m.team2.playerIds.forEach((id) => currentlyPlayingIds.add(id));
      }
    });
  }

  // Players waiting on bench for their locked partner to finish court play are excluded from upcoming queue
  const waitingForPartnerIds = new Set<string>();
  activePlayers.forEach((p) => {
    if (p.duoPartnerId && currentlyPlayingIds.has(p.duoPartnerId)) {
      waitingForPartnerIds.add(p.id);
    }
  });

  const eligiblePlayers = activePlayers.filter((p) => !waitingForPartnerIds.has(p.id));
  const matchCounts = getPlayerMatchCounts(activePlayers, rounds, true);
  const benchStreaks = getConsecutiveBenchRounds(activePlayers, rounds, true);
  const playStreaks = getConsecutivePlayRounds(activePlayers, rounds, true);

  // Calculate projected play streaks & projected match counts including the currently active round
  const projectedPlayStreaks: Record<string, number> = {};
  const projectedMatchCounts: Record<string, number> = {};
  activePlayers.forEach((p) => {
    if (currentlyPlayingIds.has(p.id)) {
      projectedPlayStreaks[p.id] = (playStreaks[p.id] || 0) + 1;
      projectedMatchCounts[p.id] = (matchCounts[p.id] || 0) + 1;
    } else {
      projectedPlayStreaks[p.id] = 0;
      projectedMatchCounts[p.id] = matchCounts[p.id] || 0;
    }
  });

  const result: UpcomingMatch[] = [];

  // Match #1: Next Match (On Deck)
  if (overrides?.match1?.team1?.length && overrides?.match1?.team2?.length) {
    result.push({
      matchNumber: 1,
      team1PlayerIds: overrides.match1.team1,
      team2PlayerIds: overrides.match1.team2,
      isOverridden: true,
      courtNumber: 1,
    });
  } else {
    const selectedM1 = selectOptimalCandidatesForMatch({
      pool: eligiblePlayers,
      neededSlots: playersPerMatch,
      rounds,
      matchCounts: projectedMatchCounts,
      playStreaks: projectedPlayStreaks,
      benchStreaks,
      playersPerTeam,
      previousRoundPlayerIds: currentlyPlayingIds,
    });

    if (selectedM1.length >= playersPerMatch) {
      const optimized = optimizeCourtAndTeamPairings({
        selectedPlayers: selectedM1,
        courtsCount: 1,
        playersPerTeam,
        rounds,
      });
      const t1 =
        optimized[0]?.team1 ||
        selectedM1.slice(0, playersPerTeam).map((p) => p.id);
      const t2 =
        optimized[0]?.team2 ||
        selectedM1.slice(playersPerTeam, playersPerMatch).map((p) => p.id);

      result.push({
        matchNumber: 1,
        team1PlayerIds: t1,
        team2PlayerIds: t2,
        isOverridden: false,
        courtNumber: 1,
      });
    }
  }

  // Match #2: Following Match (In The Hole)
  if (overrides?.match2?.team1?.length && overrides?.match2?.team2?.length) {
    result.push({
      matchNumber: 2,
      team1PlayerIds: overrides.match2.team1,
      team2PlayerIds: overrides.match2.team2,
      isOverridden: true,
      courtNumber: 2,
    });
  } else if (result[0] && activePlayers.length >= playersPerMatch) {
    const match1Ids = new Set<string>([
      ...result[0].team1PlayerIds,
      ...result[0].team2PlayerIds,
    ]);

    const projectedPlayStreaksForMatch2: Record<string, number> = {};
    const projectedCountsForMatch2: Record<string, number> = {};

    activePlayers.forEach((p) => {
      const isPlayingCurrent = currentlyPlayingIds.has(p.id);
      const isPlayingMatch1 = match1Ids.has(p.id);

      projectedCountsForMatch2[p.id] =
        (matchCounts[p.id] || 0) + (isPlayingCurrent ? 1 : 0) + (isPlayingMatch1 ? 1 : 0);

      if (isPlayingMatch1) {
        projectedPlayStreaksForMatch2[p.id] = isPlayingCurrent
          ? (playStreaks[p.id] || 0) + 2
          : 1;
      } else {
        projectedPlayStreaksForMatch2[p.id] = 0;
      }
    });

    const selectedM2 = selectOptimalCandidatesForMatch({
      pool: eligiblePlayers,
      neededSlots: playersPerMatch,
      rounds,
      matchCounts: projectedCountsForMatch2,
      playStreaks: projectedPlayStreaksForMatch2,
      benchStreaks,
      playersPerTeam,
      previousRoundPlayerIds: match1Ids,
    });

    if (selectedM2.length >= playersPerMatch) {
      const optimized = optimizeCourtAndTeamPairings({
        selectedPlayers: selectedM2,
        courtsCount: 1,
        playersPerTeam,
        rounds,
      });
      const t1 =
        optimized[0]?.team1 ||
        selectedM2.slice(0, playersPerTeam).map((p) => p.id);
      const t2 =
        optimized[0]?.team2 ||
        selectedM2.slice(playersPerTeam, playersPerMatch).map((p) => p.id);

      result.push({
        matchNumber: 2,
        team1PlayerIds: t1,
        team2PlayerIds: t2,
        isOverridden: false,
        courtNumber: 2,
      });
    }
  }

  return result;
}

/**
 * Returns active players sorted by strict fair queue priority:
 * 1. Matches played ASCENDING (least matches played first)
 * 2. Bench streak DESCENDING (longest rest plays first)
 * 3. Last played round ASCENDING (played furthest in past)
 * 4. Partner with preferred partner tie-breaker (prioritize 0-match partners)
 * 5. Joined round ASCENDING (earlier joiners first)
 */
export function getPrioritizedAvailablePlayers(
  players: Player[],
  rounds: Round[],
  excludePlayerIds: Set<string> = new Set(),
  preferredPartnerWithId?: string
): Player[] {
  let activePlayers = players.filter((p) => p.active && !excludePlayerIds.has(p.id));
  if (activePlayers.length === 0) return [];

  // When finding a single substitute, prefer players who are NOT in a locked duo,
  // unless this substitute is specifically pairing with their locked partner.
  const unlinkedPlayers = activePlayers.filter(
    (p) => !p.duoPartnerId || (preferredPartnerWithId && p.duoPartnerId === preferredPartnerWithId)
  );
  if (unlinkedPlayers.length > 0) {
    activePlayers = unlinkedPlayers;
  }

  const matchCounts = getPlayerMatchCounts(activePlayers, rounds);
  const benchStreaks = getConsecutiveBenchRounds(activePlayers, rounds);
  const lastPlayed = getLastPlayedRound(activePlayers, rounds);
  const { partnerCount } = getHistoryMatrices(rounds);

  return [...activePlayers].sort((a, b) => {
    const matchesA = matchCounts[a.id] || 0;
    const matchesB = matchCounts[b.id] || 0;
    if (matchesA !== matchesB) {
      return matchesA - matchesB;
    }

    if (preferredPartnerWithId) {
      const pCountA = partnerCount[a.id]?.[preferredPartnerWithId] || 0;
      const pCountB = partnerCount[b.id]?.[preferredPartnerWithId] || 0;
      if (pCountA !== pCountB) {
        return pCountA - pCountB; // 0 first!
      }
    }

    const unpartneredA = getUnpairedPartnersCount(a.id, activePlayers, rounds);
    const unpartneredB = getUnpairedPartnersCount(b.id, activePlayers, rounds);
    const unfacedA = getUnfacedOpponentsCount(a.id, activePlayers, rounds);
    const unfacedB = getUnfacedOpponentsCount(b.id, activePlayers, rounds);
    const varietyA = unpartneredA * 2 + unfacedA;
    const varietyB = unpartneredB * 2 + unfacedB;
    if (varietyA !== varietyB) {
      return varietyB - varietyA;
    }

    const streakA = benchStreaks[a.id] || 0;
    const streakB = benchStreaks[b.id] || 0;
    if (streakA !== streakB) {
      return streakB - streakA;
    }

    const lastA = lastPlayed[a.id] || 0;
    const lastB = lastPlayed[b.id] || 0;
    if (lastA !== lastB) {
      return lastA - lastB;
    }

    // Late joiners get priority over earlier joiners to help them catch up
    const jrA = a.joinedAtRound || 1;
    const jrB = b.joinedAtRound || 1;
    if (jrA !== jrB) {
      return jrB - jrA;
    }

    return 0;
  });
}

export interface ReplacementEvent {
  targetPlayerId: string;
  targetPlayerName?: string;
  replacementPlayer?: Player;
  courtNumber: number;
  teamNumber: 1 | 2;
  matchId: string;
}

/**
 * Automatically replaces a player who was benched or deleted in an uncompleted round
 * with the highest-priority available bench player.
 * Prioritizes a partner who has NOT paired with the remaining teammate yet!
 */
export function autoReplacePlayerInRound({
  round,
  targetPlayerId,
  players,
  rounds,
  targetPlayerName,
}: {
  round: Round;
  targetPlayerId: string;
  players: Player[];
  rounds: Round[];
  targetPlayerName?: string;
}): {
  updatedRound: Round;
  replacementEvent?: ReplacementEvent;
  replaced: boolean;
} {
  // Find match where targetPlayer is playing
  let foundCourtNumber = 0;
  let foundTeamNumber: 1 | 2 = 1;
  let foundMatchId = '';
  let remainingTeammateId: string | undefined;

  for (const m of round.matches) {
    if (m.completed) continue;
    if (m.team1.playerIds.includes(targetPlayerId)) {
      foundCourtNumber = m.courtNumber;
      foundTeamNumber = 1;
      foundMatchId = m.id;
      remainingTeammateId = m.team1.playerIds.find((id) => id !== targetPlayerId);
      break;
    }
    if (m.team2.playerIds.includes(targetPlayerId)) {
      foundCourtNumber = m.courtNumber;
      foundTeamNumber = 2;
      foundMatchId = m.id;
      remainingTeammateId = m.team2.playerIds.find((id) => id !== targetPlayerId);
      break;
    }
  }

  // If player wasn't in an active match, update resting list if needed
  if (!foundMatchId) {
    const activeResting = players
      .filter((p) => p.active && p.id !== targetPlayerId)
      .filter((p) => {
        const isPlaying = round.matches.some(
          (m) => m.team1.playerIds.includes(p.id) || m.team2.playerIds.includes(p.id)
        );
        return !isPlaying;
      })
      .map((p) => p.id);

    return {
      updatedRound: {
        ...round,
        restingPlayerIds: activeResting,
      },
      replaced: false,
    };
  }

  // Collect all players currently assigned to ANY match in this round (excluding the slot being replaced)
  const currentlyPlayingIds = new Set<string>();
  round.matches.forEach((m) => {
    m.team1.playerIds.forEach((id) => {
      if (id !== targetPlayerId) currentlyPlayingIds.add(id);
    });
    m.team2.playerIds.forEach((id) => {
      if (id !== targetPlayerId) currentlyPlayingIds.add(id);
    });
  });

  // Find highest prioritized active player, preferring one who has NOT yet paired with remaining teammate!
  const prioritizedCandidates = getPrioritizedAvailablePlayers(
    players,
    rounds,
    currentlyPlayingIds,
    remainingTeammateId
  );
  const eligible = prioritizedCandidates.filter((p) => p.id !== targetPlayerId);
  let replacementPlayer = eligible[0];

  if (!replacementPlayer) {
    // If no resting players available (continuous rotation), pull an eligible filler
    const regen = regeneratePendingMatchWithFiller({
      round,
      matchId: foundMatchId,
      droppedPlayerId: targetPlayerId,
      players,
      rounds,
    });
    if (regen.replacementPlayerId) {
      const fillerP = players.find((p) => p.id === regen.replacementPlayerId);
      return {
        updatedRound: regen.updatedRound,
        replacementEvent: {
          targetPlayerId,
          targetPlayerName: targetPlayerName || 'Player',
          replacementPlayer: fillerP,
          courtNumber: foundCourtNumber,
          teamNumber: foundTeamNumber,
          matchId: foundMatchId,
        },
        replaced: true,
      };
    }
  }

  const updatedMatches = round.matches.map((m) => {
    if (m.id !== foundMatchId) return m;

    const replaceId = (id: string) => {
      if (id === targetPlayerId) {
        return replacementPlayer ? replacementPlayer.id : null;
      }
      return id;
    };

    const newTeam1 = m.team1.playerIds
      .map(replaceId)
      .filter((id): id is string => id !== null);

    const newTeam2 = m.team2.playerIds
      .map(replaceId)
      .filter((id): id is string => id !== null);

    return {
      ...m,
      team1: { playerIds: newTeam1 },
      team2: { playerIds: newTeam2 },
    };
  });

  // Re-calculate playing IDs
  const newPlayingIds = new Set<string>();
  updatedMatches.forEach((m) => {
    m.team1.playerIds.forEach((id) => newPlayingIds.add(id));
    m.team2.playerIds.forEach((id) => newPlayingIds.add(id));
  });

  // Resting players are active players not playing on court
  const newResting = players
    .filter((p) => p.active && !newPlayingIds.has(p.id))
    .map((p) => p.id);

  return {
    updatedRound: {
      ...round,
      matches: updatedMatches,
      restingPlayerIds: newResting,
    },
    replacementEvent: {
      targetPlayerId,
      targetPlayerName,
      replacementPlayer,
      courtNumber: foundCourtNumber,
      teamNumber: foundTeamNumber,
      matchId: foundMatchId,
    },
    replaced: true,
  };
}

/**
 * Explicitly benches a player from an active match on court and immediately
 * replaces them with the highest-priority player from the bench.
 */
export function benchAndReplacePlayerInMatch({
  round,
  matchId,
  playerToBenchId,
  players,
  rounds,
}: {
  round: Round;
  matchId: string;
  playerToBenchId: string;
  players: Player[];
  rounds: Round[];
}): {
  updatedRound: Round;
  replacementPlayer?: Player;
  replaced: boolean;
} {
  const player = players.find((p) => p.id === playerToBenchId);
  const result = autoReplacePlayerInRound({
    round,
    targetPlayerId: playerToBenchId,
    players,
    rounds,
    targetPlayerName: player?.name,
  });

  return {
    updatedRound: result.updatedRound,
    replacementPlayer: result.replacementEvent?.replacementPlayer,
    replaced: result.replaced,
  };
}

/**
 * Automatically cleans up upcoming match overrides if a player is deleted or benched.
 */
export function sanitizeUpcomingOverrides(
  overrides: UpcomingMatchOverrides,
  activePlayers: Player[],
  rounds: Round[]
): UpcomingMatchOverrides {
  const activeIds = new Set(activePlayers.filter((p) => p.active).map((p) => p.id));
  const newOverrides = { ...overrides };

  ['match1', 'match2'].forEach((key) => {
    const matchKey = key as 'match1' | 'match2';
    const match = newOverrides[matchKey];
    if (!match) return;

    const assigned = new Set<string>();
    const replaceInvalid = (id: string) => {
      if (activeIds.has(id) && !assigned.has(id)) {
        assigned.add(id);
        return id;
      }
      // Need replacement
      const priority = getPrioritizedAvailablePlayers(activePlayers, rounds, assigned);
      const replacement = priority[0];
      if (replacement) {
        assigned.add(replacement.id);
        return replacement.id;
      }
      return null;
    };

    const newTeam1 = match.team1.map(replaceInvalid).filter((id): id is string => id !== null);
    const newTeam2 = match.team2.map(replaceInvalid).filter((id): id is string => id !== null);

    newOverrides[matchKey] = {
      team1: newTeam1,
      team2: newTeam2,
    };
  });

  return newOverrides;
}

export interface UpcomingReplacementEvent {
  targetPlayerId: string;
  targetPlayerName?: string;
  replacementPlayer?: Player;
  matchNumber: 1 | 2;
  matchLabel: string;
  teamNumber: 1 | 2;
}

/**
 * Replaces an inactive or deleted player in the upcoming matches (On-Deck & In-The-Hole)
 * with the highest-priority active bench player, leaving all other scheduled players intact.
 * Replacement ONLY occurs if the target player is in upcoming matches and has quit, been removed, or paused/benched.
 */
export function replacePlayerInUpcomingMatches({
  upcomingMatches,
  targetPlayerId,
  players,
  rounds,
  targetPlayerName,
  currentlyPlayingCourtPlayerIds = new Set<string>(),
}: {
  upcomingMatches: UpcomingMatch[];
  targetPlayerId: string;
  players: Player[];
  rounds: Round[];
  targetPlayerName?: string;
  currentlyPlayingCourtPlayerIds?: Set<string>;
}): {
  updatedUpcoming: UpcomingMatch[];
  replacementEvents: UpcomingReplacementEvent[];
} {
  const replacementEvents: UpcomingReplacementEvent[] = [];
  const activePlayers = players.filter((p) => p.active && p.id !== targetPlayerId);

  // Collect all assigned IDs (currently playing on court + other upcoming slots)
  const assignedIds = new Set<string>(currentlyPlayingCourtPlayerIds);
  upcomingMatches.forEach((m) => {
    m.team1PlayerIds.forEach((id) => {
      if (id !== targetPlayerId) assignedIds.add(id);
    });
    m.team2PlayerIds.forEach((id) => {
      if (id !== targetPlayerId) assignedIds.add(id);
    });
  });

  const updatedUpcoming = upcomingMatches.map((match) => {
    const hasInTeam1 = match.team1PlayerIds.includes(targetPlayerId);
    const hasInTeam2 = match.team2PlayerIds.includes(targetPlayerId);

    if (!hasInTeam1 && !hasInTeam2) {
      return match;
    }

    let teamNumber: 1 | 2 = 1;
    let partnerId: string | undefined;
    if (hasInTeam1) {
      teamNumber = 1;
      partnerId = match.team1PlayerIds.find((id) => id !== targetPlayerId);
    } else {
      teamNumber = 2;
      partnerId = match.team2PlayerIds.find((id) => id !== targetPlayerId);
    }

    // Find replacement from bench not already assigned
    const candidates = getPrioritizedAvailablePlayers(activePlayers, rounds, assignedIds, partnerId);
    const replacementPlayer = candidates[0];

    if (replacementPlayer) {
      assignedIds.add(replacementPlayer.id);
    }

    const replaceId = (id: string) => {
      if (id === targetPlayerId) {
        return replacementPlayer ? replacementPlayer.id : null;
      }
      return id;
    };

    const newTeam1 = match.team1PlayerIds.map(replaceId).filter((id): id is string => id !== null);
    const newTeam2 = match.team2PlayerIds.map(replaceId).filter((id): id is string => id !== null);

    const matchLabel = match.matchNumber === 1 ? 'On-Deck (Match 1)' : 'In The Hole (Match 2)';
    replacementEvents.push({
      targetPlayerId,
      targetPlayerName,
      replacementPlayer,
      matchNumber: match.matchNumber,
      matchLabel,
      teamNumber,
    });

    return {
      ...match,
      team1PlayerIds: newTeam1,
      team2PlayerIds: newTeam2,
    };
  });

  return {
    updatedUpcoming,
    replacementEvents,
  };
}

/**
 * Unites any available locked duo (neither partner currently playing on court)
 * into On-Deck (Match 1) or In-The-Hole (Match 2) as teammates, ensuring they are
 * never separated in the queue.
 */
export function uniteAvailableDuosInUpcomingMatches({
  upcomingMatches,
  players,
  rounds,
  courtsCount,
  playersPerTeam,
}: {
  upcomingMatches: UpcomingMatch[];
  players: Player[];
  rounds: Round[];
  courtsCount: number;
  playersPerTeam: number;
}): {
  updatedUpcoming: UpcomingMatch[];
  unitedDuos: Array<{ p1: Player; p2: Player; matchLabel: string }>;
} {
  if (playersPerTeam !== 2 || upcomingMatches.length === 0) {
    return { updatedUpcoming: upcomingMatches, unitedDuos: [] };
  }

  const currentRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const currentlyPlayingIds = new Set<string>();
  if (currentRound && !currentRound.completed) {
    currentRound.matches.forEach((m) => {
      if (!m.completed) {
        m.team1.playerIds.forEach((id) => currentlyPlayingIds.add(id));
        m.team2.playerIds.forEach((id) => currentlyPlayingIds.add(id));
      }
    });
  }

  const activePlayers = players.filter((p) => p.active);
  const playersMap = new Map(players.map((p) => [p.id, p]));

  // Find all distinct active locked duos
  const duos: Array<[Player, Player]> = [];
  const visited = new Set<string>();
  for (const p of activePlayers) {
    if (p.duoPartnerId && !visited.has(p.id)) {
      const partner = activePlayers.find((other) => other.id === p.duoPartnerId);
      if (partner && partner.active) {
        visited.add(p.id);
        visited.add(partner.id);
        duos.push([p, partner]);
      }
    }
  }

  let matches = upcomingMatches.map((m) => ({
    ...m,
    team1PlayerIds: [...m.team1PlayerIds],
    team2PlayerIds: [...m.team2PlayerIds],
  }));

  const unitedDuos: Array<{ p1: Player; p2: Player; matchLabel: string }> = [];

  for (const [p1, p2] of duos) {
    // If either partner is currently playing on court, they wait on the bench until court play ends!
    if (currentlyPlayingIds.has(p1.id) || currentlyPlayingIds.has(p2.id)) {
      // Also ensure neither partner is lingering alone in upcoming matches
      matches = matches.map((m) => ({
        ...m,
        team1PlayerIds: m.team1PlayerIds.filter((id) => id !== p1.id && id !== p2.id),
        team2PlayerIds: m.team2PlayerIds.filter((id) => id !== p1.id && id !== p2.id),
      }));
      continue;
    }

    // Check if already paired together on the same team in Match 1 or Match 2
    const alreadyTogether = matches.some(
      (m) =>
        (m.team1PlayerIds.includes(p1.id) && m.team1PlayerIds.includes(p2.id)) ||
        (m.team2PlayerIds.includes(p1.id) && m.team2PlayerIds.includes(p2.id))
    );
    if (alreadyTogether) continue;

    // Remove any lone occurrence of p1 or p2 across upcoming matches to re-seat them together
    matches = matches.map((m) => ({
      ...m,
      team1PlayerIds: m.team1PlayerIds.filter((id) => id !== p1.id && id !== p2.id),
      team2PlayerIds: m.team2PlayerIds.filter((id) => id !== p1.id && id !== p2.id),
    }));

    // Target match: preference In-The-Hole (Match 2) if it exists, or On-Deck (Match 1)
    const targetIdx = matches.length > 1 ? 1 : 0;
    const targetMatch = matches[targetIdx];
    if (!targetMatch) continue;

    const matchLabel = targetMatch.matchNumber === 1 ? 'On-Deck (Match 1)' : 'In-The-Hole (Match 2)';

    // Find a team in targetMatch that has room or is made of unlinked players
    const isTeam2Unlinked = targetMatch.team2PlayerIds.every(
      (id) => !playersMap.get(id)?.duoPartnerId
    );
    const isTeam1Unlinked = targetMatch.team1PlayerIds.every(
      (id) => !playersMap.get(id)?.duoPartnerId
    );

    if (isTeam2Unlinked) {
      targetMatch.team2PlayerIds = [p1.id, p2.id];
      unitedDuos.push({ p1, p2, matchLabel });
    } else if (isTeam1Unlinked) {
      targetMatch.team1PlayerIds = [p1.id, p2.id];
      unitedDuos.push({ p1, p2, matchLabel });
    } else {
      // Check alternative match
      const altIdx = targetIdx === 1 ? 0 : 1;
      const altMatch = matches[altIdx];
      if (altMatch) {
        const altLabel = altMatch.matchNumber === 1 ? 'On-Deck (Match 1)' : 'In-The-Hole (Match 2)';
        const isAlt2Unlinked = altMatch.team2PlayerIds.every(
          (id) => !playersMap.get(id)?.duoPartnerId
        );
        const isAlt1Unlinked = altMatch.team1PlayerIds.every(
          (id) => !playersMap.get(id)?.duoPartnerId
        );
        if (isAlt2Unlinked) {
          altMatch.team2PlayerIds = [p1.id, p2.id];
          unitedDuos.push({ p1, p2, matchLabel: altLabel });
        } else if (isAlt1Unlinked) {
          altMatch.team1PlayerIds = [p1.id, p2.id];
          unitedDuos.push({ p1, p2, matchLabel: altLabel });
        }
      }
    }
  }

  // Ensure all matches have full teams (2 players per team) by filling any vacancies with prioritized bench players
  const assigned = new Set<string>(currentlyPlayingIds);
  matches.forEach((m) => {
    m.team1PlayerIds.forEach((id) => assigned.add(id));
    m.team2PlayerIds.forEach((id) => assigned.add(id));
  });

  const availableBench = getPrioritizedAvailablePlayers(activePlayers, rounds, assigned);
  let benchIdx = 0;

  matches = matches.map((m) => {
    const t1 = [...m.team1PlayerIds];
    const t2 = [...m.team2PlayerIds];

    while (t1.length < playersPerTeam && benchIdx < availableBench.length) {
      const filler = availableBench[benchIdx++];
      if (filler && !assigned.has(filler.id)) {
        t1.push(filler.id);
        assigned.add(filler.id);
      }
    }
    while (t2.length < playersPerTeam && benchIdx < availableBench.length) {
      const filler = availableBench[benchIdx++];
      if (filler && !assigned.has(filler.id)) {
        t2.push(filler.id);
        assigned.add(filler.id);
      }
    }

    return {
      ...m,
      team1PlayerIds: t1,
      team2PlayerIds: t2,
    };
  });

  return { updatedUpcoming: matches, unitedDuos };
}

/**
 * Advances upcoming matches when a new round begins:
 * - Previous In-The-Hole (Match 2) advances to become On-Deck (Match 1).
 * - A brand-new In-The-Hole (Match 2) is generated from the bench / rotation queue.
 * - In this newly generated match, any locked duo available will be paired together!
 */
export function advanceUpcomingQueue({
  currentUpcoming,
  newRound,
  players,
  rounds,
  courtsCount,
  playersPerTeam,
}: {
  currentUpcoming: UpcomingMatch[];
  newRound: Round;
  players: Player[];
  rounds: Round[];
  courtsCount: number;
  playersPerTeam: number;
}): UpcomingMatch[] {
  const playersPerMatch = playersPerTeam * 2;
  const activePlayers = players.filter((p) => p.active);
  if (activePlayers.length < playersPerMatch) return [];

  // Players currently playing in newRound
  const currentlyPlayingIds = new Set<string>();
  newRound.matches.forEach((m) => {
    m.team1.playerIds.forEach((id) => currentlyPlayingIds.add(id));
    m.team2.playerIds.forEach((id) => currentlyPlayingIds.add(id));
  });

  const nextUpcoming: UpcomingMatch[] = [];

  // 1. Next On-Deck (Match 1): Advance previous In-The-Hole if valid
  const previousInTheHole = currentUpcoming.find((m) => m.matchNumber === 2);
  let canUsePreviousInTheHole = false;
  if (previousInTheHole) {
    const p1 = previousInTheHole.team1PlayerIds;
    const p2 = previousInTheHole.team2PlayerIds;
    const allIds = [...p1, ...p2];
    const basePlayStreaks = getConsecutivePlayRounds(players, rounds, true);
    const allActive = allIds.every((id) => {
      const pl = players.find((p) => p.id === id);
      if (!pl || !pl.active) return false;
      const streakIntoMatch1 = currentlyPlayingIds.has(id)
        ? (basePlayStreaks[id] || 0) + 1
        : 0;
      return streakIntoMatch1 <= 2;
    });

    // Also verify no locked duo was broken in previous In-The-Hole
    const hasBrokenDuo = allIds.some((id) => {
      const pl = players.find((p) => p.id === id);
      if (!pl?.duoPartnerId) return false;
      const inT1 = p1.includes(id);
      const partnerInSameTeam = inT1
        ? p1.includes(pl.duoPartnerId)
        : p2.includes(pl.duoPartnerId);
      return !partnerInSameTeam;
    });

    if (allActive && allIds.length === playersPerMatch && !hasBrokenDuo) {
      canUsePreviousInTheHole = true;
      nextUpcoming.push({
        matchNumber: 1,
        team1PlayerIds: p1,
        team2PlayerIds: p2,
        isOverridden: previousInTheHole.isOverridden,
        courtNumber: 1,
      });
    }
  }

  // If previous In-The-Hole cannot be used, generate Match 1 fresh
  const match1Ids = new Set<string>();
  if (nextUpcoming.length > 0) {
    nextUpcoming[0].team1PlayerIds.forEach((id) => match1Ids.add(id));
    nextUpcoming[0].team2PlayerIds.forEach((id) => match1Ids.add(id));
  } else {
    const fresh = predictNextTwoMatches({
      players,
      rounds,
      courtsCount,
      playersPerTeam,
    });
    if (fresh.length > 0) {
      nextUpcoming.push({
        ...fresh[0],
        matchNumber: 1,
        courtNumber: 1,
      });
      fresh[0].team1PlayerIds.forEach((id) => match1Ids.add(id));
      fresh[0].team2PlayerIds.forEach((id) => match1Ids.add(id));
    }
  }

  // 2. Next In-The-Hole (Match 2): Brand new generated match
  const matchCounts = getPlayerMatchCounts(activePlayers, rounds, true);
  const benchStreaks = getConsecutiveBenchRounds(activePlayers, rounds, true);
  const lastPlayed = getLastPlayedRound(activePlayers, rounds);

  // Exclude players waiting on bench for partner to finish court play
  const waitingForPartnerIds = new Set<string>();
  activePlayers.forEach((p) => {
    if (p.duoPartnerId && currentlyPlayingIds.has(p.duoPartnerId)) {
      waitingForPartnerIds.add(p.id);
    }
  });

  let candidatePool = activePlayers.filter((p) => !waitingForPartnerIds.has(p.id));

  const playStreaks = getConsecutivePlayRounds(activePlayers, rounds, true);

  const projectedPlayStreaksForMatch2: Record<string, number> = {};
  const projectedCountsForMatch2: Record<string, number> = {};

  activePlayers.forEach((p) => {
    const playedInNewRound = currentlyPlayingIds.has(p.id);
    const playsInMatch1 = match1Ids.has(p.id);

    // Projected match count after newRound + Match 1
    projectedCountsForMatch2[p.id] =
      (matchCounts[p.id] || 0) + (playedInNewRound ? 1 : 0) + (playsInMatch1 ? 1 : 0);

    // Projected play streak leading into Match 2
    if (playsInMatch1) {
      projectedPlayStreaksForMatch2[p.id] = playedInNewRound
        ? (playStreaks[p.id] || 0) + 2
        : 1;
    } else {
      projectedPlayStreaksForMatch2[p.id] = 0;
    }
  });

  const selectedM2 = selectOptimalCandidatesForMatch({
    pool: candidatePool,
    neededSlots: playersPerMatch,
    rounds,
    matchCounts: projectedCountsForMatch2,
    playStreaks: projectedPlayStreaksForMatch2,
    benchStreaks,
    playersPerTeam,
    previousRoundPlayerIds: match1Ids,
  });

  if (selectedM2.length >= playersPerMatch) {
    const optimized = optimizeCourtAndTeamPairings({
      selectedPlayers: selectedM2,
      courtsCount: 1,
      playersPerTeam,
      rounds,
    });
    const t1 =
      optimized[0]?.team1 ||
      selectedM2.slice(0, playersPerTeam).map((p) => p.id);
    const t2 =
      optimized[0]?.team2 ||
      selectedM2.slice(playersPerTeam, playersPerMatch).map((p) => p.id);

    nextUpcoming.push({
      matchNumber: 2,
      team1PlayerIds: t1,
      team2PlayerIds: t2,
      isOverridden: false,
      courtNumber: 2,
    });
  }

  // Final pass: unite any available duos (both finished court play) into upcoming matches
  const { updatedUpcoming } = uniteAvailableDuosInUpcomingMatches({
    upcomingMatches: nextUpcoming,
    players,
    rounds,
    courtsCount,
    playersPerTeam,
  });

  return updatedUpcoming;
}

/**
 * Ensures all players in upcoming matches are active and valid.
 * If any player has quit or paused, replaces them with active bench players.
 */
export function sanitizeUpcomingMatches(
  upcomingMatches: UpcomingMatch[],
  players: Player[],
  rounds: Round[],
  currentlyPlayingIds = new Set<string>()
): { sanitized: UpcomingMatch[]; replacements: UpcomingReplacementEvent[] } {
  let current = [...upcomingMatches];
  const allReplacements: UpcomingReplacementEvent[] = [];
  const activeIds = new Set(players.filter((p) => p.active).map((p) => p.id));

  current.forEach((m) => {
    [...m.team1PlayerIds, ...m.team2PlayerIds].forEach((id) => {
      if (!activeIds.has(id)) {
        const p = players.find((pl) => pl.id === id);
        const { updatedUpcoming, replacementEvents } = replacePlayerInUpcomingMatches({
          upcomingMatches: current,
          targetPlayerId: id,
          players,
          rounds,
          targetPlayerName: p?.name,
          currentlyPlayingCourtPlayerIds: currentlyPlayingIds,
        });
        current = updatedUpcoming;
        allReplacements.push(...replacementEvents);
      }
    });
  });

  return { sanitized: current, replacements: allReplacements };
}

