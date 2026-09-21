import React from 'react';
import { Match, Player, SessionConfig } from '../types';
import { Trophy, CheckCircle2, RotateCcw, Plus, Minus, Edit3, ArrowRightLeft, Sparkles, Link2, Play } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface CourtCardProps {
  match: Match;
  playersMap: Record<string, Player>;
  config: SessionConfig;
  partnerCounts?: Record<string, Record<string, number>>;
  onUpdateScore: (matchId: string, score1: number, score2: number, completed?: boolean) => void;
  onCompleteMatch: (matchId: string) => void;
  onReopenMatch: (matchId: string) => void;
  onEditLineup?: (matchId: string) => void;
  onBenchAndReplacePlayer?: (matchId: string, playerId: string) => void;
  onStartMatch?: (matchId: string) => void;
  onShuffleLineup?: (matchId: string) => void;
}

export const CourtCard: React.FC<CourtCardProps> = ({
  match,
  playersMap,
  config,
  partnerCounts,
  onUpdateScore,
  onCompleteMatch,
  onReopenMatch,
  onEditLineup,
  onBenchAndReplacePlayer,
  onStartMatch,
  onShuffleLineup,
}) => {
  const team1Players = match.team1.playerIds.map((id) => playersMap[id]).filter(Boolean);
  const team2Players = match.team2.playerIds.map((id) => playersMap[id]).filter(Boolean);

  const isTeam1LockedDuo =
    team1Players.length >= 2 && team1Players[0].duoPartnerId === team1Players[1].id;
  const isTeam2LockedDuo =
    team2Players.length >= 2 && team2Players[0].duoPartnerId === team2Players[1].id;

  const team1PairTimes =
    partnerCounts && team1Players.length >= 2
      ? partnerCounts[team1Players[0].id]?.[team1Players[1].id] ?? 0
      : null;

  const team2PairTimes =
    partnerCounts && team2Players.length >= 2
      ? partnerCounts[team2Players[0].id]?.[team2Players[1].id] ?? 0
      : null;

  const team1Won = match.completed && match.score1 > match.score2;
  const team2Won = match.completed && match.score2 > match.score1;
  const isDraw = match.completed && match.score1 === match.score2;

  const targetPoints = config.targetPoints;
  const winByTwo = config.winByTwo;
  const isLive = !match.completed && match.status === 'in_progress';

  const isTeam1WinConditionMet = match.score1 >= targetPoints && (!winByTwo || match.score1 >= match.score2 + 2);
  const isTeam2WinConditionMet = match.score2 >= targetPoints && (!winByTwo || match.score2 >= match.score1 + 2);

  const isTeam1MatchPoint = isLive && !isTeam1WinConditionMet && (
    winByTwo
      ? (match.score1 >= targetPoints - 1 && match.score1 >= match.score2 + 1)
      : (match.score1 === targetPoints - 1)
  );

  const isTeam2MatchPoint = isLive && !isTeam2WinConditionMet && (
    winByTwo
      ? (match.score2 >= targetPoints - 1 && match.score2 >= match.score1 + 1)
      : (match.score2 === targetPoints - 1)
  );

  const isMatchPoint = isTeam1MatchPoint || isTeam2MatchPoint;

  const isPending = !match.completed && match.status !== 'in_progress';
  const isCompleted = match.completed;

  const handleScoreChange = (team: 1 | 2, delta: number) => {
    let newScore1 = match.score1;
    let newScore2 = match.score2;

    if (team === 1) {
      newScore1 = Math.max(0, match.score1 + delta);
    } else {
      newScore2 = Math.max(0, match.score2 + delta);
    }

    soundFx.playPointChime();
    onUpdateScore(match.id, newScore1, newScore2, match.completed);
  };

  const handleFinish = () => {
    soundFx.playWhistle();
    onCompleteMatch(match.id);
  };

  return (
    <div
      id={`court-card-${match.courtNumber || match.id}`}
      className={`relative rounded-2xl sm:rounded-3xl transition-all p-3.5 sm:p-5 shadow-sm overflow-hidden ${
        isCompleted
          ? 'bg-white border border-slate-200 text-slate-900'
          : isLive
          ? 'bg-yellow-400 border border-yellow-500/40 shadow-md text-slate-950 relative'
          : 'bg-slate-100/90 border border-slate-300/80 text-slate-900 shadow-xs relative'
      }`}
    >
      {/* Decorative accent circle for live match */}
      {isLive && (
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-yellow-300/80 rounded-full opacity-60 pointer-events-none" />
      )}

      {/* Court Header */}
      <div
        className={`relative z-10 flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 sm:pb-3.5 sm:mb-3.5 border-b ${
          isLive ? 'border-black/10' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
          <span
            className={`px-2.5 py-0.5 sm:px-3 sm:py-1 text-[10px] font-black rounded-full uppercase tracking-wider shrink-0 ${
              isLive ? 'bg-black text-white' : 'bg-slate-800 text-white'
            }`}
          >
            {match.courtNumber ? `Court ${match.courtNumber}` : `Queue Match ${match.matchOrder || 'Next'}`}
          </span>
          {match.isCatchUpMatch && (
            <span className="px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider bg-amber-500 text-slate-950 border border-amber-600 shadow-2xs shrink-0">
              ⚡ Catch-Up
            </span>
          )}
          <span className={`text-[11px] sm:text-xs font-bold shrink-0 ${isLive ? 'text-slate-900' : 'text-slate-600'}`}>
            Target: {config.targetPoints} pts
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onShuffleLineup && !match.completed && (
            <button
              type="button"
              id={`btn-shuffle-lineup-${match.id}`}
              onClick={() => {
                soundFx.playPointChime();
                onShuffleLineup(match.id);
              }}
              className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-colors cursor-pointer ${
                isLive
                  ? 'bg-black/10 hover:bg-black/20 text-indigo-950'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
              title="Shuffle / swap partner combinations on court"
              aria-label="Shuffle / swap partner combinations on court"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-900" />
            </button>
          )}

          {onEditLineup && !match.completed && (
            <button
              type="button"
              id={`btn-edit-lineup-${match.id}`}
              onClick={() => onEditLineup(match.id)}
              className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-colors cursor-pointer ${
                isLive
                  ? 'bg-black/10 hover:bg-black/20 text-indigo-950'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
              }`}
              title="Edit or swap players in this match"
              aria-label="Edit or swap players in this match"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}

          {isCompleted ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] font-black uppercase tracking-tight bg-green-100 text-green-800 border border-green-200">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-700" /> Finished
            </span>
          ) : isLive ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-yellow-300 shadow-xs animate-pulse">
              ● Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-700 border border-slate-300 shadow-2xs">
              Ready to Start
            </span>
          )}
        </div>
      </div>

      {/* Teams Grid */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4 mb-2.5 sm:mb-4">
        {/* TEAM 1 */}
        <div
          className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${
            team1Won
              ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-500/30'
              : isCompleted
              ? 'bg-slate-50/80 border-slate-200'
              : isLive
              ? 'bg-white/95 border-yellow-500/40 shadow-xs'
              : 'bg-white border-slate-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-[11px] sm:text-xs font-black tracking-wide uppercase text-indigo-950 shrink-0 flex items-center gap-1.5">
                Team 1 
                {(team1Won || isTeam1WinConditionMet) && <span className="text-indigo-600 font-black">👑 Won</span>}
                {isTeam1MatchPoint && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-rose-500 text-white uppercase tracking-wider animate-pulse shadow-xs">
                    ⚡ Match Point
                  </span>
                )}
              </span>
              {isTeam1LockedDuo ? (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs truncate"
                  title="Locked Duo: Always play together on the same team"
                >
                  <Link2 className="w-2.5 h-2.5 text-emerald-700 shrink-0" /> Locked Duo
                </span>
              ) : (
                team1PairTimes !== null && (
                  team1PairTimes === 0 ? (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs truncate"
                      title="First time playing together as partners!"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-emerald-600 shrink-0" /> New Duo
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200"
                      title={`Paired together ${team1PairTimes} time(s) previously`}
                    >
                      {team1PairTimes}x
                    </span>
                  )
                )
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isLive ? (
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  max="99"
                  value={match.score1}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    onUpdateScore(match.id, val, match.score2, match.completed);
                  }}
                  className="w-13 sm:w-16 text-right text-lg sm:text-2xl font-black text-slate-900 tracking-tight bg-slate-50 rounded-lg sm:rounded-xl px-1.5 sm:px-2 py-0.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 shadow-inner"
                />
              ) : (
                <div className={`text-lg sm:text-2xl font-black tracking-tight ${isPending ? 'text-slate-400' : 'text-slate-900'}`}>
                  {match.score1}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5 mb-2.5 sm:mb-3">
            {team1Players.map((player, idx) => {
              const isFiller = match.fillerPlayerIds?.includes(player.id);
              const isCatchUp = match.catchUpPlayerIds?.includes(player.id);
              return (
                <div key={`${match.id}-t1-${player.id}-${idx}`} className="flex items-center justify-between gap-1.5 group/p">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 flex-wrap">
                    <span
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black border border-white shadow-xs shrink-0 ${player.avatarColor}`}
                    >
                      {player.name.charAt(0)}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[105px] xs:max-w-[130px] sm:max-w-[160px]">{player.name}</span>
                    {isCatchUp && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-2xs shrink-0 whitespace-nowrap"
                        title="Catch-Up Player: Playing extra match to catch up in games played"
                      >
                        ⚡ Catch-Up (+1 GP)
                      </span>
                    )}
                    {isFiller && !isCatchUp && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black bg-amber-200/90 text-amber-950 border border-amber-400 shadow-2xs shrink-0 whitespace-nowrap"
                        title="Filler Player: Extra game to balance court rotation, counts toward GP"
                      >
                        ★ Filler (+1 GP)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stepper Buttons for Team 1: Only visible during live match */}
          {isLive ? (
            <div className="flex items-center gap-1 pt-2 border-t border-slate-100 touch-manipulation">
              <button
                type="button"
                id={`btn-score1-minus-${match.id}`}
                onClick={() => handleScoreChange(1, -1)}
                className="flex-1 h-8 sm:h-9 py-1 px-1.5 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 active:bg-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                title="Minus 1 point"
                aria-label="Minus 1 point Team 1"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                id={`btn-score1-plus1-${match.id}`}
                onClick={() => handleScoreChange(1, 1)}
                className="flex-2 h-8 sm:h-9 py-1 px-2 rounded-lg sm:rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 active:bg-indigo-800 text-white font-black text-xs flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> 1 pt
              </button>
              <button
                type="button"
                id={`btn-score1-plus5-${match.id}`}
                onClick={() => handleScoreChange(1, 5)}
                className="flex-1 h-8 sm:h-9 py-1 px-1.5 rounded-lg sm:rounded-xl bg-yellow-400 hover:bg-yellow-300 active:scale-95 active:bg-yellow-500 text-indigo-950 font-black text-xs flex items-center justify-center border border-yellow-500/50 transition-all cursor-pointer shadow-2xs"
              >
                +5
              </button>
            </div>
          ) : isPending ? (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] sm:text-xs text-slate-500 font-medium">
              <span className="text-slate-400">Score:</span>
              <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-xs">
                {match.score1} pts
              </span>
            </div>
          ) : (
            <div className="text-[11px] sm:text-xs text-slate-500 font-bold pt-0.5">
              Score: <strong className="text-slate-900">{match.score1} pts</strong>
            </div>
          )}
        </div>

        {/* TEAM 2 */}
        <div
          className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${
            team2Won
              ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-500/30'
              : isCompleted
              ? 'bg-slate-50/80 border-slate-200'
              : isLive
              ? 'bg-white/95 border-yellow-500/40 shadow-xs'
              : 'bg-white border-slate-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-[11px] sm:text-xs font-black tracking-wide uppercase text-indigo-950 shrink-0 flex items-center gap-1.5">
                Team 2 
                {(team2Won || isTeam2WinConditionMet) && <span className="text-indigo-600 font-black">👑 Won</span>}
                {isTeam2MatchPoint && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-rose-500 text-white uppercase tracking-wider animate-pulse shadow-xs">
                    ⚡ Match Point
                  </span>
                )}
              </span>
              {isTeam2LockedDuo ? (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs truncate"
                  title="Locked Duo: Always play together on the same team"
                >
                  <Link2 className="w-2.5 h-2.5 text-emerald-700 shrink-0" /> Locked Duo
                </span>
              ) : (
                team2PairTimes !== null && (
                  team2PairTimes === 0 ? (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs truncate"
                      title="First time playing together as partners!"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-emerald-600 shrink-0" /> New Duo
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200"
                      title={`Paired together ${team2PairTimes} time(s) previously`}
                    >
                      {team2PairTimes}x
                    </span>
                  )
                )
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isLive ? (
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  max="99"
                  value={match.score2}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    onUpdateScore(match.id, match.score1, val, match.completed);
                  }}
                  className="w-13 sm:w-16 text-right text-lg sm:text-2xl font-black text-slate-900 tracking-tight bg-slate-50 rounded-lg sm:rounded-xl px-1.5 sm:px-2 py-0.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 shadow-inner"
                />
              ) : (
                <div className={`text-lg sm:text-2xl font-black tracking-tight ${isPending ? 'text-slate-400' : 'text-slate-900'}`}>
                  {match.score2}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5 mb-2.5 sm:mb-3">
            {team2Players.map((player, idx) => {
              const isFiller = match.fillerPlayerIds?.includes(player.id);
              const isCatchUp = match.catchUpPlayerIds?.includes(player.id);
              return (
                <div key={`${match.id}-t2-${player.id}-${idx}`} className="flex items-center justify-between gap-1.5 group/p">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 flex-wrap">
                    <span
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black border border-white shadow-xs shrink-0 ${player.avatarColor}`}
                    >
                      {player.name.charAt(0)}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[105px] xs:max-w-[130px] sm:max-w-[160px]">{player.name}</span>
                    {isCatchUp && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-2xs shrink-0 whitespace-nowrap"
                        title="Catch-Up Player: Playing extra match to catch up in games played"
                      >
                        ⚡ Catch-Up (+1 GP)
                      </span>
                    )}
                    {isFiller && !isCatchUp && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black bg-amber-200/90 text-amber-950 border border-amber-400 shadow-2xs shrink-0 whitespace-nowrap"
                        title="Filler Player: Extra game to balance court rotation, counts toward GP"
                      >
                        ★ Filler (+1 GP)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stepper Buttons for Team 2: Only visible during live match */}
          {isLive ? (
            <div className="flex items-center gap-1 pt-2 border-t border-slate-100 touch-manipulation">
              <button
                type="button"
                id={`btn-score2-minus-${match.id}`}
                onClick={() => handleScoreChange(2, -1)}
                className="flex-1 h-8 sm:h-9 py-1 px-1.5 rounded-lg sm:rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 active:bg-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                title="Minus 1 point"
                aria-label="Minus 1 point Team 2"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                id={`btn-score2-plus1-${match.id}`}
                onClick={() => handleScoreChange(2, 1)}
                className="flex-2 h-8 sm:h-9 py-1 px-2 rounded-lg sm:rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 active:bg-indigo-800 text-white font-black text-xs flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> 1 pt
              </button>
              <button
                type="button"
                id={`btn-score2-plus5-${match.id}`}
                onClick={() => handleScoreChange(2, 5)}
                className="flex-1 h-8 sm:h-9 py-1 px-1.5 rounded-lg sm:rounded-xl bg-yellow-400 hover:bg-yellow-300 active:scale-95 active:bg-yellow-500 text-indigo-950 font-black text-xs flex items-center justify-center border border-yellow-500/50 transition-all cursor-pointer shadow-2xs"
              >
                +5
              </button>
            </div>
          ) : isPending ? (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] sm:text-xs text-slate-500 font-medium">
              <span className="text-slate-400">Score:</span>
              <span className="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-xs">
                {match.score2} pts
              </span>
            </div>
          ) : (
            <div className="text-[11px] sm:text-xs text-slate-500 font-bold pt-0.5">
              Score: <strong className="text-slate-900">{match.score2} pts</strong>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer: Shows either Start Match, Finish & Record Match, or Edit Score */}
      <div
        className={`relative z-10 pt-2.5 sm:pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 ${
          isLive ? 'border-black/10' : 'border-slate-200'
        }`}
      >
        <div className="text-[11px] sm:text-xs font-bold text-slate-700">
          {isCompleted ? (
            <span>
              Result: {team1Won ? 'Team 1 won' : team2Won ? 'Team 2 won' : 'Tie / Draw'} ({match.score1} - {match.score2})
            </span>
          ) : isLive ? (
            <span className="text-indigo-950 font-bold">
              Target {config.targetPoints} pts • Match in progress
            </span>
          ) : (
            <span className="text-slate-600 font-medium">
              Target {config.targetPoints} pts • Press Start Match to begin
            </span>
          )}
        </div>

        <div className="w-full sm:w-auto flex items-center gap-2 flex-wrap">
          {isPending ? (
            <button
              type="button"
              id={`btn-start-match-${match.id}`}
              onClick={() => {
                soundFx.playPointChime();
                onStartMatch?.(match.id);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer min-h-[40px] sm:min-h-[44px]"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Start Match
            </button>
          ) : isLive ? (
            <button
              type="button"
              id={`btn-finish-match-${match.id}`}
              onClick={handleFinish}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer min-h-[40px] sm:min-h-[44px]"
            >
              <Trophy className="w-3.5 h-3.5 text-yellow-400" /> Finish &amp; Record Match
            </button>
          ) : (
            <button
              type="button"
              id={`btn-reopen-match-${match.id}`}
              onClick={() => onReopenMatch(match.id)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-black active:scale-95 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer min-h-[36px] sm:min-h-0"
              title="Re-open match to edit score"
              aria-label="Re-open match to edit score"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
