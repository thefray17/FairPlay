import React, { useState, useEffect } from 'react';
import { Match, Player, SessionConfig } from '../types';
import {
  Trophy,
  CheckCircle2,
  RotateCcw,
  Plus,
  Minus,
  Edit3,
  ArrowRightLeft,
  Link2,
  Play,
  Clock,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Minimize2,
  Maximize2,
  Coffee,
  Flame,
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface FloatingMatchWindowProps {
  match: Match;
  roundNumber: number;
  allMatchesInSession: { match: Match; roundNumber: number }[];
  playersMap: Record<string, Player>;
  config: SessionConfig;
  partnerCounts?: Record<string, Record<string, number>>;
  playerMatchCounts?: Record<string, number>;
  onClose: () => void;
  onSelectMatch: (matchId: string) => void;
  onUpdateScore: (matchId: string, score1: number, score2: number, completed?: boolean) => void;
  onCompleteMatch: (matchId: string) => void;
  onReopenMatch: (matchId: string) => void;
  onStartMatch?: (matchId: string) => void;
  onEditLineup?: (matchId: string) => void;
  onShuffleLineup?: (matchId: string) => void;
  onBenchAndReplacePlayer?: (matchId: string, playerId: string) => void;
  onDeleteMatch?: (matchId: string) => void;
}

export const FloatingMatchWindow: React.FC<FloatingMatchWindowProps> = ({
  match,
  roundNumber,
  allMatchesInSession,
  playersMap,
  config,
  partnerCounts,
  playerMatchCounts = {},
  onClose,
  onSelectMatch,
  onUpdateScore,
  onCompleteMatch,
  onReopenMatch,
  onStartMatch,
  onEditLineup,
  onShuffleLineup,
  onBenchAndReplacePlayer,
  onDeleteMatch,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [benchConfirmPlayer, setBenchConfirmPlayer] = useState<Player | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('');

  const team1Players = match.team1.playerIds.map((id) => playersMap[id]).filter(Boolean);
  const team2Players = match.team2.playerIds.map((id) => playersMap[id]).filter(Boolean);

  const isTeam1LockedDuo =
    team1Players.length >= 2 && team1Players[0].duoPartnerId === team1Players[1].id;
  const isTeam2LockedDuo =
    team2Players.length >= 2 && team2Players[0].duoPartnerId === team2Players[1].id;

  const team1Won = match.completed && match.score1 > match.score2;
  const team2Won = match.completed && match.score2 > match.score1;
  const isDraw = match.completed && match.score1 === match.score2;

  const targetPoints = config.targetPoints;
  const winByTwo = config.winByTwo;
  const isLive = !match.completed && match.status === 'in_progress';
  const isPending = !match.completed && match.status !== 'in_progress';
  const isCompleted = match.completed;

  // Active elapsed timer
  useEffect(() => {
    if (!isLive || !match.startedAt) {
      setElapsedTime('');
      return;
    }
    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((Date.now() - (match.startedAt || Date.now())) / 1000));
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsedTime(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isLive, match.startedAt]);

  // Match point logic
  const isTeam1WinConditionMet =
    match.score1 >= targetPoints && (!winByTwo || match.score1 >= match.score2 + 2);
  const isTeam2WinConditionMet =
    match.score2 >= targetPoints && (!winByTwo || match.score2 >= match.score1 + 2);

  const isTeam1MatchPoint =
    isLive &&
    !isTeam1WinConditionMet &&
    (winByTwo
      ? match.score1 >= targetPoints - 1 && match.score1 >= match.score2 + 1
      : match.score1 === targetPoints - 1);

  const isTeam2MatchPoint =
    isLive &&
    !isTeam2WinConditionMet &&
    (winByTwo
      ? match.score2 >= targetPoints - 1 && match.score2 >= match.score1 + 1
      : match.score2 === targetPoints - 1);

  const isMatchPoint = isTeam1MatchPoint || isTeam2MatchPoint;

  // Find index of current match in allMatches to support Next/Previous cycling
  const currentIndex = allMatchesInSession.findIndex((item) => item.match.id === match.id);
  const prevMatch = currentIndex > 0 ? allMatchesInSession[currentIndex - 1] : null;
  const nextMatch =
    currentIndex < allMatchesInSession.length - 1
      ? allMatchesInSession[currentIndex + 1]
      : null;

  const handleScoreChange = (team: 1 | 2, delta: number) => {
    let newScore1 = match.score1;
    let newScore2 = match.score2;

    if (team === 1) {
      newScore1 = Math.max(0, match.score1 + delta);
    } else {
      newScore2 = Math.max(0, match.score2 + delta);
    }

    soundFx.playPointChime();
    if (!match.completed && match.status !== 'in_progress' && onStartMatch) {
      onStartMatch(match.id);
    }
    onUpdateScore(match.id, newScore1, newScore2, match.completed);
  };

  const handleFinish = () => {
    soundFx.playWhistle();
    onCompleteMatch(match.id);
  };

  const handleStart = () => {
    soundFx.playWhistle();
    if (onStartMatch) {
      onStartMatch(match.id);
    }
  };

  const handleReopen = () => {
    soundFx.playPointChime();
    onReopenMatch(match.id);
  };

  const handleConfirmBenchPlayer = () => {
    if (benchConfirmPlayer && onBenchAndReplacePlayer) {
      soundFx.playPointChime();
      onBenchAndReplacePlayer(match.id, benchConfirmPlayer.id);
      setBenchConfirmPlayer(null);
    }
  };

  const handleDelete = () => {
    if (onDeleteMatch) {
      onDeleteMatch(match.id);
      onClose();
    }
  };

  // Minimized Bar Render
  if (isMinimized) {
    return (
      <div
        id="floating-match-minibar"
        className="fixed bottom-2 right-2 sm:bottom-4 sm:right-4 z-50 bg-slate-900/98 text-white rounded-xl shadow-xl border border-indigo-500/40 p-2 max-w-md w-[calc(100vw-1rem)] sm:w-auto flex items-center justify-between gap-2 animate-in fade-in select-none"
      >
        <div
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
            {match.courtNumber ? `C${match.courtNumber}` : 'M'}
          </div>
          <div className="min-w-0 truncate">
            <div className="text-xs font-bold truncate">
              {team1Players.map((p) => p.name).join(' & ')} vs{' '}
              {team2Players.map((p) => p.name).join(' & ')}
            </div>
            <div className="text-[10px] text-indigo-300 font-medium flex items-center gap-1.5">
              <span>R{roundNumber}</span>
              <span>•</span>
              <span className="font-mono font-bold text-amber-300">
                {match.score1} - {match.score2}
              </span>
              {isLive && <span className="text-emerald-400 font-bold">● Live</span>}
            </div>
          </div>
        </div>

        {!isCompleted && (
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-0.5 bg-white/10 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => handleScoreChange(1, -1)}
                disabled={match.score1 <= 0}
                className="w-7 h-7 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white font-bold rounded text-xs flex items-center justify-center cursor-pointer"
                title="T1 -1"
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => handleScoreChange(1, 1)}
                className="px-2 h-7 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded text-xs cursor-pointer"
                title="T1 +1"
              >
                +1
              </button>
            </div>

            <div className="flex items-center gap-0.5 bg-white/10 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => handleScoreChange(2, -1)}
                disabled={match.score2 <= 0}
                className="w-7 h-7 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white font-bold rounded text-xs flex items-center justify-center cursor-pointer"
                title="T2 -1"
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => handleScoreChange(2, 1)}
                className="px-2 h-7 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded text-xs cursor-pointer"
                title="T2 +1"
              >
                +1
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-0.5 shrink-0 border-l border-white/10 pl-1.5">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded hover:bg-white/10 text-indigo-200 hover:text-white cursor-pointer"
            title="Expand match window"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 text-indigo-200 hover:text-white cursor-pointer"
            title="Close window"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded Viewport-Fitted Match Officiating Window
  return (
    <>
      <div
        id="floating-match-window"
        className="fixed inset-x-0 bottom-0 sm:bottom-3 sm:right-3 sm:left-auto sm:max-w-lg md:max-w-xl z-50 bg-slate-900/98 backdrop-blur-md text-white rounded-t-2xl sm:rounded-2xl border border-indigo-500/40 p-2.5 sm:p-3 select-none flex flex-col justify-between shadow-2xl transition-all overflow-hidden"
        style={{
          maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Compact Header: One Single Row */}
        <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {/* Court / Match Tag */}
            <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shrink-0">
              {match.courtNumber ? `C${match.courtNumber}` : 'Match'}
            </span>

            {/* Round Tag */}
            <span className="text-xs font-black text-indigo-200 shrink-0">
              R{roundNumber}
            </span>

            {match.isCatchUpMatch && (
              <span className="px-1.5 py-0.2 text-[9px] font-black rounded uppercase bg-amber-500 text-slate-950 shrink-0">
                ⚡ Catch-Up
              </span>
            )}

            {/* Status with Live Timer */}
            {isLive ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live</span>
                {elapsedTime && (
                  <span className="font-mono text-emerald-300 ml-0.5 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {elapsedTime}
                  </span>
                )}
              </span>
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight bg-emerald-500 text-slate-950 shrink-0">
                <CheckCircle2 className="w-3 h-3" /> Done
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-white/10 text-slate-300 shrink-0">
                Ready
              </span>
            )}

            {/* Match Point inline indicator */}
            {isMatchPoint && !isCompleted && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 animate-pulse shrink-0">
                <Flame className="w-3 h-3 fill-slate-950" />
                <span>Match Pt (T{isTeam1MatchPoint ? '1' : '2'})</span>
              </span>
            )}
          </div>

          {/* Quick cycle between matches + Window controls */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex items-center bg-white/10 rounded-lg p-0.5">
              <button
                type="button"
                disabled={!prevMatch}
                onClick={() => prevMatch && onSelectMatch(prevMatch.match.id)}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white cursor-pointer"
                title="Previous match in session"
                aria-label="Previous match"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono px-1 text-indigo-200">
                {currentIndex + 1}/{allMatchesInSession.length}
              </span>
              <button
                type="button"
                disabled={!nextMatch}
                onClick={() => nextMatch && onSelectMatch(nextMatch.match.id)}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white cursor-pointer"
                title="Next match in session"
                aria-label="Next match"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-indigo-200 hover:text-white transition-colors cursor-pointer"
              title="Minimize window"
              aria-label="Minimize window"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-indigo-200 hover:text-white transition-colors cursor-pointer"
              title="Close window"
              aria-label="Close window"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Side-by-Side Teams Columns (Zero-Scroll Flex Body) */}
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5 my-2 flex-1 min-h-0">
          {/* TEAM 1 COLUMN */}
          <div
            className={`rounded-xl p-2 sm:p-2.5 border flex flex-col justify-between min-h-0 transition-colors ${
              team1Won
                ? 'bg-emerald-950/50 border-emerald-500/50'
                : 'bg-white/5 border-white/10'
            }`}
          >
            {/* Header & Players */}
            <div className="min-h-0 flex flex-col">
              <div className="flex items-center justify-between gap-1 mb-1.5 shrink-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1 truncate">
                  <span>Team 1</span>
                  {isTeam1LockedDuo && (
                    <span className="text-amber-400 shrink-0" title="Locked Duo">
                      <Link2 className="w-3 h-3" />
                    </span>
                  )}
                </span>
                {team1Won && (
                  <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.2 rounded-md flex items-center gap-0.5 shrink-0">
                    <Trophy className="w-2.5 h-2.5 text-emerald-400" /> Win
                  </span>
                )}
              </div>

              {/* Player Chips (Handles 1, 2, or up to 4 players cleanly) */}
              <div className="flex flex-wrap gap-1 min-h-0">
                {team1Players.map((player) => (
                  <div
                    key={`floating-t1-p-${player.id}`}
                    className={`flex items-center justify-between gap-1 p-1 rounded-lg bg-white/5 border border-white/5 min-w-0 ${
                      team1Players.length > 2 ? 'w-full sm:w-[calc(50%-2px)]' : 'w-full'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 ${player.avatarColor}`}
                      >
                        {player.name.charAt(0)}
                      </span>
                      <span className="text-xs font-semibold text-white truncate leading-tight">
                        {player.name}
                      </span>
                    </div>

                    {onBenchAndReplacePlayer && !isCompleted && (
                      <button
                        type="button"
                        onClick={() => setBenchConfirmPlayer(player)}
                        className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-amber-300 hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                        title={`Substitute / bench ${player.name}`}
                        aria-label={`Substitute ${player.name}`}
                      >
                        <Coffee className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Score & Stepper Controls */}
            <div className="pt-1.5 border-t border-white/10 mt-1.5 shrink-0 flex flex-col items-center">
              <div
                className="font-mono font-black text-amber-300 leading-none py-0.5 sm:py-1"
                style={{ fontSize: 'clamp(1.75rem, 4.5vh, 2.5rem)' }}
              >
                {match.score1}
              </div>

              {/* Scoring Buttons: -1, +1, +5 (Strictly >=40px touch targets) */}
              <div className="flex items-center gap-1 w-full touch-manipulation mt-1">
                <button
                  type="button"
                  id={`floating-btn-score1-minus-${match.id}`}
                  disabled={isCompleted || match.score1 <= 0}
                  onClick={() => handleScoreChange(1, -1)}
                  className="w-10 min-h-[40px] rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none shrink-0"
                  title="Minus 1 point"
                  aria-label="Team 1 minus 1 point"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  id={`floating-btn-score1-plus1-${match.id}`}
                  disabled={isCompleted}
                  onClick={() => handleScoreChange(1, 1)}
                  className="flex-1 min-h-[40px] px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-30 disabled:pointer-events-none"
                  title="Plus 1 point"
                  aria-label="Team 1 plus 1 point"
                >
                  <Plus className="w-3.5 h-3.5" /> 1
                </button>
                <button
                  type="button"
                  id={`floating-btn-score1-plus5-${match.id}`}
                  disabled={isCompleted}
                  onClick={() => handleScoreChange(1, 5)}
                  className="w-10 min-h-[40px] rounded-lg bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none shrink-0"
                  title="Plus 5 points"
                  aria-label="Team 1 plus 5 points"
                >
                  +5
                </button>
              </div>
            </div>
          </div>

          {/* TEAM 2 COLUMN */}
          <div
            className={`rounded-xl p-2 sm:p-2.5 border flex flex-col justify-between min-h-0 transition-colors ${
              team2Won
                ? 'bg-emerald-950/50 border-emerald-500/50'
                : 'bg-white/5 border-white/10'
            }`}
          >
            {/* Header & Players */}
            <div className="min-h-0 flex flex-col">
              <div className="flex items-center justify-between gap-1 mb-1.5 shrink-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1 truncate">
                  <span>Team 2</span>
                  {isTeam2LockedDuo && (
                    <span className="text-amber-400 shrink-0" title="Locked Duo">
                      <Link2 className="w-3 h-3" />
                    </span>
                  )}
                </span>
                {team2Won && (
                  <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.2 rounded-md flex items-center gap-0.5 shrink-0">
                    <Trophy className="w-2.5 h-2.5 text-emerald-400" /> Win
                  </span>
                )}
              </div>

              {/* Player Chips (Handles 1, 2, or up to 4 players cleanly) */}
              <div className="flex flex-wrap gap-1 min-h-0">
                {team2Players.map((player) => (
                  <div
                    key={`floating-t2-p-${player.id}`}
                    className={`flex items-center justify-between gap-1 p-1 rounded-lg bg-white/5 border border-white/5 min-w-0 ${
                      team2Players.length > 2 ? 'w-full sm:w-[calc(50%-2px)]' : 'w-full'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 ${player.avatarColor}`}
                      >
                        {player.name.charAt(0)}
                      </span>
                      <span className="text-xs font-semibold text-white truncate leading-tight">
                        {player.name}
                      </span>
                    </div>

                    {onBenchAndReplacePlayer && !isCompleted && (
                      <button
                        type="button"
                        onClick={() => setBenchConfirmPlayer(player)}
                        className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-amber-300 hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                        title={`Substitute / bench ${player.name}`}
                        aria-label={`Substitute ${player.name}`}
                      >
                        <Coffee className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Score & Stepper Controls */}
            <div className="pt-1.5 border-t border-white/10 mt-1.5 shrink-0 flex flex-col items-center">
              <div
                className="font-mono font-black text-amber-300 leading-none py-0.5 sm:py-1"
                style={{ fontSize: 'clamp(1.75rem, 4.5vh, 2.5rem)' }}
              >
                {match.score2}
              </div>

              {/* Scoring Buttons: -1, +1, +5 (Strictly >=40px touch targets) */}
              <div className="flex items-center gap-1 w-full touch-manipulation mt-1">
                <button
                  type="button"
                  id={`floating-btn-score2-minus-${match.id}`}
                  disabled={isCompleted || match.score2 <= 0}
                  onClick={() => handleScoreChange(2, -1)}
                  className="w-10 min-h-[40px] rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none shrink-0"
                  title="Minus 1 point"
                  aria-label="Team 2 minus 1 point"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  id={`floating-btn-score2-plus1-${match.id}`}
                  disabled={isCompleted}
                  onClick={() => handleScoreChange(2, 1)}
                  className="flex-1 min-h-[40px] px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-30 disabled:pointer-events-none"
                  title="Plus 1 point"
                  aria-label="Team 2 plus 1 point"
                >
                  <Plus className="w-3.5 h-3.5" /> 1
                </button>
                <button
                  type="button"
                  id={`floating-btn-score2-plus5-${match.id}`}
                  disabled={isCompleted}
                  onClick={() => handleScoreChange(2, 5)}
                  className="w-10 min-h-[40px] rounded-lg bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs flex items-center justify-center transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none shrink-0"
                  title="Plus 5 points"
                  aria-label="Team 2 plus 5 points"
                >
                  +5
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Pinned at the Bottom: Single Row */}
        <div className="pt-2 border-t border-white/10 shrink-0 flex items-center gap-1.5">
          {/* Primary Action Button (Largest) */}
          {isLive ? (
            <button
              type="button"
              id="btn-floating-finish-match"
              onClick={handleFinish}
              className="flex-1 min-h-[40px] px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="truncate">Finish Match</span>
            </button>
          ) : isPending ? (
            <button
              type="button"
              id="btn-floating-start-match"
              onClick={handleStart}
              className="flex-1 min-h-[40px] px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 shadow-sm"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span className="truncate">Start Match</span>
            </button>
          ) : (
            <button
              type="button"
              id="btn-floating-reopen-match"
              onClick={handleReopen}
              className="flex-1 min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="truncate">Reopen Match</span>
            </button>
          )}

          {/* Secondary Actions Row */}
          {onEditLineup && !isCompleted && (
            <button
              type="button"
              onClick={() => onEditLineup(match.id)}
              className="min-h-[40px] px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="Edit players"
              aria-label="Edit match lineup"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline text-[11px]">Edit</span>
            </button>
          )}

          {onShuffleLineup && !isCompleted && (
            <button
              type="button"
              onClick={() => {
                soundFx.playPointChime();
                onShuffleLineup(match.id);
              }}
              className="min-h-[40px] px-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="Shuffle teams"
              aria-label="Shuffle lineup"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span className="hidden xs:inline sm:inline text-[11px]">Shuffle</span>
            </button>
          )}

          {onDeleteMatch && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="min-h-[40px] w-10 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Delete match"
              aria-label="Delete match"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Bench Substitute Confirmation Modal */}
      {benchConfirmPlayer && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xs w-full p-4 text-center space-y-3 shadow-xl border border-slate-200 text-slate-900 max-h-[90dvh] overflow-y-auto">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Substitute {benchConfirmPlayer.name}?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-snug">
                Move {benchConfirmPlayer.name} to bench and rotate in the next prioritized player.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBenchConfirmPlayer(null)}
                className="flex-1 min-h-[40px] rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBenchPlayer}
                className="flex-1 min-h-[40px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider cursor-pointer shadow-xs"
              >
                Substitute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xs w-full p-4 text-center space-y-3 shadow-xl border border-slate-200 text-slate-900 max-h-[90dvh] overflow-y-auto">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                Delete Court {match.courtNumber || '1'}?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-snug">
                Remove match from Round {roundNumber}. Player stats will not be recorded.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 min-h-[40px] rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider cursor-pointer shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
