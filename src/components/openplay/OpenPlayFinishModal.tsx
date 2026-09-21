import React, { useState, useEffect } from 'react';
import { OpenPlayMatch, OpenPlayPlayer, OpenPlayConfig } from '../../types/openPlay';
import { X, Trophy, Check, ArrowRightLeft, Users, Zap, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFx } from '../../utils/audio';

interface OpenPlayFinishModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: OpenPlayMatch | null;
  config: OpenPlayConfig;
  playerRegistry: Record<string, OpenPlayPlayer>;
  winnersQueue: string[];
  losersQueue: string[];
  restingBench: string[];
  onConfirmFinish: (
    matchId: string,
    score1: number,
    score2: number
  ) => void;
}

export const OpenPlayFinishModal: React.FC<OpenPlayFinishModalProps> = ({
  isOpen,
  onClose,
  match,
  config,
  playerRegistry,
  winnersQueue,
  losersQueue,
  restingBench,
  onConfirmFinish,
}) => {
  const [score1, setScore1] = useState<number>(0);
  const [score2, setScore2] = useState<number>(0);

  useEffect(() => {
    if (match) {
      setScore1(match.score1);
      setScore2(match.score2);
    }
  }, [match]);

  const team1Names = match?.team1.map((id) => playerRegistry[id]?.name || 'Player') || [];
  const team2Names = match?.team2.map((id) => playerRegistry[id]?.name || 'Player') || [];

  const isTeam1Winner = score1 > score2;
  const isTeam2Winner = score2 > score1;

  const winnerIds = isTeam1Winner ? (match?.team1 || []) : isTeam2Winner ? (match?.team2 || []) : (match?.team1 || []);
  const loserIds = isTeam1Winner ? (match?.team2 || []) : isTeam2Winner ? (match?.team1 || []) : (match?.team2 || []);

  const winnerNames = winnerIds.map((id) => playerRegistry[id]?.name || 'Player');
  const loserNames = loserIds.map((id) => playerRegistry[id]?.name || 'Player');

  if (!isOpen || !match) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      confetti({
        particleCount: 60,
        spread: 55,
        origin: { y: 0.6 },
      });
    } catch {}

    soundFx.playVictoryFanfare();
    onConfirmFinish(match.id, score1, score2);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-yellow-400 text-emerald-950 flex items-center justify-center font-black">
              <Trophy className="w-4 h-4 fill-emerald-950" />
            </div>
            <div>
              <h2 className="text-base font-black">Record Match Outcome</h2>
              <p className="text-xs text-emerald-200/80 font-semibold">
                Court {match.courtNumber} • 3-Bucket Universal Cycle
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Final Score Selection */}
          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
              Final Score
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Team 1 Card */}
              <div
                className={`p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                  isTeam1Winner
                    ? 'border-emerald-500 bg-emerald-50/80'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
                onClick={() => {
                  if (score1 <= score2) setScore1(config.targetPoints);
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-slate-800">Team 1</span>
                  {isTeam1Winner && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                      Winner
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 font-semibold truncate mb-2">
                  {team1Names.join(' & ')}
                </p>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={score1}
                  onChange={(e) => setScore1(parseInt(e.target.value) || 0)}
                  className="w-full text-center text-2xl font-black font-mono bg-white border border-slate-300 rounded-xl py-1 text-slate-900 focus:outline-emerald-500"
                />
              </div>

              {/* Team 2 Card */}
              <div
                className={`p-3 rounded-2xl border-2 transition-all cursor-pointer ${
                  isTeam2Winner
                    ? 'border-emerald-500 bg-emerald-50/80'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
                onClick={() => {
                  if (score2 <= score1) setScore2(config.targetPoints);
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-slate-800">Team 2</span>
                  {isTeam2Winner && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                      Winner
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 font-semibold truncate mb-2">
                  {team2Names.join(' & ')}
                </p>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={score2}
                  onChange={(e) => setScore2(parseInt(e.target.value) || 0)}
                  className="w-full text-center text-2xl font-black font-mono bg-white border border-slate-300 rounded-xl py-1 text-slate-900 focus:outline-emerald-500"
                />
              </div>
            </div>

            {/* Quick point chips */}
            <div className="flex items-center justify-end gap-1.5 mt-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Quick Set:</span>
              {[11, 15, 21].map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => {
                    if (score1 >= score2) setScore1(pts);
                    else setScore2(pts);
                  }}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  {pts} pts
                </button>
              ))}
            </div>
          </div>

          {/* 3 Core Buckets Universal Cycle Dispatch Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Universal Match Cycle Re-Queue
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-500">FIFO Lists</span>
            </div>

            {/* Winners dispatch */}
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-md bg-yellow-400 text-emerald-950 font-black text-[10px] flex items-center justify-center shrink-0">
                  🏆
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-amber-950">
                    Winners ➔ Back of Winners Queue:
                  </p>
                  <p className="text-xs text-amber-900 font-semibold truncate">
                    {winnerNames.join(' & ')}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white text-amber-900 border border-amber-300 shrink-0">
                Pos #{winnersQueue.length + 1}-{winnersQueue.length + winnerNames.length}
              </span>
            </div>

            {/* Losers dispatch */}
            <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-md bg-teal-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                  🥈
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-teal-950">
                    Losers ➔ Back of Losers Queue:
                  </p>
                  <p className="text-xs text-teal-900 font-semibold truncate">
                    {loserNames.join(' & ') || 'Losers'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white text-teal-900 border border-teal-300 shrink-0">
                FIFO Line
              </span>
            </div>

            {/* Bench Status Rule Note */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-md bg-amber-500 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                  🪑
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800">
                    {restingBench.length > 0
                      ? `Starting Bench: ${restingBench.length} player(s) remaining`
                      : 'Starting Bench: All initial bench players have played'}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {restingBench.length > 0
                      ? 'No swap happens: bench players are filled onto courts using winners & losers.'
                      : 'Active alternating cycle between Winners and Losers.'}
                  </p>
                </div>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 uppercase shrink-0">
                No Swap
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-bold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Record &amp; Execute Rotation</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
