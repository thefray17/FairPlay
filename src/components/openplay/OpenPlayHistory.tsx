import React, { useState } from 'react';
import { OpenPlayMatch, OpenPlayPlayer } from '../../types/openPlay';
import { History, Trophy, Trash2, Clock, Edit2, Check, X } from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface OpenPlayHistoryProps {
  history: OpenPlayMatch[];
  playerRegistry: Record<string, OpenPlayPlayer>;
  onDeleteMatch: (matchId: string) => void;
  onClearHistory: () => void;
  onUpdateScore?: (matchId: string, score1: number, score2: number) => void;
}

export const OpenPlayHistory: React.FC<OpenPlayHistoryProps> = ({
  history,
  playerRegistry,
  onDeleteMatch,
  onClearHistory,
  onUpdateScore,
}) => {
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [tempScore1, setTempScore1] = useState(0);
  const [tempScore2, setTempScore2] = useState(0);

  const startEdit = (matchId: string, score1: number, score2: number) => {
    setEditingMatchId(matchId);
    setTempScore1(score1);
    setTempScore2(score2);
  };

  const saveEdit = (matchId: string) => {
    if (onUpdateScore) {
      onUpdateScore(matchId, tempScore1, tempScore2);
    }
    setEditingMatchId(null);
    soundFx.playPointChime();
  };

  const cancelEdit = () => {
    setEditingMatchId(null);
  };

  const formatMatchTime = (timestamp?: number) => {
    if (!timestamp) return 'Just now';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Open Play Match Log</h2>
            <p className="text-xs text-slate-500 font-semibold">
              {history.length} completed game{history.length === 1 ? '' : 's'} recorded • Editable scores
            </p>
          </div>
        </div>

        {history.length > 0 && (
          !confirmClearHistory ? (
            <button
              type="button"
              id="btn-openplay-clear-history"
              onClick={() => setConfirmClearHistory(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 hover:border-rose-300 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-bold transition-colors cursor-pointer"
              title="Clear all completed match logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl animate-in fade-in duration-150">
              <span className="text-[11px] font-bold text-rose-900">Clear all history?</span>
              <button
                type="button"
                id="btn-openplay-confirm-clear-history"
                onClick={() => {
                  setConfirmClearHistory(false);
                  onClearHistory();
                }}
                className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase cursor-pointer"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearHistory(false)}
                className="px-2 py-0.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] cursor-pointer"
              >
                No
              </button>
            </div>
          )
        )}
      </div>

      {/* List */}
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {history.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <History className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-600">No completed matches yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Finished games from Court 1, Court 2, etc. will appear here chronologically.
            </p>
          </div>
        ) : (
          history.map((m) => {
            const team1Names = m.team1.map((id) => playerRegistry[id]?.name || 'Player').join(' & ');
            const team2Names = m.team2.map((id) => playerRegistry[id]?.name || 'Player').join(' & ');
            const isTeam1Winner = m.score1 > m.score2;
            const isTeam2Winner = m.score2 > m.score1;
            const isEditing = editingMatchId === m.id;

            return (
              <div
                key={m.id}
                className="p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                    C{m.courtNumber}
                  </span>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900">
                        Game-{m.matchNumber}
                      </span>
                      <span className="text-[11px] text-slate-400">•</span>
                      <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatMatchTime(m.completedAt)}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <span
                        className={
                          isTeam1Winner
                            ? 'font-black text-emerald-800 flex items-center gap-1'
                            : 'text-slate-600'
                        }
                      >
                        {isTeam1Winner && <Trophy className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />}
                        {team1Names}
                      </span>

                      {isEditing ? (
                        <div className="flex items-center gap-1.5 my-1 sm:my-0 bg-slate-100 p-1.5 rounded-xl border border-slate-300">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setTempScore1((s) => Math.max(0, s - 1))}
                              className="w-6 h-6 rounded-md bg-white hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center cursor-pointer shadow-2xs"
                              aria-label="Decrease Team 1 score"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              min="0"
                              value={tempScore1}
                              onChange={(e) => setTempScore1(parseInt(e.target.value, 10) || 0)}
                              className="w-11 text-center py-0.5 px-1 rounded-md border border-emerald-500 bg-white font-black text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => setTempScore1((s) => s + 1)}
                              className="w-6 h-6 rounded-md bg-white hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center cursor-pointer shadow-2xs"
                              aria-label="Increase Team 1 score"
                            >
                              +
                            </button>
                          </div>
                          <span className="font-bold text-slate-400 text-xs">-</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setTempScore2((s) => Math.max(0, s - 1))}
                              className="w-6 h-6 rounded-md bg-white hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center cursor-pointer shadow-2xs"
                              aria-label="Decrease Team 2 score"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              min="0"
                              value={tempScore2}
                              onChange={(e) => setTempScore2(parseInt(e.target.value, 10) || 0)}
                              className="w-11 text-center py-0.5 px-1 rounded-md border border-emerald-500 bg-white font-black text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => setTempScore2((s) => s + 1)}
                              className="w-6 h-6 rounded-md bg-white hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center cursor-pointer shadow-2xs"
                              aria-label="Increase Team 2 score"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => saveEdit(m.id)}
                            className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] cursor-pointer shadow-xs ml-1"
                          >
                            <Check className="w-3 h-3 text-yellow-300" /> Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                            aria-label="Cancel editing score"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono font-black text-xs text-slate-900 border border-slate-200">
                          {m.score1} - {m.score2}
                        </span>
                      )}

                      <span
                        className={
                          isTeam2Winner
                            ? 'font-black text-emerald-800 flex items-center gap-1'
                            : 'text-slate-600'
                        }
                      >
                        {isTeam2Winner && <Trophy className="w-3.5 h-3.5 text-emerald-600 inline shrink-0" />}
                        {team2Names}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                    {isTeam1Winner ? 'Team 1 won' : isTeam2Winner ? 'Team 2 won' : 'Draw'}
                  </span>

                  {!isEditing && onUpdateScore && (
                    <button
                      type="button"
                      onClick={() => startEdit(m.id, m.score1, m.score2)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                      title="Edit match score"
                      aria-label="Edit match score"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onDeleteMatch(m.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete match log"
                    aria-label="Delete match log"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
