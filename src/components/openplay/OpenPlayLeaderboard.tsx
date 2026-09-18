import React from 'react';
import { OpenPlayPlayer } from '../../types/openPlay';
import { Trophy, Flame, Award, Medal, Crown } from 'lucide-react';

interface OpenPlayLeaderboardProps {
  players: OpenPlayPlayer[];
}

export const OpenPlayLeaderboard: React.FC<OpenPlayLeaderboardProps> = ({ players }) => {
  // Sort players by: 1. Current streak desc, 2. Wins desc, 3. Games played desc
  const ranked = [...players].sort((a, b) => {
    if (b.currentStreak !== a.currentStreak) return b.currentStreak - a.currentStreak;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.gamesPlayed - a.gamesPlayed;
  });

  const getWinRate = (p: OpenPlayPlayer) => {
    if (p.gamesPlayed === 0) return 0;
    return Math.round((p.wins / p.gamesPlayed) * 100);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black shrink-0">
            <Trophy className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">King of the Court Leaderboard</h2>
            <p className="text-xs text-slate-500 font-semibold">
              Live streaks &amp; win records from Open Play matches
            </p>
          </div>
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <Award className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">No players recorded yet</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Player statistics will update in real time as matches finish!
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card List (visible on screens < sm) */}
          <div className="block sm:hidden divide-y divide-slate-100">
            {ranked.map((p, idx) => {
              const winRate = getWinRate(p);
              const isFirst = idx === 0 && p.wins > 0;

              return (
                <div
                  key={p.id}
                  className={`p-3.5 flex items-center justify-between gap-3 ${
                    isFirst ? 'bg-amber-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Rank Badge */}
                    <div className="w-6 text-center shrink-0">
                      {idx === 0 && p.wins > 0 ? (
                        <Crown className="w-4 h-4 text-amber-500 mx-auto fill-amber-400" />
                      ) : idx === 1 && p.wins > 0 ? (
                        <Medal className="w-4 h-4 text-slate-400 mx-auto" />
                      ) : idx === 2 && p.wins > 0 ? (
                        <Medal className="w-4 h-4 text-amber-700 mx-auto" />
                      ) : (
                        <span className="font-mono font-bold text-slate-400 text-xs">
                          #{idx + 1}
                        </span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 ${p.avatarColor}`}
                    >
                      {p.name.charAt(0)}
                    </div>

                    {/* Name & Streak */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-slate-900 text-sm truncate">
                          {p.name}
                        </span>
                        {p.status === 'playing' && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 shrink-0">
                            On Court
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold mt-0.5">
                        <span className="text-emerald-700 font-bold">{p.wins}W</span>
                        <span>-</span>
                        <span className="text-rose-600 font-bold">{p.losses}L</span>
                        <span>•</span>
                        <span>{p.gamesPlayed} games</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Streak / Win Rate Pill */}
                  <div className="text-right shrink-0">
                    {p.currentStreak > 1 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                        <Flame className="w-3 h-3 fill-amber-500 text-amber-500" />
                        {p.currentStreak}W streak
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-700">
                        {p.gamesPlayed > 0 ? `${winRate}% win` : '-'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (visible on sm+) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] font-black uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">Rank</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4 text-center">Current Streak</th>
                  <th className="py-3 px-4 text-center">Best Streak</th>
                  <th className="py-3 px-4 text-center">Record (W - L)</th>
                  <th className="py-3 px-4 text-center">Win Rate</th>
                  <th className="py-3 px-4 text-center">Total Games</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranked.map((p, idx) => {
                  const winRate = getWinRate(p);
                  const isFirst = idx === 0 && p.wins > 0;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isFirst ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        {idx === 0 && p.wins > 0 ? (
                          <Crown className="w-4 h-4 text-amber-500 mx-auto fill-amber-400" />
                        ) : idx === 1 && p.wins > 0 ? (
                          <Medal className="w-4 h-4 text-slate-400 mx-auto" />
                        ) : idx === 2 && p.wins > 0 ? (
                          <Medal className="w-4 h-4 text-amber-700 mx-auto" />
                        ) : (
                          <span className="font-mono font-bold text-slate-400 text-xs">
                            #{idx + 1}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 ${p.avatarColor}`}
                          >
                            {p.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-black text-slate-900">{p.name}</span>
                            {p.status === 'playing' && (
                              <span className="ml-2 px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800">
                                On Court
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        {p.currentStreak > 1 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            {p.currentStreak}W Streak
                          </span>
                        ) : p.currentStreak === 1 ? (
                          <span className="text-xs font-bold text-emerald-700">1W</span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold text-slate-700 text-xs">
                          {p.bestStreak > 0 ? `${p.bestStreak}W` : '-'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-xs text-slate-800">
                        <span className="text-emerald-700">{p.wins}W</span>
                        <span className="text-slate-300 mx-1">-</span>
                        <span className="text-rose-700">{p.losses}L</span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`font-black text-xs ${
                            winRate >= 70
                              ? 'text-emerald-600'
                              : winRate >= 50
                              ? 'text-teal-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {p.gamesPlayed > 0 ? `${winRate}%` : '-'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-bold text-xs text-slate-600">
                        {p.gamesPlayed}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

