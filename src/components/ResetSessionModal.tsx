import React from 'react';
import { RotateCcw, X, RefreshCw, AlertTriangle } from 'lucide-react';
import { soundFx } from '../utils/audio';

export interface ResetSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'social' | 'openplay';
  playersCount: number;
  activeMatchesCount: number;
  historyCount: number;
  onResetKeepPlayers: () => void;
  onResetFull: () => void;
}

export const ResetSessionModal: React.FC<ResetSessionModalProps> = ({
  isOpen,
  onClose,
  mode,
  playersCount,
  activeMatchesCount,
  historyCount,
  onResetKeepPlayers,
  onResetFull,
}) => {
  if (!isOpen) return null;

  const isSocial = mode === 'social';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden my-auto">
        {/* Pinned Header */}
        <div
          className={`shrink-0 p-3.5 sm:p-5 text-white flex items-center justify-between ${
            isSocial
              ? 'bg-gradient-to-r from-indigo-900 to-slate-900'
              : 'bg-gradient-to-r from-emerald-800 to-teal-900'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center font-black shadow-inner shrink-0 ${
                isSocial ? 'bg-yellow-400 text-indigo-950' : 'bg-emerald-400 text-emerald-950'
              }`}
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black leading-tight truncate">
                {isSocial ? 'Reset Social Tournament Session' : 'Reset Open Play Session'}
              </h2>
              <p
                className={`text-[11px] sm:text-xs font-semibold truncate ${
                  isSocial ? 'text-indigo-200' : 'text-emerald-200'
                }`}
              >
                {isSocial
                  ? 'Start a fresh tournament for your rounds and squad'
                  : 'Start a fresh session for your courts and queue'}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-reset-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body (Prevents cropping on small or landscape screens) */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3.5 sm:p-5 space-y-3 sm:space-y-4 overscroll-contain">
          {/* Current State Summary */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 py-2 px-2.5 sm:px-3 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200 text-center">
            <div>
              <span className="block text-[10px] sm:text-xs font-bold text-slate-500">Live Courts</span>
              <span className="text-sm sm:text-base font-black text-slate-800">
                {activeMatchesCount} in play
              </span>
            </div>
            <div className="border-x border-slate-200">
              <span className="block text-[10px] sm:text-xs font-bold text-slate-500">
                {isSocial ? 'Rounds' : 'History'}
              </span>
              <span className="text-sm sm:text-base font-black text-slate-800">
                {historyCount} {isSocial ? 'rounds' : 'finished'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] sm:text-xs font-bold text-slate-500">
                {isSocial ? 'Squad Roster' : 'Queue & Squad'}
              </span>
              <span
                className={`text-sm sm:text-base font-black ${
                  isSocial ? 'text-indigo-700' : 'text-emerald-700'
                }`}
              >
                {playersCount} players
              </span>
            </div>
          </div>

          <p className="text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed">
            Please choose how you would like to reset your {isSocial ? 'Social Tournament' : 'Open Play'} session:
          </p>

          {/* Option 1: Keep current players */}
          <div
            className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 transition-all ${
              isSocial
                ? 'border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50'
                : 'border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full text-white text-[11px] sm:text-xs font-black flex items-center justify-center shrink-0 ${
                    isSocial ? 'bg-indigo-600' : 'bg-emerald-600'
                  }`}
                >
                  1
                </span>
                <h3
                  className={`text-xs sm:text-sm font-black ${
                    isSocial ? 'text-indigo-950' : 'text-emerald-950'
                  }`}
                >
                  {isSocial
                    ? 'Reset Rounds & Standings (Keep Player Roster)'
                    : 'Reset Matches & Streaks (Keep Current Players)'}
                </h3>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white shrink-0 ${
                  isSocial ? 'bg-indigo-600' : 'bg-emerald-600'
                }`}
              >
                Recommended
              </span>
            </div>
            <p
              className={`text-[11px] sm:text-xs mb-2.5 sm:mb-3 pl-7 sm:pl-8 leading-relaxed ${
                isSocial ? 'text-indigo-900/80' : 'text-emerald-900/80'
              }`}
            >
              {isSocial
                ? `Clears all generated rounds, matches, and standings. All ${playersCount} player(s) remain in your squad, ready to generate Round 1!`
                : `Clears all live court matches, wipes match history, and resets win-streaks back to 0. All ${playersCount} player(s) are returned to the waiting queue in order, ready for game 1!`}
            </p>
            <div className="pl-7 sm:pl-8">
              <button
                type="button"
                id="btn-confirm-reset-keep-players"
                onClick={() => {
                  soundFx.playPointChime();
                  onResetKeepPlayers();
                  onClose();
                }}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-white font-black text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer active:scale-95 ${
                  isSocial
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>
                  {isSocial
                    ? `Reset Rounds & Retain Roster (${playersCount} Players)`
                    : `Reset Matches & Retain Squad (${playersCount} Players)`}
                </span>
              </button>
            </div>
          </div>

          {/* Option 2: Full Reset */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-rose-200 bg-rose-50/40 hover:bg-rose-50 transition-all">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-rose-600 text-white text-[11px] sm:text-xs font-black flex items-center justify-center shrink-0">
                  2
                </span>
                <h3 className="text-xs sm:text-sm font-black text-rose-950">
                  Full Fresh Reset (Clear All &amp; Start Clean)
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                Full Wipe
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-rose-900/80 mb-2.5 sm:mb-3 pl-7 sm:pl-8 leading-relaxed">
              {isSocial
                ? 'Clears all rounds, matches, upcoming predictions, and wipes all players so you can start with an empty squad.'
                : 'Clears all live courts, clears match history, and clears all players so you can start with a clean, empty queue.'}
            </p>
            <div className="pl-7 sm:pl-8">
              <button
                type="button"
                id="btn-confirm-reset-full"
                onClick={() => {
                  soundFx.playPointChime();
                  onResetFull();
                  onClose();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Full Reset (Clear Everything)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pinned Footer Cancel */}
        <div className="shrink-0 py-2.5 px-3.5 sm:px-5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end">
          <button
            type="button"
            id="btn-cancel-reset"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
