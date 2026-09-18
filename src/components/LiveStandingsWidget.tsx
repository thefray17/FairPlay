import React from 'react';
import { StandingsRow } from '../types';
import { Trophy, ArrowRight, Activity, ShieldCheck, Flame } from 'lucide-react';

interface LiveStandingsWidgetProps {
  standings: StandingsRow[];
  totalMatchesPlayed: number;
  onViewFullStandings: () => void;
}

export const LiveStandingsWidget: React.FC<LiveStandingsWidgetProps> = ({
  standings,
  totalMatchesPlayed,
  onViewFullStandings,
}) => {
  const topRows = standings.slice(0, 5);

  return (
    <div
      id="live-standings-widget"
      className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4"
    >
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-5 bg-yellow-400 rounded-full"></span>
            <Trophy className="w-5 h-5 text-indigo-900" />
            <h3 className="font-black text-lg text-indigo-950 tracking-tight">
              Automated Standings
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              Live Auto-Update
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Fairness principle active: tracks Games Played (GP), Wins/Losses, and Point Diff across all matches.
          </p>
        </div>

        <button
          type="button"
          id="btn-view-full-standings-widget"
          onClick={onViewFullStandings}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors cursor-pointer"
        >
          <span>Full Leaderboard</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {totalMatchesPlayed === 0 ? (
        <div className="py-6 text-center text-slate-500 text-xs">
          <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="font-bold">No completed matches yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            As soon as any court match score is recorded, standings update automatically!
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Player</th>
                <th className="py-2.5 px-3 text-center bg-indigo-50/50 text-indigo-900 rounded-t-lg">
                  GP
                </th>
                <th className="py-2.5 px-3 text-center">W - L</th>
                <th className="py-2.5 px-3 text-center">Win %</th>
                <th className="py-2.5 px-3 text-center">+/- Diff</th>
                <th className="py-2.5 px-3 text-right">Equal Play Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {topRows.map((row, index) => {
                const rank = index + 1;
                return (
                  <tr
                    key={row.playerId}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-3">
                      {rank === 1 ? (
                        <span className="w-6 h-6 rounded-full bg-yellow-400 text-indigo-950 font-black flex items-center justify-center text-xs shadow-2xs">
                          1
                        </span>
                      ) : rank === 2 ? (
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-black flex items-center justify-center text-xs">
                          2
                        </span>
                      ) : rank === 3 ? (
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-black flex items-center justify-center text-xs">
                          3
                        </span>
                      ) : (
                        <span className="text-slate-400 font-black ml-2">{rank}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border border-slate-200 shrink-0 ${row.avatarColor}`}
                      >
                        {row.playerName.charAt(0)}
                      </span>
                      <span className="truncate">{row.playerName}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-black text-indigo-900 bg-indigo-50/40">
                      {row.matchesPlayed}
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      <span className="text-emerald-700">{row.won}</span>
                      <span className="text-slate-300 mx-1">-</span>
                      <span className="text-rose-700">{row.lost}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-black text-slate-800">
                      {row.winRate}%
                    </td>
                    <td
                      className={`py-3 px-3 text-center font-black ${
                        row.pointDiff > 0
                          ? 'text-emerald-700'
                          : row.pointDiff < 0
                          ? 'text-rose-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        {row.fairnessStatus || `${row.matchesPlayed} GP`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
