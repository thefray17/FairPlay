import React, { useState } from 'react';
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
  MoreHorizontal,
  Coffee,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface CompactMatchRowProps {
  match: Match;
  roundNumber: number;
  playersMap: Record<string, Player>;
  config: SessionConfig;
  partnerCounts?: Record<string, Record<string, number>>;
  isSelected: boolean;
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

export const CompactMatchRow: React.FC<CompactMatchRowProps> = ({
  match,
  roundNumber,
  playersMap,
  config,
  partnerCounts,
  isSelected,
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
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const team1Players = match.team1.playerIds.map((id) => playersMap[id]).filter(Boolean);
  const team2Players = match.team2.playerIds.map((id) => playersMap[id]).filter(Boolean);

  const isTeam1LockedDuo =
    team1Players.length >= 2 && team1Players[0].duoPartnerId === team1Players[1].id;
  const isTeam2LockedDuo =
    team2Players.length >= 2 && team2Players[0].duoPartnerId === team2Players[1].id;

  const isCompleted = match.completed;
  const isLive = !isCompleted && match.status === 'in_progress';
  const isPending = !isCompleted && match.status !== 'in_progress';

  const team1Won = isCompleted && match.score1 > match.score2;
  const team2Won = isCompleted && match.score2 > match.score1;

  const handleQuickAddScore = (e: React.MouseEvent, team: 1 | 2, delta: number) => {
    e.stopPropagation();
    soundFx.playPointChime();
    const newScore1 = team === 1 ? Math.max(0, match.score1 + delta) : match.score1;
    const newScore2 = team === 2 ? Math.max(0, match.score2 + delta) : match.score2;
    onUpdateScore(match.id, newScore1, newScore2, match.completed);
  };

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playWhistle();
    if (onStartMatch) {
      onStartMatch(match.id);
    }
    onSelectMatch(match.id);
  };

  const handleReopen = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playPointChime();
    onReopenMatch(match.id);
  };

  const handleShuffle = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundFx.playPointChime();
    if (onShuffleLineup) {
      onShuffleLineup(match.id);
    }
    setShowMenu(false);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEditLineup) {
      onEditLineup(match.id);
    }
    setShowMenu(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteMatch) {
      onDeleteMatch(match.id);
    }
    setShowDeleteConfirm(false);
    setShowMenu(false);
  };

  return (
    <div
      id={`compact-match-row-${match.id}`}
      onClick={() => onSelectMatch(match.id)}
      className={`relative group rounded-2xl border transition-all p-3 sm:p-4 select-none cursor-pointer ${
        isSelected
          ? 'ring-2 ring-indigo-600 border-indigo-600 bg-indigo-50/70 shadow-md'
          : isLive
          ? 'bg-amber-50/60 border-amber-300 hover:border-amber-400 hover:bg-amber-50 shadow-xs'
          : isCompleted
          ? 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs text-slate-800'
          : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-xs'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Court & Status Badges */}
        <div className="flex items-center gap-2 flex-wrap min-w-[140px] shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`px-2.5 py-0.5 text-[10px] font-black rounded-lg uppercase tracking-wider ${
                isLive
                  ? 'bg-indigo-950 text-yellow-300'
                  : isCompleted
                  ? 'bg-slate-700 text-white'
                  : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
              }`}
            >
              {match.courtNumber ? `Court ${match.courtNumber}` : `M${match.matchOrder || 1}`}
            </span>

            {match.isCatchUpMatch && (
              <span className="px-1.5 py-0.5 text-[9px] font-black rounded uppercase bg-amber-400 text-amber-950">
                ⚡ Catch-Up
              </span>
            )}
          </div>

          {isLive ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-yellow-300 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          ) : isCompleted ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Done
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
              Ready
            </span>
          )}
        </div>

        {/* Center: Teams & Players Lineup */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 min-w-0">
          {/* Team 1 */}
          <div
            className={`flex items-center justify-start sm:justify-end gap-2 p-2 rounded-xl transition-colors ${
              team1Won ? 'bg-emerald-50/80 font-black text-emerald-950' : 'text-slate-800 font-bold'
            }`}
          >
            <div className="flex items-center gap-1.5 flex-wrap justify-start sm:justify-end min-w-0">
              {team1Players.map((p) => (
                <div key={`t1-p-${p.id}`} className="flex items-center gap-1 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 ${p.avatarColor}`}
                  >
                    {p.name.charAt(0)}
                  </span>
                  <span className="text-xs sm:text-sm truncate max-w-[90px] sm:max-w-[110px]">
                    {p.name}
                  </span>
                </div>
              ))}
              {isTeam1LockedDuo && (
                <span title="Locked Duo" className="shrink-0 text-indigo-600">
                  <Link2 className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>

          {/* VS & Score in Center */}
          <div className="flex items-center justify-center gap-1.5 shrink-0 px-2">
            {isCompleted ? (
              <div className="flex items-center gap-1 font-mono text-sm sm:text-base font-black px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200">
                <span className={team1Won ? 'text-emerald-700' : 'text-slate-600'}>
                  {match.score1}
                </span>
                <span className="text-slate-400">-</span>
                <span className={team2Won ? 'text-emerald-700' : 'text-slate-600'}>
                  {match.score2}
                </span>
              </div>
            ) : isLive ? (
              <div className="flex items-center gap-1 font-mono text-base sm:text-lg font-black px-3 py-1 rounded-xl bg-yellow-400 text-indigo-950 shadow-xs">
                <span>{match.score1}</span>
                <span className="text-indigo-900/60">:</span>
                <span>{match.score2}</span>
              </div>
            ) : (
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">
                VS
              </span>
            )}
          </div>

          {/* Team 2 */}
          <div
            className={`flex items-center justify-start gap-2 p-2 rounded-xl transition-colors ${
              team2Won ? 'bg-emerald-50/80 font-black text-emerald-950' : 'text-slate-800 font-bold'
            }`}
          >
            <div className="flex items-center gap-1.5 flex-wrap justify-start min-w-0">
              {team2Players.map((p) => (
                <div key={`t2-p-${p.id}`} className="flex items-center gap-1 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 ${p.avatarColor}`}
                  >
                    {p.name.charAt(0)}
                  </span>
                  <span className="text-xs sm:text-sm truncate max-w-[90px] sm:max-w-[110px]">
                    {p.name}
                  </span>
                </div>
              ))}
              {isTeam2LockedDuo && (
                <span title="Locked Duo" className="shrink-0 text-indigo-600">
                  <Link2 className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          {isLive ? (
            <div className="flex items-center gap-1">
              {/* Quick +1 Team 1 */}
              <button
                type="button"
                onClick={(e) => handleQuickAddScore(e, 1, 1)}
                className="px-2 py-1 bg-amber-200 hover:bg-amber-300 text-indigo-950 rounded-lg text-xs font-black transition-colors cursor-pointer shadow-2xs"
                title={`+1 pt for ${team1Players.map((p) => p.name).join(' & ')}`}
              >
                +1 T1
              </button>
              {/* Quick +1 Team 2 */}
              <button
                type="button"
                onClick={(e) => handleQuickAddScore(e, 2, 1)}
                className="px-2 py-1 bg-amber-200 hover:bg-amber-300 text-indigo-950 rounded-lg text-xs font-black transition-colors cursor-pointer shadow-2xs"
                title={`+1 pt for ${team2Players.map((p) => p.name).join(' & ')}`}
              >
                +1 T2
              </button>
              {/* Score / Officiate button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMatch(match.id);
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Score</span>
              </button>
            </div>
          ) : isPending ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                id={`btn-start-compact-match-${match.id}`}
                onClick={handleStart}
                className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-indigo-950 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Play className="w-3 h-3 fill-indigo-950 text-indigo-950" />
                <span>Start</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMatch(match.id);
                }}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs transition-colors cursor-pointer"
                title="Open match window"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReopen}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="Reopen match to edit scores"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reopen</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMatch(match.id);
                }}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs transition-colors cursor-pointer"
                title="View match window"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Match Tools Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 rounded-xl hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              title="More match options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-30 space-y-0.5 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-150">
                  {onEditLineup && (
                    <button
                      type="button"
                      onClick={handleEdit}
                      className="w-full px-3 py-2 text-left font-bold hover:bg-indigo-50 hover:text-indigo-900 flex items-center gap-2 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Edit Lineup</span>
                    </button>
                  )}

                  {onShuffleLineup && !isCompleted && (
                    <button
                      type="button"
                      onClick={handleShuffle}
                      className="w-full px-3 py-2 text-left font-bold hover:bg-indigo-50 hover:text-indigo-900 flex items-center gap-2 cursor-pointer"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Shuffle Pairings</span>
                    </button>
                  )}

                  {onDeleteMatch && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(true);
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-2 text-left font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer border-t border-slate-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Match</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Delete This Match?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Court {match.courtNumber || '1'} in Round {roundNumber} will be permanently removed from the schedule.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider cursor-pointer shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
