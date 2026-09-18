import { OpenPlayPlayer, OpenPlayMatch, OpenPlayConfig } from '../types/openPlay';
import { AVATAR_COLORS } from './sampleData';

export const OPENPLAY_STORAGE_KEYS = {
  CONFIG: 'openplay_config_v1',
  PLAYERS: 'openplay_players_v1',
  ACTIVE_MATCHES: 'openplay_active_matches_v1',
  HISTORY: 'openplay_history_v1',
  WINNERS_QUEUE: 'openplay_winners_queue_v2',
  LOSERS_QUEUE: 'openplay_losers_queue_v2',
  RESTING_BENCH: 'openplay_resting_bench_v2',
  WAITING_QUEUE: 'openplay_waiting_queue_v1',
  NEXT_QUEUE_TURN: 'openplay_next_queue_turn_v2',
};

export const DEFAULT_OPENPLAY_CONFIG: OpenPlayConfig = {
  sessionName: 'Open Play Session',
  sport: 'pickleball',
  format: 'doubles',
  courtsCount: 2,
  targetPoints: 11,
  winByTwo: true,
  autoDispatchNext: true,
  benchRotationRule: 'most_games',
  nextQueueTurn: 'winners',
};

export const DEFAULT_SAMPLE_PLAYERS: OpenPlayPlayer[] = [];

/**
 * On-Court Partner Split:
 * Label arrivals 1, 2, 3, 4 based on arrival order.
 * - Mode 14_vs_23 (Default): Always pair 1 with 4 against 2 with 3.
 *   Guarantees previous teammates are split onto opposite sides of the net.
 * - Mode 12_vs_34: Pair 1 with 2 against 3 with 4.
 * - Mode 13_vs_24: Pair 1 with 3 against 2 with 4.
 */
export function getSplitTeams(
  arrivalOrder: string[],
  splitMode: '14_vs_23' | '12_vs_34' | '13_vs_24' = '14_vs_23'
): { team1: string[]; team2: string[] } {
  if (arrivalOrder.length < 4) {
    return {
      team1: arrivalOrder.slice(0, Math.ceil(arrivalOrder.length / 2)),
      team2: arrivalOrder.slice(Math.ceil(arrivalOrder.length / 2)),
    };
  }

  const [p1, p2, p3, p4] = arrivalOrder;

  switch (splitMode) {
    case '12_vs_34':
      return { team1: [p1, p2], team2: [p3, p4] };
    case '13_vs_24':
      return { team1: [p1, p3], team2: [p2, p4] };
    case '14_vs_23':
    default:
      // 1 with 4 against 2 with 3
      return { team1: [p1, p4], team2: [p2, p3] };
  }
}

/**
 * Shuffle/cycle on-court partners for an active match:
 * 14_vs_23 -> 12_vs_34 -> 13_vs_24 -> back to 14_vs_23
 */
export function cyclePartnerSplit(match: OpenPlayMatch): OpenPlayMatch {
  const currentMode = match.partnerSplitMode || '14_vs_23';
  let nextMode: '14_vs_23' | '12_vs_34' | '13_vs_24' = '14_vs_23';

  if (currentMode === '14_vs_23') {
    nextMode = '12_vs_34';
  } else if (currentMode === '12_vs_34') {
    nextMode = '13_vs_24';
  } else {
    nextMode = '14_vs_23';
  }

  const { team1, team2 } = getSplitTeams(match.arrivalOrder, nextMode);

  return {
    ...match,
    partnerSplitMode: nextMode,
    team1,
    team2,
  };
}

/**
 * Randomize partner split among on-court players
 */
export function randomizePartnerSplit(match: OpenPlayMatch): OpenPlayMatch {
  const modes: ('14_vs_23' | '12_vs_34' | '13_vs_24')[] = ['14_vs_23', '12_vs_34', '13_vs_24'];
  const currentMode = match.partnerSplitMode || '14_vs_23';
  const otherModes = modes.filter((m) => m !== currentMode);
  const nextMode = otherModes[Math.floor(Math.random() * otherModes.length)];

  const { team1, team2 } = getSplitTeams(match.arrivalOrder, nextMode);

  return {
    ...match,
    partnerSplitMode: nextMode,
    team1,
    team2,
  };
}

/**
 * Core Rule 2: Filling a Match (Doubles 4 players, Singles 2 players)
 *
 * 1. Starting Bench Queue Priority:
 *    All players start in the Bench Queue until all players in the Bench Queue have played.
 *    If the Bench Queue has players, they are dispatched to courts first.
 *    If fewer than 4 players remain on the bench, the remaining spots are filled from the active queue turn.
 *
 * 2. Alternating Queue Turn (Once Bench Queue is drained):
 *    - Winners Queue plays first.
 *    - Then alternates to Losers Queue.
 *    - Then alternates back to Winners Queue, and so on.
 *    - Both winners and losers line up at the back of their respective queues (FIFO).
 *    - If a queue has fewer than 4 players, Move-Up fill rule pulls from the opposite queue so games start promptly.
 */
export function generateNextMatchWithBuckets(
  courtNumber: number,
  benchQueue: string[],
  winnersQueue: string[],
  losersQueue: string[],
  nextQueueTurn: 'winners' | 'losers' = 'winners',
  matchCounter: number,
  format: 'doubles' | 'singles' = 'doubles'
): {
  match: OpenPlayMatch | null;
  newBenchQueue: string[];
  newWinnersQueue: string[];
  newLosersQueue: string[];
  nextQueueTurn: 'winners' | 'losers';
  assignedPlayerIds: string[];
} {
  const neededPlayers = format === 'doubles' ? 4 : 2;

  // ----------------------------------------------------
  // SINGLES FORMAT (2 PLAYERS)
  // ----------------------------------------------------
  if (format === 'singles') {
    let arrivalOrder: string[] = [];
    let curBench = [...benchQueue];
    let curWinners = [...winnersQueue];
    let curLosers = [...losersQueue];
    let curTurn = nextQueueTurn;
    let matchType: OpenPlayMatch['matchType'] = 'bench_start';

    // 1. Bench Queue Priority (All players start at bench until all have played)
    if (curBench.length >= 2) {
      arrivalOrder = curBench.slice(0, 2);
      curBench = curBench.slice(2);
      matchType = 'bench_start';
      if (curBench.length === 0) {
        curTurn = 'winners';
      }
    } else if (curBench.length === 1) {
      // 1 player left on bench: need 1 player to fill.
      // Get 1 winners player who is first in their bucket to fill that match
      // (fallback to losers if winners is empty)
      const fromBench = curBench[0];
      let secondPlayer: string | null = null;
      if (curWinners.length > 0) {
        secondPlayer = curWinners[0];
        curWinners = curWinners.slice(1);
      } else if (curLosers.length > 0) {
        secondPlayer = curLosers[0];
        curLosers = curLosers.slice(1);
      }

      if (!secondPlayer) {
        return {
          match: null,
          newBenchQueue: benchQueue,
          newWinnersQueue: winnersQueue,
          newLosersQueue: losersQueue,
          nextQueueTurn,
          assignedPlayerIds: [],
        };
      }
      arrivalOrder = [fromBench, secondPlayer];
      curBench = [];
      matchType = 'bench_start';
      curTurn = 'winners'; // Bench now drained: winners queue plays first
    } else {
      // 2. Alternating Turn between Winners and Losers
      if (curTurn === 'winners') {
        if (curWinners.length >= 2) {
          arrivalOrder = curWinners.slice(0, 2);
          curWinners = curWinners.slice(2);
          curTurn = 'losers';
          matchType = 'pure_winners';
        } else if (curWinners.length === 1 && curLosers.length >= 1) {
          arrivalOrder = [curWinners[0], curLosers[0]];
          curWinners = [];
          curLosers = curLosers.slice(1);
          curTurn = 'losers';
          matchType = 'move_up';
        } else if (curLosers.length >= 2) {
          // Fallback to losers if winners empty
          arrivalOrder = curLosers.slice(0, 2);
          curLosers = curLosers.slice(2);
          curTurn = 'winners';
          matchType = 'pure_losers';
        } else {
          return {
            match: null,
            newBenchQueue: benchQueue,
            newWinnersQueue: winnersQueue,
            newLosersQueue: losersQueue,
            nextQueueTurn,
            assignedPlayerIds: [],
          };
        }
      } else {
        // Losers turn
        if (curLosers.length >= 2) {
          arrivalOrder = curLosers.slice(0, 2);
          curLosers = curLosers.slice(2);
          curTurn = 'winners';
          matchType = 'pure_losers';
        } else if (curLosers.length === 1 && curWinners.length >= 1) {
          arrivalOrder = [curLosers[0], curWinners[0]];
          curLosers = [];
          curWinners = curWinners.slice(1);
          curTurn = 'winners';
          matchType = 'move_up';
        } else if (curWinners.length >= 2) {
          // Fallback to winners if losers empty
          arrivalOrder = curWinners.slice(0, 2);
          curWinners = curWinners.slice(2);
          curTurn = 'losers';
          matchType = 'pure_winners';
        } else {
          return {
            match: null,
            newBenchQueue: benchQueue,
            newWinnersQueue: winnersQueue,
            newLosersQueue: losersQueue,
            nextQueueTurn,
            assignedPlayerIds: [],
          };
        }
      }
    }

    const match: OpenPlayMatch = {
      id: `op-match-${Date.now()}-${courtNumber}`,
      matchNumber: matchCounter,
      courtNumber,
      team1: [arrivalOrder[0]],
      team2: [arrivalOrder[1]],
      score1: 0,
      score2: 0,
      status: 'in_progress',
      startedAt: Date.now(),
      arrivalOrder,
      matchType,
      partnerSplitMode: '14_vs_23',
    };

    return {
      match,
      newBenchQueue: curBench,
      newWinnersQueue: curWinners,
      newLosersQueue: curLosers,
      nextQueueTurn: curTurn,
      assignedPlayerIds: arrivalOrder,
    };
  }

  // ----------------------------------------------------
  // DOUBLES FORMAT (4 PLAYERS)
  // ----------------------------------------------------
  let arrivalOrder: string[] = [];
  let curBench = [...benchQueue];
  let curWinners = [...winnersQueue];
  let curLosers = [...losersQueue];
  let curTurn = nextQueueTurn;
  let matchType: OpenPlayMatch['matchType'] = 'bench_start';
  let movedUpPlayerIds: string[] = [];

  // 1. Bench Queue Priority & Remaining Bench Filling Rules
  // "when there remaining players on the bench that need players for them to play on the court then let the 2 winners player and 1 losers player fill that spot for them to be able to play,
  // example in a 2v2 match:
  // - 1 player left on bench: get 2 winners players and 1 losers player who are first in their bucket to fill that match
  // - 2 players left on bench: get 2 winners players to fill that match
  // - 3 players remaining on bench: get 1 winners player fill that spot for them to play
  // - 4 players on bench: continue the match without needing to fill"
  if (curBench.length >= 4) {
    arrivalOrder = curBench.slice(0, 4);
    curBench = curBench.slice(4);
    matchType = 'bench_start';
    if (curBench.length === 0) {
      curTurn = 'winners';
    }
  } else if (curBench.length === 3) {
    // 3 bench remaining -> get 1 winners player who is first in their bucket
    const benchPlayers = [...curBench];
    let filledPlayer: string | null = null;
    if (curWinners.length > 0) {
      filledPlayer = curWinners[0];
      curWinners = curWinners.slice(1);
    } else if (curLosers.length > 0) {
      // Fallback if winners is empty
      filledPlayer = curLosers[0];
      curLosers = curLosers.slice(1);
    }

    if (!filledPlayer) {
      return {
        match: null,
        newBenchQueue: benchQueue,
        newWinnersQueue: winnersQueue,
        newLosersQueue: losersQueue,
        nextQueueTurn,
        assignedPlayerIds: [],
      };
    }

    arrivalOrder = [benchPlayers[0], benchPlayers[1], benchPlayers[2], filledPlayer];
    curBench = [];
    matchType = 'bench_start';
    curTurn = 'winners'; // Bench now drained: winners queue plays first in alternating mode
  } else if (curBench.length === 2) {
    // 2 bench remaining -> get 2 winners players who are first in their bucket
    const benchPlayers = [...curBench];
    let pulledWinners: string[] = curWinners.slice(0, 2);
    curWinners = curWinners.slice(pulledWinners.length);

    let pulledLosers: string[] = [];
    if (pulledWinners.length < 2) {
      const stillNeeded = 2 - pulledWinners.length;
      pulledLosers = curLosers.slice(0, stillNeeded);
      curLosers = curLosers.slice(pulledLosers.length);
    }

    const filled = [...pulledWinners, ...pulledLosers];
    if (filled.length < 2) {
      return {
        match: null,
        newBenchQueue: benchQueue,
        newWinnersQueue: winnersQueue,
        newLosersQueue: losersQueue,
        nextQueueTurn,
        assignedPlayerIds: [],
      };
    }

    arrivalOrder = [benchPlayers[0], benchPlayers[1], filled[0], filled[1]];
    curBench = [];
    matchType = 'bench_start';
    curTurn = 'winners'; // Bench now drained: winners queue plays first in alternating mode
  } else if (curBench.length === 1) {
    // 1 bench remaining -> get 2 winners players and 1 losers player who are first in their bucket
    const benchPlayer = curBench[0];
    let pulledWinners: string[] = curWinners.slice(0, 2);
    curWinners = curWinners.slice(pulledWinners.length);

    let pulledLosers: string[] = curLosers.slice(0, 1);
    curLosers = curLosers.slice(pulledLosers.length);

    // Fallback if winners or losers were short: take available from either queue to total 3
    let totalFilled = [...pulledWinners, ...pulledLosers];
    if (totalFilled.length < 3 && curWinners.length > 0) {
      const extraNeeded = 3 - totalFilled.length;
      const extraWinners = curWinners.slice(0, extraNeeded);
      pulledWinners.push(...extraWinners);
      curWinners = curWinners.slice(extraWinners.length);
      totalFilled = [...pulledWinners, ...pulledLosers];
    }
    if (totalFilled.length < 3 && curLosers.length > 0) {
      const extraNeeded = 3 - totalFilled.length;
      const extraLosers = curLosers.slice(0, extraNeeded);
      pulledLosers.push(...extraLosers);
      curLosers = curLosers.slice(extraLosers.length);
      totalFilled = [...pulledWinners, ...pulledLosers];
    }

    if (totalFilled.length < 3) {
      return {
        match: null,
        newBenchQueue: benchQueue,
        newWinnersQueue: winnersQueue,
        newLosersQueue: losersQueue,
        nextQueueTurn,
        assignedPlayerIds: [],
      };
    }

    if (pulledWinners.length >= 2 && pulledLosers.length >= 1) {
      // Bench + Winner2 vs Winner1 + Loser1
      arrivalOrder = [benchPlayer, pulledWinners[0], pulledLosers[0], pulledWinners[1]];
    } else {
      arrivalOrder = [benchPlayer, totalFilled[0], totalFilled[1], totalFilled[2]];
    }
    curBench = [];
    matchType = 'bench_start';
    curTurn = 'winners'; // Bench now drained: winners queue plays first in alternating mode
  } else {
    // 2. Alternating Turn (Once Bench Queue is drained)
    // "then winners queue will play first then alternate to the losers queue then winners queue again etc."
    if (curTurn === 'winners') {
      // WINNERS QUEUE TURN
      if (curWinners.length >= 4) {
        // Pure Winners Match
        arrivalOrder = curWinners.slice(0, 4);
        curWinners = curWinners.slice(4);
        matchType = 'pure_winners';
        curTurn = 'losers'; // Alternates to losers queue next!
      } else if (curWinners.length > 0 && curWinners.length + curLosers.length >= 4) {
        // Move-Up Fill: Take all available winners + top challengers from losers queue
        const poppedWinners = [...curWinners];
        const neededFromLosers = 4 - poppedWinners.length;
        const poppedLosers = curLosers.slice(0, neededFromLosers);

        arrivalOrder = [...poppedWinners, ...poppedLosers];
        curWinners = [];
        curLosers = curLosers.slice(neededFromLosers);
        matchType = 'move_up';
        movedUpPlayerIds = poppedLosers;
        curTurn = 'losers'; // Alternates to losers queue next!
      } else if (curWinners.length === 0 && curLosers.length >= 4) {
        // Fallback: Winners empty, dispatch losers so court is not idle
        arrivalOrder = curLosers.slice(0, 4);
        curLosers = curLosers.slice(4);
        matchType = 'pure_losers';
        curTurn = 'winners'; // Losers just played, so next is winners!
      } else {
        // Not enough players available
        return {
          match: null,
          newBenchQueue: benchQueue,
          newWinnersQueue: winnersQueue,
          newLosersQueue: losersQueue,
          nextQueueTurn,
          assignedPlayerIds: [],
        };
      }
    } else {
      // LOSERS QUEUE TURN
      if (curLosers.length >= 4) {
        // Pure Losers Match
        arrivalOrder = curLosers.slice(0, 4);
        curLosers = curLosers.slice(4);
        matchType = 'pure_losers';
        curTurn = 'winners'; // Alternates to winners queue next!
      } else if (curLosers.length > 0 && curLosers.length + curWinners.length >= 4) {
        // Move-Up Fill: Take all available losers + top from winners queue
        const poppedLosers = [...curLosers];
        const neededFromWinners = 4 - poppedLosers.length;
        const poppedWinners = curWinners.slice(0, neededFromWinners);

        arrivalOrder = [...poppedLosers, ...poppedWinners];
        curLosers = [];
        curWinners = curWinners.slice(neededFromWinners);
        matchType = 'move_up';
        curTurn = 'winners'; // Alternates to winners queue next!
      } else if (curLosers.length === 0 && curWinners.length >= 4) {
        // Fallback: Losers empty, dispatch winners so court is not idle
        arrivalOrder = curWinners.slice(0, 4);
        curWinners = curWinners.slice(4);
        matchType = 'pure_winners';
        curTurn = 'losers'; // Winners just played, so next is losers!
      } else {
        // Not enough players available
        return {
          match: null,
          newBenchQueue: benchQueue,
          newWinnersQueue: winnersQueue,
          newLosersQueue: losersQueue,
          nextQueueTurn,
          assignedPlayerIds: [],
        };
      }
    }
  }

  // Rule 3: On-Court Partner Split (1+4 vs 2+3)
  const { team1, team2 } = getSplitTeams(arrivalOrder, '14_vs_23');

  const match: OpenPlayMatch = {
    id: `op-match-${Date.now()}-${courtNumber}`,
    matchNumber: matchCounter,
    courtNumber,
    team1,
    team2,
    score1: 0,
    score2: 0,
    status: 'in_progress',
    startedAt: Date.now(),
    arrivalOrder,
    matchType,
    partnerSplitMode: '14_vs_23',
    movedUpPlayerIds: movedUpPlayerIds.length > 0 ? movedUpPlayerIds : undefined,
  };

  return {
    match,
    newBenchQueue: curBench,
    newWinnersQueue: curWinners,
    newLosersQueue: curLosers,
    nextQueueTurn: curTurn,
    assignedPlayerIds: arrivalOrder,
  };
}

/**
 * Universal Match Cycle - Complete Game:
 * 1. Winners: Added individually to the back of the Winners Queue (FIFO).
 * 2. Losers: Added individually to the back of the Losers Queue (FIFO).
 * 3. Bench: Untouched upon game finish (all finished players queue up in Winners/Losers; no bench swaps).
 */
export function completeOpenPlayMatchWithBuckets(
  match: OpenPlayMatch,
  score1: number,
  score2: number,
  winnersQueue: string[],
  losersQueue: string[],
  restingBench: string[],
  playerRegistry: Record<string, OpenPlayPlayer>,
  _benchRotationRule?: 'most_games' | 'random',
  _manualBenchCandidateId?: string
): {
  completedMatch: OpenPlayMatch;
  newWinnersQueue: string[];
  newLosersQueue: string[];
  newRestingBench: string[];
  updatedPlayers: Record<string, OpenPlayPlayer>;
  winnerPlayerNames: string[];
  loserPlayerNames: string[];
  benchRotatedInName?: string;
  benchRotatedOutName?: string;
} {
  const isTeam1Winner = score1 > score2;
  const isTeam2Winner = score2 > score1;
  const isDraw = score1 === score2;

  let winnerIds: string[] = [];
  let loserIds: string[] = [];
  let winner: 1 | 2 | 'draw' = 'draw';

  if (isTeam1Winner) {
    winner = 1;
    winnerIds = [...match.team1];
    loserIds = [...match.team2];
  } else if (isTeam2Winner) {
    winner = 2;
    winnerIds = [...match.team2];
    loserIds = [...match.team1];
  } else {
    winner = 'draw';
    winnerIds = [...match.team1];
    loserIds = [...match.team2];
  }

  const updatedRegistry = { ...playerRegistry };
  const now = Date.now();

  // Update Winners stats & registry
  winnerIds.forEach((id, index) => {
    const p = updatedRegistry[id] || {
      id,
      name: 'Player',
      avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
      joinedQueueAt: now,
      status: 'waiting',
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestStreak: 0,
    };
    const newWins = isDraw ? p.wins : p.wins + 1;
    const newStreak = isDraw ? p.currentStreak : p.currentStreak + 1;
    const bestStreak = Math.max(p.bestStreak, newStreak);

    updatedRegistry[id] = {
      ...p,
      status: 'waiting',
      bucket: 'winners',
      courtAssigned: null,
      gamesPlayed: p.gamesPlayed + 1,
      wins: newWins,
      currentStreak: newStreak,
      bestStreak,
    };
  });

  // Update Losers stats & registry
  loserIds.forEach((id) => {
    const p = updatedRegistry[id] || {
      id,
      name: 'Player',
      avatarColor: AVATAR_COLORS[1],
      joinedQueueAt: now,
      status: 'waiting',
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestStreak: 0,
    };

    updatedRegistry[id] = {
      ...p,
      status: 'waiting',
      bucket: 'losers',
      courtAssigned: null,
      gamesPlayed: p.gamesPlayed + 1,
      losses: isDraw ? p.losses : p.losses + 1,
      currentStreak: 0,
    };
  });

  // FIFO Buckets Update (Universal Re-queue):
  // 1. Winners: Added individually to the back of the Winners Queue
  const newWinnersQueue = [...winnersQueue.filter((id) => !winnerIds.includes(id)), ...winnerIds];

  // 2. Losers: Added individually to the back of the Losers Queue
  const newLosersQueue = [...losersQueue.filter((id) => !loserIds.includes(id)), ...loserIds];

  // 3. Resting Bench: No swap occurs! Remains as is.
  const nextRestingBench = [...restingBench];

  const completedMatch: OpenPlayMatch = {
    ...match,
    score1,
    score2,
    completedAt: now,
    status: 'completed',
    winner,
    winnerIds,
    loserIds,
  };

  const winnerPlayerNames = winnerIds.map((id) => updatedRegistry[id]?.name || 'Player');
  const loserPlayerNames = loserIds.map((id) => updatedRegistry[id]?.name || 'Player');

  return {
    completedMatch,
    newWinnersQueue,
    newLosersQueue,
    newRestingBench: nextRestingBench,
    updatedPlayers: updatedRegistry,
    winnerPlayerNames,
    loserPlayerNames,
  };
}

/**
 * Automatically fill all available open courts from the Bench, Winners & Losers queues
 */
export function dispatchAvailableCourtsWithBuckets(
  courtsCount: number,
  activeMatches: Record<number, OpenPlayMatch>,
  benchQueue: string[],
  winnersQueue: string[],
  losersQueue: string[],
  nextQueueTurn: 'winners' | 'losers' = 'winners',
  startMatchCounter: number,
  format: 'doubles' | 'singles' = 'doubles'
): {
  newMatches: OpenPlayMatch[];
  updatedActiveMatches: Record<number, OpenPlayMatch>;
  newBenchQueue: string[];
  newWinnersQueue: string[];
  newLosersQueue: string[];
  nextQueueTurn: 'winners' | 'losers';
  newMatchCounter: number;
} {
  let curBench = [...benchQueue];
  let curWinners = [...winnersQueue];
  let curLosers = [...losersQueue];
  let curTurn = nextQueueTurn;
  const newMatches: OpenPlayMatch[] = [];
  const updatedActive = { ...activeMatches };
  let matchCounter = startMatchCounter;

  for (let courtNum = 1; courtNum <= courtsCount; courtNum++) {
    // Check if court is free
    if (!updatedActive[courtNum] || updatedActive[courtNum].status === 'completed') {
      const res = generateNextMatchWithBuckets(
        courtNum,
        curBench,
        curWinners,
        curLosers,
        curTurn,
        matchCounter,
        format
      );

      if (res.match) {
        newMatches.push(res.match);
        updatedActive[courtNum] = res.match;
        curBench = res.newBenchQueue;
        curWinners = res.newWinnersQueue;
        curLosers = res.newLosersQueue;
        curTurn = res.nextQueueTurn;
        matchCounter++;
      }
    }
  }

  return {
    newMatches,
    updatedActiveMatches: updatedActive,
    newBenchQueue: curBench,
    newWinnersQueue: curWinners,
    newLosersQueue: curLosers,
    nextQueueTurn: curTurn,
    newMatchCounter: matchCounter,
  };
}

// Backward compatibility export
export const generateNextMatchForCourt = (
  courtNumber: number,
  waitingQueue: OpenPlayPlayer[],
  format: 'doubles' | 'singles',
  matchCounter: number
) => {
  const ids = waitingQueue.filter((p) => p.status === 'waiting').map((p) => p.id);
  const res = generateNextMatchWithBuckets(courtNumber, ids, [], [], 'winners', matchCounter, format);
  return {
    match: res.match,
    remainingQueue: waitingQueue.filter((p) => !res.assignedPlayerIds.includes(p.id)),
    assignedPlayerIds: res.assignedPlayerIds,
  };
};

export const completeOpenPlayMatch = (
  match: OpenPlayMatch,
  score1: number,
  score2: number,
  currentWaitingQueue: OpenPlayPlayer[],
  playerRegistry: Record<string, OpenPlayPlayer>
) => {
  const res = completeOpenPlayMatchWithBuckets(
    match,
    score1,
    score2,
    [],
    currentWaitingQueue.map((p) => p.id),
    [],
    playerRegistry
  );
  return {
    completedMatch: res.completedMatch,
    newWaitingQueue: [...res.newWinnersQueue, ...res.newLosersQueue].map(
      (id) => res.updatedPlayers[id]
    ),
    updatedPlayers: res.updatedPlayers,
    winnerPlayerNames: res.winnerPlayerNames,
    loserPlayerNames: res.loserPlayerNames,
  };
};

export const dispatchAvailableCourts = (
  courtsCount: number,
  activeMatches: Record<number, OpenPlayMatch>,
  waitingQueue: OpenPlayPlayer[],
  format: 'doubles' | 'singles',
  startMatchCounter: number
) => {
  const ids = waitingQueue.filter((p) => p.status === 'waiting').map((p) => p.id);
  const res = dispatchAvailableCourtsWithBuckets(
    courtsCount,
    activeMatches,
    ids,
    [],
    [],
    'winners',
    startMatchCounter,
    format
  );
  return {
    newMatches: res.newMatches,
    updatedActiveMatches: res.updatedActiveMatches,
    updatedWaitingQueue: waitingQueue.filter(
      (p) =>
        !res.newMatches.some((m) => m.team1.includes(p.id) || m.team2.includes(p.id))
    ),
    newMatchCounter: res.newMatchCounter,
  };
};
