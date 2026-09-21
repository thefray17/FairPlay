import React, { useState } from 'react';
import { Match, Player, Round, SessionConfig } from '../types';
import { getDevicePlayerProfile } from '../utils/identitySync';
import { History, CheckCircle2, Trophy, Edit2, Check, X, Trash2, AlertTriangle, Clock, UserCheck } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface HistoryViewProps {
  rounds: Round[];
  playersMap: Record<string, Player>;
  config: SessionConfig;
  onUpdateScore: (matchId: string, score1: number, score2: number, completed?: boolean) => void;
  onDeleteMatch?: (matchId: string) => void;
  onDeleteRound?: (roundNumber: number) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  rounds,
  playersMap,
  config,
  onUpdateScore,
  onDeleteMatch,
  onDeleteRound,
}) => {
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [tempScore1, setTempScore1] = useState(0);
  const [tempScore2, setTempScore2] = useState(0);
  const [matchToDelete, setMatchToDelete] = useState<{ match: Match; roundNumber: number } | null>(null);
  const [roundToDelete, setRoundToDelete] = useState<number | null>(null);
  const [onlyMyMatches, setOnlyMyMatches] = useState(false);

  const deviceProfile = getDevicePlayerProfile();

  const startEdit = (matchId: string, score1: number, score2: number) => {
    setEditingMatchId(matchId);
    setTempScore1(score1);
    setTempScore2(score2);
  };

  const saveEdit = (matchId: string) => {
    onUpdateScore(matchId, tempScore1, tempScore2, true);
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

  if (rounds.length === 0) {
    return (
      <div id="no-history" className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-yellow-400 text-indigo-950 flex items-center justify-center mx-auto mb-4 shadow-md font-black">
          <History className="w-8 h-8 text-indigo-950" />
        </div>
        <h3 className="font-black text-indigo-950 text-lg mb-1">No Match History Yet</h3>
        <p className="text-xs font-semibold text-slate-500">
          Generated rounds and matches will be logged here with complete scores, winners, and court logs.
        </p>
      </div>
    );
  }

  // Reverse so latest round is at the top
  const sortedRounds = [...rounds].reverse();

  return (
    <div id="history-view" className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-3 bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <span className="w-1.5 h-5 sm:w-2 sm:h-6 bg-yellow-400 rounded-full shrink-0"></span>
          <History className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
          <div>
            <h2 className="text-base sm:text-xl font-black text-indigo-950">Match &amp; Round History</h2>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500">
              Complete archive of all generated rounds and scores. You can edit any past score if an error was made.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {deviceProfile?.id && (
            <button
              type="button"
              id="btn-toggle-my-matches-history"
              onClick={() => setOnlyMyMatches(!onlyMyMatches)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
                onlyMyMatches
                  ? 'bg-yellow-400 text-indigo-950 shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{onlyMyMatches ? 'Showing My Matches' : 'My Matches Only'}</span>
            </button>
          )}
          <span className="text-[10px] sm:text-xs font-black px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-slate-100 text-slate-800 uppercase tracking-wider border border-slate-200">
            {rounds.length} {rounds.length === 1 ? 'Round' : 'Rounds'} Played
          </span>
        </div>
      </div>

      <div className="space-y-3.5 sm:space-y-5">
        {sortedRounds.map((round) => {
          const restingPlayers = round.restingPlayerIds
            .map((id) => playersMap[id])
            .filter(Boolean);

          const displayedMatches = onlyMyMatches && deviceProfile?.id
            ? round.matches.filter((m) => {
                const pIds = [...m.team1.playerIds, ...m.team2.playerIds];
                return pIds.some((id) => {
                  const p = playersMap[id];
                  return p && (p.playerProfileId === deviceProfile.id || p.id === deviceProfile.id || p.name.toLowerCase() === deviceProfile.name.toLowerCase());
                });
              })
            : round.matches;

          if (onlyMyMatches && displayedMatches.length === 0) {
            return null;
          }

          return (
            <div
              key={round.roundNumber}
              id={`history-round-${round.roundNumber}`}
              className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Round Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3.5 bg-slate-50/80 border-b border-slate-100">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    R{round.roundNumber}
                  </span>
                  <h3 className="font-black text-slate-900 text-xs sm:text-sm">Round {round.roundNumber}</h3>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-500">
                    • {displayedMatches.length} {displayedMatches.length === 1 ? 'Court' : 'Courts'}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 text-[11px] sm:text-xs font-semibold text-slate-600">
                  {restingPlayers.length > 0 ? (
                    <span className="truncate">
                      Resting: <strong className="text-indigo-900 font-bold">{restingPlayers.map((p) => p.name).join(', ')}</strong>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200/80">
                      ★ Target: {round.targetMatchesPerPlayer || round.roundNumber} game{(round.targetMatchesPerPlayer || round.roundNumber) > 1 ? 's' : ''}/player (No Bench)
                    </span>
                  )}
                  {onDeleteRound && (
                    <button
                      type="button"
                      onClick={() => setRoundToDelete(round.roundNumber)}
                      className="text-slate-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      title={`Delete Round ${round.roundNumber} and all its matches`}
                      aria-label={`Delete Round ${round.roundNumber}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Delete Round</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Matches List */}
              <div className="divide-y divide-slate-100">
                {displayedMatches.map((match, mIdx) => {
                  const t1Players = match.team1.playerIds.map((id) => playersMap[id]).filter(Boolean);
                  const t2Players = match.team2.playerIds.map((id) => playersMap[id]).filter(Boolean);
                  const isEditing = editingMatchId === match.id;
                  const team1Won = match.completed && match.score1 > match.score2;
                  const team2Won = match.completed && match.score2 > match.score1;
                  const team1Names = t1Players.map((p) => p.name).join(' & ');
                  const team2Names = t2Players.map((p) => p.name).join(' & ');
                  const timestamp = match.finishedAt || match.startedAt || round.generatedAt;
                  const userIsInMatch = !!(
                    deviceProfile?.id &&
                    [...t1Players, ...t2Players].some(
                      (p) => p.playerProfileId === deviceProfile.id || p.id === deviceProfile.id || p.name.toLowerCase() === deviceProfile.name.toLowerCase()
                    )
                  );

                  return (
                    <div
                      key={match.id}
                      className={`p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        userIsInMatch
                          ? 'bg-amber-50/40 border-l-4 border-yellow-400 hover:bg-amber-50/70'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <span className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                          userIsInMatch
                            ? 'bg-yellow-400 text-indigo-950 font-black shadow-xs'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {match.courtNumber ? `C${match.courtNumber}` : `M${match.matchOrder || mIdx + 1}`}
                        </span>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">
                              Game-{match.matchOrder || mIdx + 1}
                            </span>
                            {userIsInMatch && (
                              <span className="px-1.5 py-0.2 rounded-full bg-yellow-400 text-indigo-950 font-black text-[9px]">
                                Your Match
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400">•</span>
                            <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatMatchTime(timestamp)}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold">
                            <span
                              className={
                                team1Won
                                  ? 'font-black text-indigo-900 flex items-center gap-1'
                                  : 'text-slate-600'
                              }
                            >
                              {team1Won && <Trophy className="w-3.5 h-3.5 text-indigo-600 inline shrink-0" />}
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
                                    className="w-11 text-center py-0.5 px-1 rounded-md border border-indigo-500 bg-white font-black text-xs"
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
                                    className="w-11 text-center py-0.5 px-1 rounded-md border border-indigo-500 bg-white font-black text-xs"
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
                                  onClick={() => saveEdit(match.id)}
                                  className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] cursor-pointer shadow-xs ml-1"
                                >
                                  <Check className="w-3 h-3 text-yellow-300" /> Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                                  aria-label="Cancel edit"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono font-black text-xs text-slate-900 border border-slate-200">
                                {match.score1} - {match.score2}
                              </span>
                            )}

                            <span
                              className={
                                team2Won
                                  ? 'font-black text-indigo-900 flex items-center gap-1'
                                  : 'text-slate-600'
                              }
                            >
                              {team2Won && <Trophy className="w-3.5 h-3.5 text-indigo-600 inline shrink-0" />}
                              {team2Names}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                        <span className="text-[11px] font-semibold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                          {team1Won ? 'Team 1 won' : team2Won ? 'Team 2 won' : match.completed ? 'Draw' : 'In Progress'}
                        </span>

                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => startEdit(match.id, match.score1, match.score2)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="Edit match score"
                            aria-label="Edit match score"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {onDeleteMatch && (
                          <button
                            type="button"
                            onClick={() => setMatchToDelete({ match, roundNumber: round.roundNumber })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete this match from history"
                            aria-label="Delete this match from history"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Match Confirmation Modal */}
      {matchToDelete && (
        <div
          id="delete-match-modal"
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-match-modal-title"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200 shadow-xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 id="delete-match-modal-title" className="text-lg font-black text-slate-900">
                  Delete Match from History?
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  Round {matchToDelete.roundNumber} • Court {matchToDelete.match.courtNumber}
                </p>
              </div>
            </div>

            {/* Match summary card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate mr-2">
                  <span className="font-bold text-slate-500 shrink-0">Team 1:</span>
                  <span className="font-black text-slate-900 truncate">
                    {matchToDelete.match.team1.playerIds
                      .map((id) => playersMap[id]?.name || 'Player')
                      .join(' & ')}
                  </span>
                </div>
                <span className="font-black text-xs text-slate-950 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-xs shrink-0">
                  {matchToDelete.match.score1}
                </span>
              </div>
              <div className="border-t border-slate-200/80 my-1"></div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate mr-2">
                  <span className="font-bold text-slate-500 shrink-0">Team 2:</span>
                  <span className="font-black text-slate-900 truncate">
                    {matchToDelete.match.team2.playerIds
                      .map((id) => playersMap[id]?.name || 'Player')
                      .join(' & ')}
                  </span>
                </div>
                <span className="font-black text-xs text-slate-950 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-xs shrink-0">
                  {matchToDelete.match.score2}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-200 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Deleting this match will remove its recorded score and update player win/loss records and matches-played counts across all leaderboards.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                id="btn-cancel-delete-match"
                onClick={() => setMatchToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-black text-xs uppercase hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-match"
                onClick={() => {
                  if (onDeleteMatch) {
                    onDeleteMatch(matchToDelete.match.id);
                  }
                  setMatchToDelete(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Delete Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Round Confirmation Modal */}
      {roundToDelete !== null && (
        <div
          id="delete-round-modal"
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-round-modal-title"
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 border border-red-200 shadow-xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 id="delete-round-modal-title" className="text-lg font-black text-slate-900">
                  Delete Round {roundToDelete}?
                </h3>
                <p className="text-xs font-semibold text-slate-500">
                  This will remove Round {roundToDelete} and all matches within it.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-200 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                All matches and scores in Round {roundToDelete} will be removed. Standings and fair rotation counts will be updated immediately.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                id="btn-cancel-delete-round"
                onClick={() => setRoundToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-black text-xs uppercase hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-delete-round"
                onClick={() => {
                  if (onDeleteRound) {
                    onDeleteRound(roundToDelete);
                  }
                  setRoundToDelete(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Delete Round
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
