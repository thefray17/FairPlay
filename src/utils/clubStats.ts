import { PlayerProfile, StandingsRow } from '../types';
import { SessionData } from './sessionSync';

export interface ClubLeaderboardRow extends StandingsRow {
  playerProfileId: string;
  totalSessionsPlayed: number;
}

export interface PersonalMatchRecord {
  matchId: string;
  sessionId: string;
  sessionName: string;
  sport: string;
  courtNumber?: number;
  timestamp: number;
  partnerNames: string[];
  opponentNames: string[];
  userTeamScore: number;
  opponentTeamScore: number;
  result: 'W' | 'L' | 'D' | 'in_progress';
  sessionType: 'social' | 'open_play' | 'tournament';
}

/**
 * Aggregates career statistics across every session belonging to a Club,
 * keyed by persistent playerProfileId.
 */
export function calculateClubLeaderboard(
  sessions: SessionData[],
  profilesMap: Record<string, PlayerProfile> = {}
): ClubLeaderboardRow[] {
  const statsMap: Record<
    string,
    {
      playerProfileId: string;
      name: string;
      avatarColor: string;
      matchesPlayed: number;
      won: number;
      lost: number;
      tied: number;
      pointsFor: number;
      pointsAgainst: number;
      recentForm: ('W' | 'L' | 'D')[];
      sessionIds: Set<string>;
    }
  > = {};

  // Initialize known member profiles
  Object.values(profilesMap).forEach((profile) => {
    if (profile && profile.id) {
      statsMap[profile.id] = {
        playerProfileId: profile.id,
        name: profile.name || 'Player',
        avatarColor: profile.avatarColor || 'bg-indigo-500 text-white',
        matchesPlayed: 0,
        won: 0,
        lost: 0,
        tied: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        recentForm: [],
        sessionIds: new Set(),
      };
    }
  });

  // Iterate over each session
  sessions.forEach((session) => {
    if (!session) return;
    const sessionId = session.id || 'unknown';

    // Map session player ID to playerProfileId
    const localPlayerMap: Record<string, { profileId: string; name: string; avatarColor: string }> = {};

    if (Array.isArray(session.players)) {
      session.players.forEach((p) => {
        if (p && p.id) {
          const profId = p.playerProfileId || p.id;
          localPlayerMap[p.id] = {
            profileId: profId,
            name: p.name || 'Player',
            avatarColor: p.avatarColor || 'bg-indigo-500 text-white',
          };
        }
      });
    }

    if (session.openPlay?.players && Array.isArray(session.openPlay.players)) {
      session.openPlay.players.forEach((p) => {
        if (p && p.id) {
          const profId = p.playerProfileId || p.id;
          localPlayerMap[p.id] = {
            profileId: profId,
            name: p.name || 'Player',
            avatarColor: p.avatarColor || 'bg-indigo-500 text-white',
          };
        }
      });
    }

    const ensureEntry = (profId: string, fallbackName: string, fallbackAvatar: string) => {
      if (!statsMap[profId]) {
        const profile = profilesMap[profId];
        statsMap[profId] = {
          playerProfileId: profId,
          name: profile?.name || fallbackName || 'Player',
          avatarColor: profile?.avatarColor || fallbackAvatar || 'bg-indigo-500 text-white',
          matchesPlayed: 0,
          won: 0,
          lost: 0,
          tied: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          recentForm: [],
          sessionIds: new Set(),
        };
      }
      statsMap[profId].sessionIds.add(sessionId);
      return statsMap[profId];
    };

    // 1. Process Social & Tournament rounds
    if (Array.isArray(session.rounds)) {
      session.rounds.forEach((round) => {
        if (!round || !Array.isArray(round.matches)) return;
        round.matches.forEach((match) => {
          if (!match.completed) return;

          const team1PlayerIds = match.team1?.playerIds || [];
          const team2PlayerIds = match.team2?.playerIds || [];
          const score1 = match.score1 ?? 0;
          const score2 = match.score2 ?? 0;

          if (score1 === 0 && score2 === 0) return;

          const winner = match.winner || (score1 > score2 ? 1 : score2 > score1 ? 2 : 'draw');

          // Process team 1
          team1PlayerIds.forEach((pId) => {
            const info = localPlayerMap[pId] || { profileId: pId, name: pId, avatarColor: 'bg-indigo-500 text-white' };
            const entry = ensureEntry(info.profileId, info.name, info.avatarColor);
            entry.matchesPlayed += 1;
            entry.pointsFor += score1;
            entry.pointsAgainst += score2;
            if (winner === 1) {
              entry.won += 1;
              entry.recentForm.push('W');
            } else if (winner === 2) {
              entry.lost += 1;
              entry.recentForm.push('L');
            } else {
              entry.tied += 1;
              entry.recentForm.push('D');
            }
          });

          // Process team 2
          team2PlayerIds.forEach((pId) => {
            const info = localPlayerMap[pId] || { profileId: pId, name: pId, avatarColor: 'bg-indigo-500 text-white' };
            const entry = ensureEntry(info.profileId, info.name, info.avatarColor);
            entry.matchesPlayed += 1;
            entry.pointsFor += score2;
            entry.pointsAgainst += score1;
            if (winner === 2) {
              entry.won += 1;
              entry.recentForm.push('W');
            } else if (winner === 1) {
              entry.lost += 1;
              entry.recentForm.push('L');
            } else {
              entry.tied += 1;
              entry.recentForm.push('D');
            }
          });
        });
      });
    }

    // 2. Process Open Play match history
    if (session.openPlay?.history && Array.isArray(session.openPlay.history)) {
      session.openPlay.history.forEach((m: any) => {
        if (m.status !== 'completed') return;
        const team1 = Array.isArray(m.team1) ? m.team1 : [];
        const team2 = Array.isArray(m.team2) ? m.team2 : [];
        const score1 = m.score1 ?? 0;
        const score2 = m.score2 ?? 0;
        const winner = m.winner || (score1 > score2 ? 1 : score2 > score1 ? 2 : 'draw');

        team1.forEach((pId: string) => {
          const info = localPlayerMap[pId] || { profileId: pId, name: pId, avatarColor: 'bg-emerald-600 text-white' };
          const entry = ensureEntry(info.profileId, info.name, info.avatarColor);
          entry.matchesPlayed += 1;
          entry.pointsFor += score1;
          entry.pointsAgainst += score2;
          if (winner === 1) {
            entry.won += 1;
            entry.recentForm.push('W');
          } else if (winner === 2) {
            entry.lost += 1;
            entry.recentForm.push('L');
          } else {
            entry.tied += 1;
            entry.recentForm.push('D');
          }
        });

        team2.forEach((pId: string) => {
          const info = localPlayerMap[pId] || { profileId: pId, name: pId, avatarColor: 'bg-emerald-600 text-white' };
          const entry = ensureEntry(info.profileId, info.name, info.avatarColor);
          entry.matchesPlayed += 1;
          entry.pointsFor += score2;
          entry.pointsAgainst += score1;
          if (winner === 2) {
            entry.won += 1;
            entry.recentForm.push('W');
          } else if (winner === 1) {
            entry.lost += 1;
            entry.recentForm.push('L');
          } else {
            entry.tied += 1;
            entry.recentForm.push('D');
          }
        });
      });
    }
  });

  // Convert to StandingsRow array and sort
  const rows: ClubLeaderboardRow[] = Object.values(statsMap).map((entry) => {
    const pointDiff = entry.pointsFor - entry.pointsAgainst;
    const winRate = entry.matchesPlayed > 0 ? Math.round((entry.won / entry.matchesPlayed) * 100) : 0;
    const recentForm = entry.recentForm.slice(-5);

    return {
      playerId: entry.playerProfileId,
      playerProfileId: entry.playerProfileId,
      playerName: entry.name,
      avatarColor: entry.avatarColor,
      matchesPlayed: entry.matchesPlayed,
      won: entry.won,
      lost: entry.lost,
      tied: entry.tied,
      pointsFor: entry.pointsFor,
      pointsAgainst: entry.pointsAgainst,
      pointDiff,
      winRate,
      recentForm,
      form: recentForm,
      active: true,
      totalSessionsPlayed: entry.sessionIds.size,
    };
  });

  // Sort by Win Rate -> Points Diff -> Matches Won -> Matches Played
  rows.sort((a, b) => {
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    if (b.won !== a.won) return b.won - a.won;
    return b.matchesPlayed - a.matchesPlayed;
  });

  return rows;
}

/**
 * Extracts a personal list of matches for a specific player profile ID across all sessions.
 */
export function extractPersonalMatches(
  sessions: SessionData[],
  targetProfileId: string
): PersonalMatchRecord[] {
  if (!targetProfileId) return [];

  const results: PersonalMatchRecord[] = [];

  sessions.forEach((session) => {
    if (!session) return;
    const sessionId = session.id || 'unknown';
    const sessionName = session.config?.sessionName || session.openPlay?.config?.sessionName || `Session #${sessionId}`;
    const sport = session.config?.sport || session.openPlay?.config?.sport || 'badminton';

    // Map player IDs to profile IDs & names
    const playerMap: Record<string, { profileId: string; name: string }> = {};
    if (Array.isArray(session.players)) {
      session.players.forEach((p) => {
        if (p && p.id) {
          playerMap[p.id] = {
            profileId: p.playerProfileId || p.id,
            name: p.name || 'Player',
          };
        }
      });
    }
    if (session.openPlay?.players && Array.isArray(session.openPlay.players)) {
      session.openPlay.players.forEach((p) => {
        if (p && p.id) {
          playerMap[p.id] = {
            profileId: p.playerProfileId || p.id,
            name: p.name || 'Player',
          };
        }
      });
    }

    // 1. Social & Tournament rounds
    if (Array.isArray(session.rounds)) {
      session.rounds.forEach((round) => {
        if (!round || !Array.isArray(round.matches)) return;
        round.matches.forEach((match) => {
          const team1Ids = match.team1?.playerIds || [];
          const team2Ids = match.team2?.playerIds || [];

          const inTeam1 = team1Ids.some((id) => playerMap[id]?.profileId === targetProfileId || id === targetProfileId);
          const inTeam2 = team2Ids.some((id) => playerMap[id]?.profileId === targetProfileId || id === targetProfileId);

          if (!inTeam1 && !inTeam2) return;

          const userTeam = inTeam1 ? team1Ids : team2Ids;
          const oppTeam = inTeam1 ? team2Ids : team1Ids;
          const userScore = inTeam1 ? match.score1 : match.score2;
          const oppScore = inTeam1 ? match.score2 : match.score1;

          const partnerNames = userTeam
            .filter((id) => (playerMap[id]?.profileId || id) !== targetProfileId)
            .map((id) => playerMap[id]?.name || id);

          const opponentNames = oppTeam.map((id) => playerMap[id]?.name || id);

          let result: 'W' | 'L' | 'D' | 'in_progress' = 'in_progress';
          if (match.completed) {
            if (userScore > oppScore) result = 'W';
            else if (oppScore > userScore) result = 'L';
            else result = 'D';
          }

          results.push({
            matchId: match.id || `${round.roundNumber}-${match.courtNumber || 1}`,
            sessionId,
            sessionName,
            sport,
            courtNumber: match.courtNumber,
            timestamp: match.finishedAt || match.startedAt || round.generatedAt || session.createdAt || Date.now(),
            partnerNames,
            opponentNames,
            userTeamScore: userScore,
            opponentTeamScore: oppScore,
            result,
            sessionType: session.config?.tournamentMode?.enabled ? 'tournament' : 'social',
          });
        });
      });
    }

    // 2. Open Play history
    if (session.openPlay?.history && Array.isArray(session.openPlay.history)) {
      session.openPlay.history.forEach((m: any) => {
        const team1 = Array.isArray(m.team1) ? m.team1 : [];
        const team2 = Array.isArray(m.team2) ? m.team2 : [];

        const inTeam1 = team1.some((id: string) => playerMap[id]?.profileId === targetProfileId || id === targetProfileId);
        const inTeam2 = team2.some((id: string) => playerMap[id]?.profileId === targetProfileId || id === targetProfileId);

        if (!inTeam1 && !inTeam2) return;

        const userTeam = inTeam1 ? team1 : team2;
        const oppTeam = inTeam1 ? team2 : team1;
        const userScore = inTeam1 ? m.score1 : m.score2;
        const oppScore = inTeam1 ? m.score2 : m.score1;

        const partnerNames = userTeam
          .filter((id: string) => (playerMap[id]?.profileId || id) !== targetProfileId)
          .map((id: string) => playerMap[id]?.name || id);

        const opponentNames = oppTeam.map((id: string) => playerMap[id]?.name || id);

        let result: 'W' | 'L' | 'D' | 'in_progress' = 'in_progress';
        if (m.status === 'completed') {
          if (userScore > oppScore) result = 'W';
          else if (oppScore > userScore) result = 'L';
          else result = 'D';
        }

        results.push({
          matchId: m.id || `op-${m.matchNumber}`,
          sessionId,
          sessionName,
          sport,
          courtNumber: m.courtNumber,
          timestamp: m.completedAt || m.startedAt || session.createdAt || Date.now(),
          partnerNames,
          opponentNames,
          userTeamScore: userScore,
          opponentTeamScore: oppScore,
          result,
          sessionType: 'open_play',
        });
      });
    }
  });

  // Sort latest first
  results.sort((a, b) => b.timestamp - a.timestamp);
  return results;
}
