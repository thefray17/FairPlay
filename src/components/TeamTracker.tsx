import React, { useState } from 'react';
import { Player, Round } from '../types';
import { getTeamVsTeamRecord, getPastTeamMatchups } from '../utils/fairRotation';
import {
  Users,
  ArrowRightLeft,
  Swords,
  Trophy,
  History,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';

interface TeamTrackerProps {
  players: Player[];
  rounds: Round[];
  compact?: boolean;
}

export const TeamTracker: React.FC<TeamTrackerProps> = ({
  players,
  rounds,
  compact = false,
}) => {
  const activePlayers = players.filter((p) => p.active);
  const pastMatchups = getPastTeamMatchups(rounds);

  // Selected player IDs
  const [teamA1, setTeamA1] = useState<string>('');
  const [teamA2, setTeamA2] = useState<string>('');
  const [teamB1, setTeamB1] = useState<string>('');
  const [teamB2, setTeamB2] = useState<string>('');

  // Fallback defaults to ensure distinct 4 players
  const currentA1 =
    teamA1 && activePlayers.some((p) => p.id === teamA1)
      ? teamA1
      : activePlayers[0]?.id || '';

  const currentA2 =
    teamA2 && activePlayers.some((p) => p.id === teamA2) && teamA2 !== currentA1
      ? teamA2
      : activePlayers.find((p) => p.id !== currentA1)?.id || '';

  const currentB1 =
    teamB1 &&
    activePlayers.some((p) => p.id === teamB1) &&
    teamB1 !== currentA1 &&
    teamB1 !== currentA2
      ? teamB1
      : activePlayers.find((p) => p.id !== currentA1 && p.id !== currentA2)?.id || '';

  const currentB2 =
    teamB2 &&
    activePlayers.some((p) => p.id === teamB2) &&
    teamB2 !== currentA1 &&
    teamB2 !== currentA2 &&
    teamB2 !== currentB1
      ? teamB2
      : activePlayers.find(
          (p) =>
            p.id !== currentA1 &&
            p.id !== currentA2 &&
            p.id !== currentB1
        )?.id || '';

  // Handler to pick a player and avoid duplicate assignments
  const handleSelectPlayer = (slot: 'a1' | 'a2' | 'b1' | 'b2', newId: string) => {
    let a1 = slot === 'a1' ? newId : currentA1;
    let a2 = slot === 'a2' ? newId : currentA2;
    let b1 = slot === 'b1' ? newId : currentB1;
    let b2 = slot === 'b2' ? newId : currentB2;

    const used = new Set<string>();
    const resolveDistinct = (id: string) => {
      if (id && !used.has(id) && activePlayers.some((p) => p.id === id)) {
        used.add(id);
        return id;
      }
      const nextAvailable = activePlayers.find((p) => !used.has(p.id))?.id || '';
      if (nextAvailable) used.add(nextAvailable);
      return nextAvailable;
    };

    if (slot === 'a1') {
      used.add(a1);
      a2 = resolveDistinct(a2);
      b1 = resolveDistinct(b1);
      b2 = resolveDistinct(b2);
    } else if (slot === 'a2') {
      used.add(a2);
      a1 = resolveDistinct(a1);
      b1 = resolveDistinct(b1);
      b2 = resolveDistinct(b2);
    } else if (slot === 'b1') {
      used.add(b1);
      a1 = resolveDistinct(a1);
      a2 = resolveDistinct(a2);
      b2 = resolveDistinct(b2);
    } else if (slot === 'b2') {
      used.add(b2);
      a1 = resolveDistinct(a1);
      a2 = resolveDistinct(a2);
      b1 = resolveDistinct(b1);
    }

    setTeamA1(a1);
    setTeamA2(a2);
    setTeamB1(b1);
    setTeamB2(b2);
  };

  const handleSwapTeams = () => {
    setTeamA1(currentB1);
    setTeamA2(currentB2);
    setTeamB1(currentA1);
    setTeamB2(currentA2);
  };

  // Quick load from past match
  const handleSelectPastMatchup = (comboKey: string) => {
    const found = pastMatchups.find((m) => m.key === comboKey);
    if (!found) return;
    setTeamA1(found.team1Ids[0]);
    setTeamA2(found.team1Ids[1]);
    setTeamB1(found.team2Ids[0]);
    setTeamB2(found.team2Ids[1]);
  };

  // Lookup player objects
  const pA1 = players.find((p) => p.id === currentA1);
  const pA2 = players.find((p) => p.id === currentA2);
  const pB1 = players.find((p) => p.id === currentB1);
  const pB2 = players.find((p) => p.id === currentB2);

  // Compute 2v2 stats
  const teamRecord = getTeamVsTeamRecord(
    [currentA1, currentA2],
    [currentB1, currentB2],
    rounds
  );

  if (activePlayers.length < 4) {
    return (
      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
        <Users className="w-8 h-8 mx-auto text-slate-400" />
        <h4 className="font-bold text-slate-800 text-sm">Need at least 4 active players</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
          Add at least 4 active players to track team matchup standings.
        </p>
      </div>
    );
  }

  return (
    <div id="team-tracker-container" className="space-y-4">
      {/* Top Controls: Simplistic Header & Quick Past Matchup Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-1.5 font-black text-indigo-950 text-xs sm:text-sm uppercase tracking-wider">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Team Matchups Standings</span>
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
            Pick 1st &amp; 2nd player for Team 1, then the 2 players for Team 2 to view their match-up record.
          </p>
        </div>

        {pastMatchups.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <History className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              id="select-quick-past-team-matchup"
              onChange={(e) => {
                if (e.target.value) handleSelectPastMatchup(e.target.value);
              }}
              className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-600 focus:outline-none cursor-pointer max-w-[220px] sm:max-w-xs truncate"
              defaultValue=""
            >
              <option value="" disabled>
                Select from {pastMatchups.length} previous match{pastMatchups.length === 1 ? '' : 'es'}...
              </option>
              {pastMatchups.map((m) => {
                const name1 = players.find((p) => p.id === m.team1Ids[0])?.name || 'P1';
                const name2 = players.find((p) => p.id === m.team1Ids[1])?.name || 'P2';
                const name3 = players.find((p) => p.id === m.team2Ids[0])?.name || 'P3';
                const name4 = players.find((p) => p.id === m.team2Ids[1])?.name || 'P4';
                return (
                  <option key={m.key} value={m.key}>
                    R{m.roundNumber} C{m.courtNumber}: {name1} &amp; {name2} vs {name3} &amp; {name4}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* Simplistic Team Picker Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
            Select Lineup
          </span>
          <button
            type="button"
            id="btn-swap-teams-tracker"
            onClick={handleSwapTeams}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
            title="Swap Team 1 and Team 2"
            aria-label="Swap Team 1 and Team 2"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Swap Teams</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-11 gap-2.5 sm:gap-3 items-center">
          {/* Team 1 Card */}
          <div className="md:col-span-5 bg-indigo-50/70 border border-indigo-100 rounded-xl sm:rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                Team 1
              </span>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                {pA1?.name || 'P1'} &amp; {pA2?.name || 'P2'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  1st Player:
                </label>
                <select
                  id="select-team-a1"
                  value={currentA1}
                  onChange={(e) => handleSelectPlayer('a1', e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-600 focus:outline-none cursor-pointer"
                >
                  {activePlayers.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={p.id === currentA2 || p.id === currentB1 || p.id === currentB2}
                    >
                      {p.name} {p.id === currentA2 ? '(Team 1)' : (p.id === currentB1 || p.id === currentB2) ? '(Team 2)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  2nd Player:
                </label>
                <select
                  id="select-team-a2"
                  value={currentA2}
                  onChange={(e) => handleSelectPlayer('a2', e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 bg-white border border-indigo-200 rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-600 focus:outline-none cursor-pointer"
                >
                  {activePlayers.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={p.id === currentA1 || p.id === currentB1 || p.id === currentB2}
                    >
                      {p.name} {p.id === currentA1 ? '(Team 1)' : (p.id === currentB1 || p.id === currentB2) ? '(Team 2)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* VS Divider */}
          <div className="md:col-span-1 flex flex-col items-center justify-center py-0.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 text-slate-700 font-black text-xs flex items-center justify-center shadow-2xs">
              VS
            </div>
          </div>

          {/* Team 2 Card */}
          <div className="md:col-span-5 bg-rose-50/70 border border-rose-100 rounded-xl sm:rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-xs text-rose-950 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                Team 2
              </span>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md">
                {pB1?.name || 'P3'} &amp; {pB2?.name || 'P4'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  1st Opponent:
                </label>
                <select
                  id="select-team-b1"
                  value={currentB1}
                  onChange={(e) => handleSelectPlayer('b1', e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 bg-white border border-rose-200 rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-rose-600 focus:outline-none cursor-pointer"
                >
                  {activePlayers.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={p.id === currentB2 || p.id === currentA1 || p.id === currentA2}
                    >
                      {p.name} {p.id === currentB2 ? '(Team 2)' : (p.id === currentA1 || p.id === currentA2) ? '(Team 1)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  2nd Opponent:
                </label>
                <select
                  id="select-team-b2"
                  value={currentB2}
                  onChange={(e) => handleSelectPlayer('b2', e.target.value)}
                  className="w-full text-xs font-bold text-slate-800 bg-white border border-rose-200 rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-rose-600 focus:outline-none cursor-pointer"
                >
                  {activePlayers.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={p.id === currentB1 || p.id === currentA1 || p.id === currentA2}
                    >
                      {p.name} {p.id === currentB1 ? '(Team 2)' : (p.id === currentA1 || p.id === currentA2) ? '(Team 1)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Standings Results Section */}
      {teamRecord.timesFaced === 0 ? (
        <div className="border border-slate-200 rounded-2xl p-5 sm:p-6 bg-slate-50/80 text-center space-y-2.5">
          <div className="w-9 h-9 mx-auto rounded-full bg-slate-200/80 text-slate-600 flex items-center justify-center font-black text-xs">
            0x
          </div>
          <div>
            <h4 className="font-black text-slate-900 text-sm">No Matches Played Yet</h4>
            <p className="text-xs text-slate-600 font-medium max-w-md mx-auto mt-0.5">
              <strong>{pA1?.name || 'Player 1'} &amp; {pA2?.name || 'Player 2'}</strong> have not faced{' '}
              <strong>{pB1?.name || 'Player 3'} &amp; {pB2?.name || 'Player 4'}</strong> in this session yet.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200/80 text-slate-800 font-bold text-[11px]">
            Standings: 0 Wins - 0 Losses (0 Matches)
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Main Scoreboard Display */}
          <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-3 border-b border-slate-800 pb-2">
              <span className="uppercase tracking-wider">Head-to-Head Standings</span>
              <span>
                {teamRecord.completedMatches} Completed Match{teamRecord.completedMatches === 1 ? '' : 'es'}
              </span>
            </div>

            <div className="grid grid-cols-7 items-center gap-2">
              {/* Team 1 Wins */}
              <div className="col-span-3 text-left space-y-1">
                <div className="font-bold text-indigo-300 text-xs truncate">
                  {pA1?.name} &amp; {pA2?.name}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-white">
                    {teamRecord.team1Wins}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {teamRecord.team1Wins === 1 ? 'WIN' : 'WINS'}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-400">
                  {teamRecord.team1Points} pts ({teamRecord.winRateTeam1}%)
                </div>
              </div>

              {/* Center VS */}
              <div className="col-span-1 text-center">
                <span className="inline-block px-2 py-1 rounded-lg bg-slate-800 text-slate-400 font-black text-xs">
                  VS
                </span>
                {teamRecord.draws > 0 && (
                  <div className="text-[10px] font-bold text-slate-500 mt-1">
                    {teamRecord.draws} {teamRecord.draws === 1 ? 'Tie' : 'Ties'}
                  </div>
                )}
              </div>

              {/* Team 2 Wins */}
              <div className="col-span-3 text-right space-y-1">
                <div className="font-bold text-rose-300 text-xs truncate">
                  {pB1?.name} &amp; {pB2?.name}
                </div>
                <div className="flex items-baseline justify-end gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-white">
                    {teamRecord.team2Wins}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {teamRecord.team2Wins === 1 ? 'WIN' : 'WINS'}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-400">
                  {teamRecord.team2Points} pts ({teamRecord.winRateTeam2}%)
                </div>
              </div>
            </div>
          </div>

          {/* 3 Metrics Pills */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Times Faced</div>
              <div className="text-sm font-black text-slate-900 mt-0.5">{teamRecord.timesFaced}</div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Point Diff</div>
              <div className="text-sm font-black text-slate-900 mt-0.5">
                {teamRecord.pointDiff >= 0 ? `+${teamRecord.pointDiff}` : teamRecord.pointDiff}
              </div>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Total Points</div>
              <div className="text-sm font-black text-slate-900 mt-0.5">
                {teamRecord.team1Points + teamRecord.team2Points}
              </div>
            </div>
          </div>

          {/* Match Log Breakdown */}
          <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50/80 space-y-2">
            <div className="font-black text-slate-800 text-xs uppercase tracking-wider">
              Match History ({teamRecord.matches.length}):
            </div>

            <div className="space-y-1.5">
              {teamRecord.matches.map((m) => {
                const team1Won = m.winner === 1;
                const team2Won = m.winner === 2;

                return (
                  <div
                    key={m.matchId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md text-[10px] shrink-0">
                        R{m.roundNumber} • C{m.courtNumber}
                      </span>
                      {m.completed ? (
                        <span className="font-bold truncate text-slate-800">
                          {team1Won ? (
                            <span className="text-indigo-600 font-black">Team 1 Won</span>
                          ) : team2Won ? (
                            <span className="text-rose-600 font-black">Team 2 Won</span>
                          ) : (
                            <span className="text-slate-600 font-black">Tied Match</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-amber-700 bg-amber-100 font-bold px-2 py-0.5 rounded-md text-[10px] shrink-0">
                          In Progress
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black text-xs sm:text-sm text-slate-900 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                        {m.score1} - {m.score2}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
