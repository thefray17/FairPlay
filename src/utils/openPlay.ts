import { OpenPlayConfig, OpenPlayMatch, OpenPlayPlayer, PartnerSplitMode } from "../types/openPlay";
import { AVATAR_COLORS } from "./sampleData";

export const OPENPLAY_STORAGE_KEYS = {
  CONFIG: "openplay_config_v1",
  PLAYERS: "openplay_players_v1",
  ACTIVE_MATCHES: "openplay_active_matches_v1",
  HISTORY: "openplay_history_v1",
  WINNERS_QUEUE: "openplay_winners_queue_v2",
  LOSERS_QUEUE: "openplay_losers_queue_v2",
  RESTING_BENCH: "openplay_resting_bench_v2",
  WAITING_QUEUE: "openplay_waiting_queue_v1",
  NEXT_QUEUE_TURN: "openplay_next_queue_turn_v2"
};
export const DEFAULT_OPENPLAY_CONFIG = {
  sessionName: "Open Play Session",
  sport: "pickleball",
  format: "doubles",
  courtsCount: 2,
  targetPoints: 11,
  winByTwo: true,
  autoDispatchNext: true,
  benchRotationRule: "most_games",
  nextQueueTurn: "winners"
};
export function getSplitTeams(arrivalOrder: string[], splitMode: PartnerSplitMode | string = "14_vs_23") {
  if (arrivalOrder.length < 4) {
    return {
      team1: arrivalOrder.slice(0, Math.ceil(arrivalOrder.length / 2)),
      team2: arrivalOrder.slice(Math.ceil(arrivalOrder.length / 2))
    };
  }
  const [p1, p2, p3, p4] = arrivalOrder;
  switch (splitMode) {
    case "12_vs_34":
      return { team1: [p1, p2], team2: [p3, p4] };
    case "13_vs_24":
      return { team1: [p1, p3], team2: [p2, p4] };
    case "14_vs_23":
    default:
      return { team1: [p1, p4], team2: [p2, p3] };
  }
}
export function cyclePartnerSplit(match: OpenPlayMatch): OpenPlayMatch {
  const currentMode = match.partnerSplitMode || "14_vs_23";
  let nextMode = "14_vs_23";
  if (currentMode === "14_vs_23") {
    nextMode = "12_vs_34";
  } else if (currentMode === "12_vs_34") {
    nextMode = "13_vs_24";
  } else {
    nextMode = "14_vs_23";
  }
  const { team1, team2 } = getSplitTeams(match.arrivalOrder, nextMode);
  return {
    ...match,
    partnerSplitMode: nextMode,
    team1,
    team2
  };
}
export function generateNextMatchWithBuckets(
  courtNumber: number,
  benchQueue: string[],
  winnersQueue: string[],
  losersQueue: string[],
  nextQueueTurn: "winners" | "losers" = "winners",
  matchCounter: number,
  format: "doubles" | "singles" = "doubles"
): {
  match: OpenPlayMatch | null;
  newBenchQueue: string[];
  newWinnersQueue: string[];
  newLosersQueue: string[];
  nextQueueTurn: "winners" | "losers";
  assignedPlayerIds: string[];
} {
  const neededPlayers = format === "doubles" ? 4 : 2;
  if (format === "singles") {
    let arrivalOrder2 = [];
    let curBench2 = [...benchQueue];
    let curWinners2 = [...winnersQueue];
    let curLosers2 = [...losersQueue];
    let curTurn2 = nextQueueTurn;
    let matchType2 = "bench_start";
    if (curBench2.length >= 2) {
      arrivalOrder2 = curBench2.slice(0, 2);
      curBench2 = curBench2.slice(2);
      matchType2 = "bench_start";
      if (curBench2.length === 0) {
        curTurn2 = "winners";
      }
    } else if (curBench2.length === 1) {
      const fromBench = curBench2[0];
      let secondPlayer = null;
      if (curWinners2.length > 0) {
        secondPlayer = curWinners2[0];
        curWinners2 = curWinners2.slice(1);
      } else if (curLosers2.length > 0) {
        secondPlayer = curLosers2[0];
        curLosers2 = curLosers2.slice(1);
      }
      if (!secondPlayer) {
        return {
          match: null,
          newBenchQueue: benchQueue,
          newWinnersQueue: winnersQueue,
          newLosersQueue: losersQueue,
          nextQueueTurn,
          assignedPlayerIds: []
        };
      }
      arrivalOrder2 = [fromBench, secondPlayer];
      curBench2 = [];
      matchType2 = "bench_start";
      curTurn2 = "winners";
    } else {
      if (curTurn2 === "winners") {
        if (curWinners2.length >= 2) {
          arrivalOrder2 = curWinners2.slice(0, 2);
          curWinners2 = curWinners2.slice(2);
          curTurn2 = "losers";
          matchType2 = "pure_winners";
        } else if (curWinners2.length === 1 && curLosers2.length >= 1) {
          arrivalOrder2 = [curWinners2[0], curLosers2[0]];
          curWinners2 = [];
          curLosers2 = curLosers2.slice(1);
          curTurn2 = "losers";
          matchType2 = "move_up";
        } else if (curLosers2.length >= 2) {
          arrivalOrder2 = curLosers2.slice(0, 2);
          curLosers2 = curLosers2.slice(2);
          curTurn2 = "winners";
          matchType2 = "pure_losers";
        } else {
          return {
            match: null,
            newBenchQueue: benchQueue,
            newWinnersQueue: winnersQueue,
            newLosersQueue: losersQueue,
            nextQueueTurn,
            assignedPlayerIds: []
          };
        }
      } else {
        if (curLosers2.length >= 2) {
          arrivalOrder2 = curLosers2.slice(0, 2);
          curLosers2 = curLosers2.slice(2);
          curTurn2 = "winners";
          matchType2 = "pure_losers";
        } else if (curLosers2.length === 1 && curWinners2.length >= 1) {
          arrivalOrder2 = [curLosers2[0], curWinners2[0]];
          curLosers2 = [];
          curWinners2 = curWinners2.slice(1);
          curTurn2 = "winners";
          matchType2 = "move_up";
        } else if (curWinners2.length >= 2) {
          arrivalOrder2 = curWinners2.slice(0, 2);
          curWinners2 = curWinners2.slice(2);
          curTurn2 = "losers";
          matchType2 = "pure_winners";
        } else {
          return {
            match: null,
            newBenchQueue: benchQueue,
            newWinnersQueue: winnersQueue,
            newLosersQueue: losersQueue,
            nextQueueTurn,
            assignedPlayerIds: []
          };
        }
      }
    }
    const match2: OpenPlayMatch = {
      id: `op-match-${Date.now()}-${courtNumber}`,
      matchNumber: matchCounter,
      courtNumber,
      team1: [arrivalOrder2[0]],
      team2: [arrivalOrder2[1]],
      score1: 0,
      score2: 0,
      status: "in_progress",
      startedAt: Date.now(),
      arrivalOrder: arrivalOrder2,
      matchType: matchType2,
      partnerSplitMode: "14_vs_23"
    };
    return {
      match: match2,
      newBenchQueue: curBench2,
      newWinnersQueue: curWinners2,
      newLosersQueue: curLosers2,
      nextQueueTurn: curTurn2,
      assignedPlayerIds: arrivalOrder2
    };
  }
  let arrivalOrder: string[] = [];
  let curBench = [...benchQueue];
  let curWinners = [...winnersQueue];
  let curLosers = [...losersQueue];
  let curTurn = nextQueueTurn;
  let matchType = "bench_start";
  let movedUpPlayerIds: string[] = [];
  if (curBench.length >= 4) {
    arrivalOrder = curBench.slice(0, 4);
    curBench = curBench.slice(4);
    matchType = "bench_start";
    if (curBench.length === 0) {
      curTurn = "winners";
    }
  } else if (curBench.length === 3) {
    const benchPlayers = [...curBench];
    let filledPlayer = null;
    if (curWinners.length > 0) {
      filledPlayer = curWinners[0];
      curWinners = curWinners.slice(1);
    } else if (curLosers.length > 0) {
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
        assignedPlayerIds: []
      };
    }
    arrivalOrder = [benchPlayers[0], benchPlayers[1], benchPlayers[2], filledPlayer];
    curBench = [];
    matchType = "bench_start";
    curTurn = "winners";
  } else if (curBench.length === 2) {
    const benchPlayers = [...curBench];
    let pulledWinners = curWinners.slice(0, 2);
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
        assignedPlayerIds: []
      };
    }
    arrivalOrder = [benchPlayers[0], benchPlayers[1], filled[0], filled[1]];
    curBench = [];
    matchType = "bench_start";
    curTurn = "winners";
  } else if (curBench.length === 1) {
    const benchPlayer = curBench[0];
    let pulledWinners = curWinners.slice(0, 2);
    curWinners = curWinners.slice(pulledWinners.length);
    let pulledLosers = curLosers.slice(0, 1);
    curLosers = curLosers.slice(pulledLosers.length);
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
        assignedPlayerIds: []
      };
    }
    if (pulledWinners.length >= 2 && pulledLosers.length >= 1) {
      arrivalOrder = [benchPlayer, pulledWinners[0], pulledLosers[0], pulledWinners[1]];
    } else {
      arrivalOrder = [benchPlayer, totalFilled[0], totalFilled[1], totalFilled[2]];
    }
    curBench = [];
    matchType = "bench_start";
    curTurn = "winners";
  } else {
    if (curTurn === "winners") {
      if (curWinners.length >= 4) {
        arrivalOrder = curWinners.slice(0, 4);
        curWinners = curWinners.slice(4);
        matchType = "pure_winners";
        curTurn = "losers";
      } else if (curWinners.length > 0 && curWinners.length + curLosers.length >= 4) {
        const poppedWinners = [...curWinners];
        const neededFromLosers = 4 - poppedWinners.length;
        const poppedLosers = curLosers.slice(0, neededFromLosers);
        arrivalOrder = [...poppedWinners, ...poppedLosers];
        curWinners = [];
        curLosers = curLosers.slice(neededFromLosers);
        matchType = "move_up";
        movedUpPlayerIds = poppedLosers;
        curTurn = "losers";
      } else if (curWinners.length === 0 && curLosers.length >= 4) {
        arrivalOrder = curLosers.slice(0, 4);
        curLosers = curLosers.slice(4);
        matchType = "pure_losers";
        curTurn = "winners";
      } else {
        return {
          match: null,
          newBenchQueue: benchQueue,
          newWinnersQueue: winnersQueue,
          newLosersQueue: losersQueue,
          nextQueueTurn,
          assignedPlayerIds: []
        };
      }
    } else {
      if (curLosers.length >= 4) {
        arrivalOrder = curLosers.slice(0, 4);
        curLosers = curLosers.slice(4);
        matchType = "pure_losers";
        curTurn = "winners";
      } else if (curLosers.length > 0 && curLosers.length + curWinners.length >= 4) {
        const poppedLosers = [...curLosers];
        const neededFromWinners = 4 - poppedLosers.length;
        const poppedWinners = curWinners.slice(0, neededFromWinners);
        arrivalOrder = [...poppedLosers, ...poppedWinners];
        curLosers = [];
        curWinners = curWinners.slice(neededFromWinners);
        matchType = "move_up";
        curTurn = "winners";
      } else if (curLosers.length === 0 && curWinners.length >= 4) {
        arrivalOrder = curWinners.slice(0, 4);
        curWinners = curWinners.slice(4);
        matchType = "pure_winners";
        curTurn = "losers";
      } else {
        return {
          match: null,
          newBenchQueue: benchQueue,
          newWinnersQueue: winnersQueue,
          newLosersQueue: losersQueue,
          nextQueueTurn,
          assignedPlayerIds: []
        };
      }
    }
  }
  const { team1, team2 } = getSplitTeams(arrivalOrder, "14_vs_23");
  const match: OpenPlayMatch = {
    id: `op-match-${Date.now()}-${courtNumber}`,
    matchNumber: matchCounter,
    courtNumber,
    team1,
    team2,
    score1: 0,
    score2: 0,
    status: "in_progress",
    startedAt: Date.now(),
    arrivalOrder,
    matchType,
    partnerSplitMode: "14_vs_23",
    movedUpPlayerIds: movedUpPlayerIds.length > 0 ? movedUpPlayerIds : void 0
  };
  return {
    match,
    newBenchQueue: curBench,
    newWinnersQueue: curWinners,
    newLosersQueue: curLosers,
    nextQueueTurn: curTurn,
    assignedPlayerIds: arrivalOrder
  };
}
export function completeOpenPlayMatchWithBuckets(
  match: OpenPlayMatch,
  score1: number,
  score2: number,
  winnersQueue: string[],
  losersQueue: string[],
  restingBench: string[],
  playerRegistry: Record<string, OpenPlayPlayer>,
  _benchRotationRule?: string,
  _manualBenchCandidateId?: string
) {
  const isTeam1Winner = score1 > score2;
  const isTeam2Winner = score2 > score1;
  const isDraw = score1 === score2;
  let winnerIds: string[] = [];
  let loserIds: string[] = [];
  let winner: 1 | 2 | "draw" = "draw";
  if (isTeam1Winner) {
    winner = 1;
    winnerIds = [...match.team1];
    loserIds = [...match.team2];
  } else if (isTeam2Winner) {
    winner = 2;
    winnerIds = [...match.team2];
    loserIds = [...match.team1];
  } else {
    winner = "draw";
    winnerIds = [...match.team1];
    loserIds = [...match.team2];
  }
  const updatedRegistry = { ...playerRegistry };
  const now = Date.now();
  winnerIds.forEach((id, index) => {
    const p = updatedRegistry[id] || {
      id,
      name: "Player",
      avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
      joinedQueueAt: now,
      status: "waiting",
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestStreak: 0
    };
    const newWins = isDraw ? p.wins : p.wins + 1;
    const newStreak = isDraw ? p.currentStreak : p.currentStreak + 1;
    const bestStreak = Math.max(p.bestStreak, newStreak);
    updatedRegistry[id] = {
      ...p,
      status: "waiting",
      bucket: "winners",
      courtAssigned: null,
      gamesPlayed: p.gamesPlayed + 1,
      wins: newWins,
      currentStreak: newStreak,
      bestStreak
    };
  });
  loserIds.forEach((id) => {
    const p = updatedRegistry[id] || {
      id,
      name: "Player",
      avatarColor: AVATAR_COLORS[1],
      joinedQueueAt: now,
      status: "waiting",
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestStreak: 0
    };
    updatedRegistry[id] = {
      ...p,
      status: "waiting",
      bucket: "losers",
      courtAssigned: null,
      gamesPlayed: p.gamesPlayed + 1,
      losses: isDraw ? p.losses : p.losses + 1,
      currentStreak: 0
    };
  });
  const newWinnersQueue = [...winnersQueue.filter((id: string) => !winnerIds.includes(id)), ...winnerIds];
  const newLosersQueue = [...losersQueue.filter((id: string) => !loserIds.includes(id)), ...loserIds];
  const nextRestingBench = [...restingBench];
  const completedMatch: OpenPlayMatch = {
    ...match,
    score1,
    score2,
    completedAt: now,
    status: "completed",
    winner,
    winnerIds,
    loserIds
  };
  const winnerPlayerNames = winnerIds.map((id) => updatedRegistry[id]?.name || "Player");
  const loserPlayerNames = loserIds.map((id) => updatedRegistry[id]?.name || "Player");
  return {
    completedMatch,
    newWinnersQueue,
    newLosersQueue,
    newRestingBench: nextRestingBench,
    updatedPlayers: updatedRegistry,
    winnerPlayerNames,
    loserPlayerNames
  };
}
export function dispatchAvailableCourtsWithBuckets(
  courtsCount: number,
  activeMatches: Record<number, OpenPlayMatch>,
  benchQueue: string[],
  winnersQueue: string[],
  losersQueue: string[],
  nextQueueTurn: "winners" | "losers" = "winners",
  startMatchCounter: number = 1,
  format: "doubles" | "singles" = "doubles"
) {
  let curBench = [...benchQueue];
  let curWinners = [...winnersQueue];
  let curLosers = [...losersQueue];
  let curTurn = nextQueueTurn;
  const newMatches: OpenPlayMatch[] = [];
  const updatedActive = { ...activeMatches };
  let matchCounter = startMatchCounter;
  for (let courtNum = 1; courtNum <= courtsCount; courtNum++) {
    if (!updatedActive[courtNum] || updatedActive[courtNum].status === "completed") {
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
    newMatchCounter: matchCounter
  };
}

