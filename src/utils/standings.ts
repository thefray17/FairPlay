import { Match, Player, Round, StandingsRow } from '../types';

export function calculateStandings(
  players: Player[],
  rounds: Round[],
  filterRoundNumber?: number
): StandingsRow[] {
  // Map of stats by player id
  const stats: Record<
    string,
    {
      matchesPlayed: number;
      won: number;
      lost: number;
      tied: number;
      pointsFor: number;
      pointsAgainst: number;
      recentForm: ('W' | 'L' | 'D')[];
      recentFormDetails: { matchId: string; result: 'W' | 'L' | 'D' }[];
    }
  > = {};

  players.forEach((p) => {
    stats[p.id] = {
      matchesPlayed: 0,
      won: 0,
      lost: 0,
      tied: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      recentForm: [],
      recentFormDetails: [],
    };
  });

  const targetRounds = filterRoundNumber
    ? rounds.filter((r) => r.roundNumber === filterRoundNumber)
    : rounds;

  // Process matches in chronological order
  targetRounds.forEach((round) => {
    round.matches.forEach((match) => {
      // Include match if completed OR has scores entered
      const hasScores = match.score1 > 0 || match.score2 > 0 || match.completed;
      if (!hasScores) return;

      const team1Players = match.team1.playerIds;
      const team2Players = match.team2.playerIds;

      const score1 = match.score1 || 0;
      const score2 = match.score2 || 0;

      let result1: 'W' | 'L' | 'D' = 'D';
      let result2: 'W' | 'L' | 'D' = 'D';

      if (score1 > score2) {
        result1 = 'W';
        result2 = 'L';
      } else if (score2 > score1) {
        result1 = 'L';
        result2 = 'W';
      }

      // Update team 1 stats
      team1Players.forEach((pid) => {
        if (!stats[pid]) return;
        stats[pid].matchesPlayed += 1;
        stats[pid].pointsFor += score1;
        stats[pid].pointsAgainst += score2;
        if (result1 === 'W') stats[pid].won += 1;
        else if (result1 === 'L') stats[pid].lost += 1;
        else stats[pid].tied += 1;
        stats[pid].recentForm.push(result1);
        stats[pid].recentFormDetails.push({ matchId: match.id, result: result1 });
      });

      // Update team 2 stats
      team2Players.forEach((pid) => {
        if (!stats[pid]) return;
        stats[pid].matchesPlayed += 1;
        stats[pid].pointsFor += score2;
        stats[pid].pointsAgainst += score1;
        if (result2 === 'W') stats[pid].won += 1;
        else if (result2 === 'L') stats[pid].lost += 1;
        else stats[pid].tied += 1;
        stats[pid].recentForm.push(result2);
        stats[pid].recentFormDetails.push({ matchId: match.id, result: result2 });
      });
    });
  });

  const activePlayers = players.filter((p) => p.active);
  const playCounts = activePlayers.map((p) => (stats[p.id] ? stats[p.id].matchesPlayed : 0));
  const minPlayed = playCounts.length > 0 ? Math.min(...playCounts) : 0;
  const maxPlayed = playCounts.length > 0 ? Math.max(...playCounts) : 0;

  const rows: StandingsRow[] = players.map((p) => {
    const s = stats[p.id] || {
      matchesPlayed: 0,
      won: 0,
      lost: 0,
      tied: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      recentForm: [],
      recentFormDetails: [],
    };
    const pointDiff = s.pointsFor - s.pointsAgainst;
    const winRate =
      s.matchesPlayed > 0 ? Math.round((s.won / s.matchesPlayed) * 100) : 0;

    let fairnessStatus = 'Balanced';
    if (minPlayed === maxPlayed) {
      fairnessStatus = `Balanced (${s.matchesPlayed} GP)`;
    } else if (s.matchesPlayed < maxPlayed) {
      fairnessStatus = `Catching Up (-${maxPlayed - s.matchesPlayed} GP)`;
    } else {
      fairnessStatus = `Group Lead (${s.matchesPlayed} GP)`;
    }

    return {
      playerId: p.id,
      playerName: p.name,
      avatarColor: p.avatarColor,
      matchesPlayed: s.matchesPlayed,
      won: s.won,
      lost: s.lost,
      tied: s.tied,
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
      pointDiff,
      winRate,
      recentForm: s.recentForm.slice(-5), // last 5 results
      form: s.recentForm.slice(-5),
      recentFormDetails: s.recentFormDetails.slice(-5),
      active: p.active,
      fairnessStatus,
      cycleNumber: minPlayed + 1,
    };
  });

  // Sort standings:
  // 1. Most Wins DESC
  // 2. Highest Point Differential DESC
  // 3. Highest Points For DESC
  // 4. Lowest Matches Played (if tied on wins)
  // 5. Alphabetical by name
  rows.sort((a, b) => {
    if (b.won !== a.won) return b.won - a.won;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return a.playerName.localeCompare(b.playerName);
  });

  return rows;
}

/**
 * Format standings as clean text for sharing to WhatsApp, Reclub, or Discord club channels.
 */
export function formatStandingsForSharing(
  sessionName: string,
  standings: StandingsRow[],
  completedRounds: number
): string {
  const dateStr = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  let text = `🏆 *${sessionName.toUpperCase()} - STANDINGS*\n`;
  text += `📅 ${dateStr} • ${completedRounds} Rounds Completed\n`;
  text += `⚖️ Guaranteed Equal Match Rotation (FairClub)\n\n`;
  text += `Rank | Player | W-L | Diff | Win%\n`;
  text += `------------------------------------\n`;

  standings.forEach((row, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
    const diff = row.pointDiff > 0 ? `+${row.pointDiff}` : `${row.pointDiff}`;
    text += `${medal} ${row.playerName}: ${row.won}W-${row.lost}L (${diff} diff) • ${row.winRate}%\n`;
  });

  text += `\nGenerated with FairClub - Fair Match Equal Rotation & Standings`;
  return text;
}
