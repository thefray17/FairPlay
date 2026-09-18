import React, { useState, useEffect } from 'react';
import { OpenPlayMatch, OpenPlayPlayer, OpenPlayConfig } from '../../types/openPlay';
import {
  Play,
  CheckCircle2,
  Clock,
  Plus,
  Minus,
  Flame,
  ArrowRightLeft,
  Trophy,
  Sparkles,
  Zap,
  RotateCcw,
  Users,
  Edit3,
} from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface OpenPlayCourtCardProps {
  courtNumber: number;
  match: OpenPlayMatch | null;
  config: OpenPlayConfig;
  playerRegistry: Record<string, OpenPlayPlayer>;
  winnersQueue?: string[];
  losersQueue?: string[];
  restingBench?: string[];
  waitingQueue?: OpenPlayPlayer[];
  onStartMatch: (courtNumber: number) => void;
  onUpdateScore: (matchId: string, score1: number, score2: number) => void;
  onCompleteMatch?: (matchId: string) => void;
  onOpenFinishModal: (match: OpenPlayMatch) => void;
  onCancelMatch: (courtNumber: number) => void;
  onShufflePartners?: (courtNumber: number) => void;
  onEditLineup?: (courtNumber: number) => void;
  onReopenMatch?: (matchId: string) => void;
}

export const OpenPlayCourtCard: React.FC<OpenPlayCourtCardProps> = ({
  courtNumber,
  match,
  config,
  playerRegistry,
  winnersQueue = [],
  losersQueue = [],
  restingBench = [],
  onStartMatch,
  onUpdateScore,
  onCompleteMatch,
  onOpenFinishModal,
  onCancelMatch,
  onShufflePartners,
  onEditLineup,
  onReopenMatch,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!match || match.status !== 'in_progress') {
      setElapsedSeconds(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = Math.max(0, Math.floor((now - match.startedAt) / 1000));
      setElapsedSeconds(elapsed);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [match?.startedAt, match?.status]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const isLive = Boolean(match && match.status === 'in_progress');
  const isCompleted = Boolean(match && match.status === 'completed');

  // Preview whether a match can be started on this court
  const neededPlayers = config.format === 'singles' ? 2 : 4;
  const canStart = (restingBench.length + winnersQueue.length + losersQueue.length) >= neededPlayers;

  // Score adjustments
  const handleScoreChange = (team: 1 | 2, delta: number) => {
    if (!match) return;
    const newScore1 = team === 1 ? Math.max(0, match.score1 + delta) : match.score1;
    const newScore2 = team === 2 ? Math.max(0, match.score2 + delta) : match.score2;
    soundFx.playPointChime();
    onUpdateScore(match.id, newScore1, newScore2);
  };

  const handleFinish = () => {
    if (!match) return;
    // If scores are entered and not tied at 0-0, finish and record directly (uniform with Social Match)
    if (match.score1 > 0 || match.score2 > 0) {
      soundFx.playWhistle();
      if (onCompleteMatch) {
        onCompleteMatch(match.id);
      } else {
        onOpenFinishModal(match);
      }
    } else {
      // Otherwise open finish modal to pick or record final scores
      onOpenFinishModal(match);
    }
  };

  const team1Won = (isCompleted || isLive) && match && match.score1 > match.score2;
  const team2Won = (isCompleted || isLive) && match && match.score2 > match.score1;
  const isDraw = (isCompleted || isLive) && match && match.score1 === match.score2;

  // Check target points & win by two for match point:
  const targetPts = config.targetPoints;
  
  const isTeam1WinConditionMet = Boolean(match && match.score1 >= targetPts && (!config.winByTwo || match.score1 >= match.score2 + 2));
  const isTeam2WinConditionMet = Boolean(match && match.score2 >= targetPts && (!config.winByTwo || match.score2 >= match.score1 + 2));

  const isTeam1MatchPoint = Boolean(isLive && match && !isTeam1WinConditionMet && (
    config.winByTwo
      ? (match.score1 >= targetPts - 1 && match.score1 >= match.score2 + 1)
      : (match.score1 === targetPts - 1)
  ));

  const isTeam2MatchPoint = Boolean(isLive && match && !isTeam2WinConditionMet && (
    config.winByTwo
      ? (match.score2 >= targetPts - 1 && match.score2 >= match.score1 + 1)
      : (match.score2 === targetPts - 1)
  ));

  const isMatchPoint = isTeam1MatchPoint || isTeam2MatchPoint;

  // Player Arrival and Split labels
  const arrivalOrder = match?.arrivalOrder || [];
  const getArrivalIndex = (id: string) => {
    const idx = arrivalOrder.indexOf(id);
    return idx >= 0 ? idx + 1 : null;
  };

  const splitModeLabel = (() => {
    if (!match?.partnerSplitMode || match.partnerSplitMode === '14_vs_23') {
      return 'Split: 1 & 4 vs 2 & 3';
    }
    if (match.partnerSplitMode === '12_vs_34') {
      return 'Split: 1 & 2 vs 3 & 4';
    }
    return 'Split: 1 & 3 vs 2 & 4';
  })();

  const movedUpSet = new Set(match?.movedUpPlayerIds || []);

  const renderPlayer = (id: string, isTeamAhead: boolean) => {
    const player = playerRegistry[id] || {
      id,
      name: 'Player',
      avatarColor: 'bg-emerald-600 text-white',
      gamesPlayed: 0,
      wins: 0,
      currentStreak: 0,
    };
    const arrivalNum = getArrivalIndex(id);
    const isMovedUp = movedUpSet.has(id);

    return (
      <div
        key={id}
        className={`flex items-center justify-between gap-1.5 p-1.5 sm:p-2 rounded-xl border transition-all ${
          isLive
            ? 'bg-white/95 border-amber-300 shadow-2xs'
            : isCompleted
            ? 'bg-slate-50 border-slate-200'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Avatar initial circle */}
          <span
            className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black border border-white shadow-2xs shrink-0 ${player.avatarColor}`}
          >
            {player.name.charAt(0)}
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-1">
              {arrivalNum !== null && (
                <span
                  className="px-1 py-0.2 rounded bg-slate-900 text-yellow-300 font-mono text-[9px] font-black shrink-0"
                  title={`Arrived #${arrivalNum} to court`}
                >
                  #{arrivalNum}
                </span>
              )}
              <span className="text-xs font-black text-slate-900 truncate">
                {player.name}
              </span>
              {isMovedUp && (
                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black uppercase tracking-tight shrink-0">
                  Move-Up
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold leading-none mt-0.5">
              <span>{player.gamesPlayed} GP</span>
              {player.currentStreak > 0 && (
                <span className="flex items-center gap-0.5 text-amber-700 font-black">
                  <Flame className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                  {player.currentStreak}W
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      id={`openplay-court-card-${courtNumber}`}
      className={`relative rounded-2xl sm:rounded-3xl transition-all p-3.5 sm:p-5 shadow-sm overflow-hidden flex flex-col justify-between ${
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

      <div>
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
              Court {courtNumber}
            </span>

            {/* Match Type Badge */}
            {match && (
              <>
                {match.matchType === 'bench_start' && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider bg-orange-100 text-orange-950 border border-orange-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-orange-600" />
                    Bench Round
                  </span>
                )}
                {match.matchType === 'pure_winners' && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-600" />
                    Winners Match
                  </span>
                )}
                {match.matchType === 'pure_losers' && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider bg-teal-100 text-teal-900 border border-teal-300 flex items-center gap-1">
                    <Users className="w-3 h-3 text-teal-700" />
                    Losers Match
                  </span>
                )}
                {match.matchType === 'move_up' && (
                  <span className="px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider bg-yellow-300 text-slate-950 border border-yellow-500 flex items-center gap-1">
                    <Zap className="w-3 h-3 fill-slate-950 text-slate-950" />
                    Move-Up
                  </span>
                )}
              </>
            )}

            <span className={`text-[11px] sm:text-xs font-bold shrink-0 ${isLive ? 'text-slate-900' : 'text-slate-600'}`}>
              Target: {config.targetPoints} pts {config.winByTwo ? '(by 2)' : ''}
            </span>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onShufflePartners && !isCompleted && match && (
              <button
                type="button"
                id={`btn-shuffle-court-${courtNumber}`}
                onClick={() => {
                  onShufflePartners(courtNumber);
                  soundFx.playPointChime();
                }}
                className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-colors cursor-pointer ${
                  isLive
                    ? 'bg-black/10 hover:bg-black/20 text-slate-950'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                }`}
                title="Shuffle / swap partner combinations"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
            )}

            {onEditLineup && !isCompleted && (
              <button
                type="button"
                id={`btn-edit-lineup-court-${courtNumber}`}
                onClick={() => onEditLineup(courtNumber)}
                className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-colors cursor-pointer ${
                  isLive
                    ? 'bg-black/10 hover:bg-black/20 text-slate-950'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                }`}
                title="Edit players on this court"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Status indicator badge */}
            {isLive ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-yellow-300 shadow-xs animate-pulse">
                ● Live ({formatTime(elapsedSeconds)})
              </span>
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] font-black uppercase tracking-tight bg-green-100 text-green-800 border border-green-200">
                <CheckCircle2 className="w-3 h-3 text-green-700" /> Finished
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-200/80 px-2.5 py-0.5 rounded-full">
                Court Open
              </span>
            )}
          </div>
        </div>

        {/* Live / Active Match Body */}
        {match ? (
          <div className="space-y-3 relative z-10">
            {/* Split and Partner Rule Note */}
            {match.partnerSplitMode && isLive && (
              <div className="flex items-center justify-between gap-1.5 bg-black/5 px-2.5 py-1 rounded-xl text-xs">
                <div className="flex items-center gap-1.5 text-slate-900 font-bold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>{splitModeLabel}</span>
                  <span className="text-[10px] text-slate-600 font-medium hidden sm:inline">
                    (prev teammates split)
                  </span>
                </div>
              </div>
            )}

            {/* Teams Grid (2 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
              {/* Team 1 Side */}
              <div
                className={`p-3 rounded-2xl border transition-all flex flex-col justify-between ${
                  isLive
                    ? team1Won
                      ? 'bg-white/95 border-black/20 shadow-md ring-2 ring-black/10'
                      : 'bg-white/80 border-black/10'
                    : team1Won
                    ? 'bg-green-50/70 border-green-300'
                    : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Team 1
                      </span>
                      {team1Won && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-yellow-400 text-slate-950 border border-yellow-500">
                          👑 {(isCompleted || isTeam1WinConditionMet) ? 'Won' : 'Ahead'}
                        </span>
                      )}
                      {isTeam1MatchPoint && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-rose-500 text-white uppercase tracking-wider animate-pulse shadow-xs">
                          ⚡ Match Point
                        </span>
                      )}
                    </div>

                    {/* Numeric Score Box */}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min="0"
                        max="99"
                        value={match.score1}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          onUpdateScore(match.id, val, match.score2);
                        }}
                        className="w-13 sm:w-16 text-right text-lg sm:text-2xl font-black text-slate-900 tracking-tight bg-slate-50 rounded-lg sm:rounded-xl px-1.5 sm:px-2 py-0.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Player Cards */}
                  <div className="space-y-1.5">
                    {match.team1.map((id) => renderPlayer(id, Boolean(team1Won)))}
                  </div>
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
                ) : (
                  <div className="text-[11px] sm:text-xs text-slate-500 font-bold pt-0.5">
                    Score: <strong className="text-slate-900">{match.score1} pts</strong>
                  </div>
                )}
              </div>

              {/* Team 2 Side */}
              <div
                className={`p-3 rounded-2xl border transition-all flex flex-col justify-between ${
                  isLive
                    ? team2Won
                      ? 'bg-white/95 border-black/20 shadow-md ring-2 ring-black/10'
                      : 'bg-white/80 border-black/10'
                    : team2Won
                    ? 'bg-green-50/70 border-green-300'
                    : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Team 2
                      </span>
                      {team2Won && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-yellow-400 text-slate-950 border border-yellow-500">
                          👑 {(isCompleted || isTeam2WinConditionMet) ? 'Won' : 'Ahead'}
                        </span>
                      )}
                      {isTeam2MatchPoint && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-rose-500 text-white uppercase tracking-wider animate-pulse shadow-xs">
                          ⚡ Match Point
                        </span>
                      )}
                    </div>

                    {/* Numeric Score Box */}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min="0"
                        max="99"
                        value={match.score2}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          onUpdateScore(match.id, match.score1, val);
                        }}
                        className="w-13 sm:w-16 text-right text-lg sm:text-2xl font-black text-slate-900 tracking-tight bg-slate-50 rounded-lg sm:rounded-xl px-1.5 sm:px-2 py-0.5 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Player Cards */}
                  <div className="space-y-1.5">
                    {match.team2.map((id) => renderPlayer(id, Boolean(team2Won)))}
                  </div>
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
                ) : (
                  <div className="text-[11px] sm:text-xs text-slate-500 font-bold pt-0.5">
                    Score: <strong className="text-slate-900">{match.score2} pts</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Empty / Open Court State */
          <div className="py-6 sm:py-8 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs text-emerald-800 flex items-center justify-center mb-2.5">
              <Play className="w-6 h-6 ml-0.5 text-emerald-600" />
            </div>
            <p className="text-sm font-black text-slate-900">Court {courtNumber} Available</p>
            <p className="text-xs text-slate-500 max-w-xs mt-1">
              {canStart
                ? 'Ready to dispatch next players or pick custom lineup.'
                : 'Waiting for players in bench or queue to fill this court.'}
            </p>
          </div>
        )}
      </div>

      {/* Card Action Footer */}
      <div
        className={`relative z-10 flex flex-wrap items-center justify-between gap-2.5 pt-3 mt-3 sm:pt-3.5 sm:mb-0 border-t ${
          isLive ? 'border-black/10' : 'border-slate-200'
        }`}
      >
        <div className="text-xs font-semibold text-slate-600 min-w-0">
          {isLive ? (
            <span className="text-slate-900 font-bold">
              Target {config.targetPoints} pts • Match in progress
            </span>
          ) : isCompleted ? (
            <span className="text-slate-700">
              {team1Won
                ? `Team 1 won (${match?.score1} - ${match?.score2})`
                : team2Won
                ? `Team 2 won (${match?.score2} - ${match?.score1})`
                : isDraw
                ? `Match tied (${match?.score1} - ${match?.score2})`
                : 'Match recorded'}
            </span>
          ) : (
            <span className="text-slate-500">
              Target {config.targetPoints} pts • Press Fill &amp; Start to begin
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isLive && match ? (
            <>
              {confirmCancel ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onCancelMatch(courtNumber);
                      setConfirmCancel(false);
                    }}
                    className="py-2 px-3 rounded-xl bg-rose-600 text-white font-black text-xs transition-colors cursor-pointer"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    className="py-2 px-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="py-2 px-2.5 rounded-xl border border-black/20 hover:bg-black/10 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
                  title="Cancel match & return players to queues"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                id={`btn-finish-court-${courtNumber}`}
                onClick={handleFinish}
                className="py-2 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span>Finish &amp; Record Match</span>
              </button>
            </>
          ) : isCompleted && match ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                id={`btn-reopen-court-${courtNumber}`}
                onClick={() => onReopenMatch && onReopenMatch(match.id)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Reopen match to edit scores"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reopen</span>
              </button>

              <button
                type="button"
                id={`btn-next-court-${courtNumber}`}
                onClick={() => onStartMatch(courtNumber)}
                disabled={!canStart}
                className={`py-2 px-3.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  canStart
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm active:scale-98'
                    : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Fill Next Match</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {onEditLineup && (
                <button
                  type="button"
                  onClick={() => onEditLineup(courtNumber)}
                  className="py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                id={`btn-start-court-${courtNumber}`}
                onClick={() => onStartMatch(courtNumber)}
                disabled={!canStart}
                className={`py-2 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  canStart
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm active:scale-98'
                    : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Fill &amp; Start Match</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
