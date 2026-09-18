import React, { useState } from 'react';
import { Player, Round } from '../types';
import { getHeadToHeadRecords } from '../utils/fairRotation';
import { Swords, Users, Trophy } from 'lucide-react';

interface HeadToHeadTrackerProps {
  players: Player[];
  rounds: Round[];
}

export const HeadToHeadTracker: React.FC<HeadToHeadTrackerProps> = ({
  players,
  rounds,
}) => {
  const activePlayers = players.filter((p) => p.active);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    activePlayers[0]?.id || ''
  );
  const [filter, setFilter] = useState<'all' | 'faced' | 'unfaced'>('all');

  const headToHeadRecords = getHeadToHeadRecords(players, rounds);

  const inspectedPlayer =
    activePlayers.find((p) => p.id === selectedPlayerId) || activePlayers[0];

  const playerH2H = inspectedPlayer ? headToHeadRecords[inspectedPlayer.id] || {} : {};
  const otherActivePlayers = inspectedPlayer
    ? activePlayers.filter((p) => p.id !== inspectedPlayer.id)
    : [];

  const totalWins = otherActivePlayers.reduce(
    (sum, other) => sum + (playerH2H[other.id]?.wins || 0),
    0
  );
  const totalLosses = otherActivePlayers.reduce(
    (sum, other) => sum + (playerH2H[other.id]?.losses || 0),
    0
  );
  const totalFaced = otherActivePlayers.filter(
    (other) => (playerH2H[other.id]?.timesFaced || 0) > 0
  ).length;
  const totalUnfaced = otherActivePlayers.length - totalFaced;

  const filteredOpponents = otherActivePlayers.filter((other) => {
    const times = playerH2H[other.id]?.timesFaced || 0;
    if (filter === 'faced') return times > 0;
    if (filter === 'unfaced') return times === 0;
    return true;
  });

  if (activePlayers.length < 2) {
    return (
      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
        <Users className="w-8 h-8 mx-auto text-slate-400" />
        <h4 className="font-bold text-slate-800 text-sm">Need at least 2 active players</h4>
        <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
          Add at least 2 active players to track head-to-head records.
        </p>
      </div>
    );
  }

  return (
    <div id="head-to-head-tracker" className="space-y-4">
      {/* Top Header & Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-1.5 font-black text-indigo-950 text-xs sm:text-sm uppercase tracking-wider">
            <Swords className="w-4 h-4 text-indigo-600" />
            <span>Head to Head Records</span>
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
            Select any player to inspect their personal win-loss record and point differential against each opponent.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase">Player:</label>
          <select
            id="select-h2h-player"
            value={inspectedPlayer?.id || ''}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            className="text-xs font-bold bg-white text-slate-800 border border-slate-300 rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-600 focus:outline-none cursor-pointer"
          >
            {activePlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inspected Player Summary Card */}
      {inspectedPlayer && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-3">
            <span
              className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border border-white shadow-xs shrink-0 ${inspectedPlayer.avatarColor}`}
            >
              {inspectedPlayer.name.charAt(0)}
            </span>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-sm sm:text-base leading-snug truncate">
                {inspectedPlayer.name}
              </h3>
              <p className="text-[11px] font-semibold text-slate-500">
                Facing {otherActivePlayers.length} rivals in session
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block">Overall Record</span>
              <span className="text-xs sm:text-sm font-black text-slate-800">
                {totalWins}W - {totalLosses}L
              </span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block">Win Rate</span>
              <span className="text-xs sm:text-sm font-black text-indigo-600">
                {totalWins + totalLosses > 0
                  ? Math.round((totalWins / (totalWins + totalLosses)) * 100)
                  : 0}
                %
              </span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 block">Opponents Faced</span>
              <span className="text-xs sm:text-sm font-black text-amber-700">
                {totalFaced} / {otherActivePlayers.length}
              </span>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All ({otherActivePlayers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('faced')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                filter === 'faced'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Faced ({totalFaced})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unfaced')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                filter === 'unfaced'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Unfaced ({totalUnfaced})
            </button>
          </div>

          {/* Opponent Records Grid/List */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {filteredOpponents.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 font-semibold bg-white rounded-xl border border-slate-200">
                No opponents match this filter.
              </div>
            ) : (
              filteredOpponents.map((other) => {
                const rec = playerH2H[other.id] || {
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
                const hasFaced = rec.timesFaced > 0;

                return (
                  <div
                    key={other.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                      hasFaced
                        ? 'bg-white border-slate-200 hover:border-slate-300'
                        : 'bg-amber-50/50 border-amber-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0 ${other.avatarColor}`}
                      >
                        {other.name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{other.name}</div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {hasFaced ? (
                            <span>
                              {rec.timesFaced} game{rec.timesFaced === 1 ? '' : 's'} faced
                            </span>
                          ) : (
                            <span className="text-amber-700 font-bold">Never faced on court</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {hasFaced ? (
                        <div>
                          <div className="font-black text-slate-900 text-xs">
                            <span className="text-indigo-600">{rec.wins}W</span> -{' '}
                            <span className="text-rose-600">{rec.losses}L</span>
                            {rec.ties > 0 && <span className="text-slate-500"> - {rec.ties}T</span>}
                          </div>
                          <div className="text-[10px] text-slate-500 font-semibold">
                            Diff:{' '}
                            <span
                              className={
                                rec.pointDiff > 0
                                  ? 'text-indigo-600 font-bold'
                                  : rec.pointDiff < 0
                                  ? 'text-rose-600 font-bold'
                                  : 'text-slate-500 font-bold'
                              }
                            >
                              {rec.pointDiff > 0 ? `+${rec.pointDiff}` : rec.pointDiff}
                            </span>{' '}
                            ({rec.winRate}%)
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                          Unfaced
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
