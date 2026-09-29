import React, { useState, useMemo } from 'react';
import { Player, UpcomingMatch, Round, BatchGenerationConfig } from '../types';
import { EditLineupModal } from './EditLineupModal';
import {
  CalendarClock,
  Edit3,
  Users,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Link2,
  PlusCircle,
  RotateCw,
  Coffee,
  ChevronRight,
  Sliders,
  Layers,
} from 'lucide-react';

interface UpcomingMatchesProps {
  upcomingMatches?: UpcomingMatch[];
  playersMap: Record<string, Player>;
  allActivePlayers: Player[];
  playersPerTeam: number;
  onUpdateNextMatch?: (matchNumber: 1 | 2, team1: string[], team2: string[]) => void;
  onResetNextMatch?: (matchNumber: 1 | 2) => void;
  playerMatchCounts: Record<string, number>;
  partnerCounts?: Record<string, Record<string, number>>;
  rounds?: Round[];
  currentRoundNumber?: number;
  onOpenBatchGenerator?: () => void;
  onQuickGenerateMore?: () => void;
  lastBatchConfig?: BatchGenerationConfig | null;
  onSelectRound?: (roundNumber: number) => void;
}

export const UpcomingMatches: React.FC<UpcomingMatchesProps> = ({
  upcomingMatches = [],
  playersMap,
  allActivePlayers,
  playersPerTeam,
  onUpdateNextMatch,
  onResetNextMatch,
  playerMatchCounts,
  partnerCounts,
  rounds = [],
  currentRoundNumber = 1,
  onOpenBatchGenerator,
  onQuickGenerateMore,
  lastBatchConfig,
  onSelectRound,
}) => {
  const [editingMatch, setEditingMatch] = useState<UpcomingMatch | null>(null);

  // Future pre-generated rounds in this session that haven't been completed yet
  const futureRounds = useMemo(() => {
    return rounds.filter((r) => r.roundNumber > currentRoundNumber);
  }, [rounds, currentRoundNumber]);

  const maxExistingRoundNumber = useMemo(() => {
    return rounds.reduce((max, r) => Math.max(max, r.roundNumber || 0), 0);
  }, [rounds]);

  const nextBatchStartRound = maxExistingRoundNumber + 1;
  const nextBatchEndRound = maxExistingRoundNumber + (lastBatchConfig?.roundCount || 1);

  // Check if roster has changed compared to last batch config
  const rosterHasChanged = useMemo(() => {
    if (!lastBatchConfig?.activePlayerIds) return true;
    const currentActiveIds = allActivePlayers.map((p) => p.id).sort();
    const lastActiveIds = [...lastBatchConfig.activePlayerIds].sort();
    if (currentActiveIds.length !== lastActiveIds.length) return true;
    return currentActiveIds.some((id, idx) => id !== lastActiveIds[idx]);
  }, [allActivePlayers, lastBatchConfig]);

  const maxGP = useMemo(() => {
    return allActivePlayers.length > 0
      ? Math.max(0, ...allActivePlayers.map((p) => playerMatchCounts[p.id] || 0))
      : 0;
  }, [allActivePlayers, playerMatchCounts]);

  // If there are no future rounds, no upcoming predicted matches, and no batch generator action, return null
  if (futureRounds.length === 0 && upcomingMatches.length === 0 && !onOpenBatchGenerator) {
    return null;
  }

  const handleGenerateMoreClick = () => {
    if (rosterHasChanged || !lastBatchConfig) {
      onOpenBatchGenerator?.();
    } else {
      onQuickGenerateMore ? onQuickGenerateMore() : onOpenBatchGenerator?.();
    }
  };

  return (
    <div
      id="upcoming-matches-section"
      className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 shadow-xs space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-100 pb-2.5 sm:pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 sm:w-2 sm:h-5 bg-indigo-600 rounded-full"></span>
            <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-900" />
            <h3 className="font-black text-sm sm:text-base text-indigo-950 tracking-tight">
              {futureRounds.length > 0
                ? `Upcoming Schedule (${futureRounds.length} Future Round${futureRounds.length > 1 ? 's' : ''})`
                : 'On-Deck: Next Matches'}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-indigo-950 shadow-2xs">
              {futureRounds.length > 0 ? 'Full Batch Schedule' : 'Live Queue'}
            </span>
          </div>
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5">
            {futureRounds.length > 0
              ? 'Complete multi-round lineup. Every player can see all their upcoming court assignments and rest rotations.'
              : 'Next up in the queue. You can edit or swap players anytime!'}
          </p>
        </div>

        {onOpenBatchGenerator && (
          <button
            type="button"
            id="btn-schedule-open-batch-modal-top"
            onClick={onOpenBatchGenerator}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-black uppercase tracking-wider border border-indigo-200/80 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            <span>Batch Generator</span>
          </button>
        )}
      </div>

      {/* 1. If Multi-Round Batch is Generated: Show ALL Future Rounds */}
      {futureRounds.length > 0 ? (
        <div className="space-y-4">
          {futureRounds.map((round) => {
            const resting = round.restingPlayerIds
              .map((id) => playersMap[id])
              .filter(Boolean);

            return (
              <div
                key={`future-round-${round.roundNumber}`}
                id={`future-round-card-${round.roundNumber}`}
                className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5 sm:p-4 space-y-3 transition-all hover:border-indigo-200"
              >
                {/* Round Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-2xs">
                      R{round.roundNumber}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-sm text-slate-900">
                          Round {round.roundNumber} Schedule
                        </span>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                          {round.matches.length} Match{round.matches.length > 1 ? 'es' : ''}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500">
                        {round.targetMatchesPerPlayer ? `Target: ${round.targetMatchesPerPlayer} game(s)/player` : 'Sequential rotation'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {onSelectRound && (
                      <button
                        type="button"
                        onClick={() => onSelectRound(round.roundNumber)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 transition-colors cursor-pointer"
                      >
                        <span>View Court Card</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Matches in this future round */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {round.matches.map((match, mIdx) => {
                    const t1 = match.team1.playerIds.map((id) => playersMap[id]).filter(Boolean);
                    const t2 = match.team2.playerIds.map((id) => playersMap[id]).filter(Boolean);
                    const courtNum = match.courtNumber || mIdx + 1;

                    const isTeam1Locked = t1.length >= 2 && t1[0].duoPartnerId === t1[1].id;
                    const isTeam2Locked = t2.length >= 2 && t2[0].duoPartnerId === t2[1].id;

                    return (
                      <div
                        key={match.id}
                        className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-black text-slate-700 pb-1.5 border-b border-slate-100">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Court {courtNum}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Scheduled
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* Team 1 */}
                          <div className="p-2 rounded-lg bg-indigo-50/50 border border-indigo-100 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-indigo-900">
                              <span>Team 1</span>
                              {isTeam1Locked && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded font-black">
                                  <Link2 className="w-2.5 h-2.5" /> Duo
                                </span>
                              )}
                            </div>
                            {t1.map((p) => (
                              <div key={`r${round.roundNumber}-m${mIdx}-t1-${p.id}`} className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 ${p.avatarColor}`}
                                >
                                  {p.name.charAt(0)}
                                </span>
                                <span className="font-bold text-slate-800 truncate text-[11px]">
                                  {p.name}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Team 2 */}
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
                              <span>Team 2</span>
                              {isTeam2Locked && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-700 bg-emerald-100 px-1 py-0.2 rounded font-black">
                                  <Link2 className="w-2.5 h-2.5" /> Duo
                                </span>
                              )}
                            </div>
                            {t2.map((p) => (
                              <div key={`r${round.roundNumber}-m${mIdx}-t2-${p.id}`} className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 ${p.avatarColor}`}
                                >
                                  {p.name.charAt(0)}
                                </span>
                                <span className="font-bold text-slate-800 truncate text-[11px]">
                                  {p.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Resting Bench for this future round */}
                {resting.length > 0 && (
                  <div className="flex items-center gap-2 text-xs bg-white px-3 py-1.5 rounded-xl border border-slate-200/80">
                    <Coffee className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="font-bold text-slate-600 text-[11px]">
                      Resting Bench for R{round.roundNumber}:
                    </span>
                    <span className="font-black text-slate-800 text-[11px] truncate">
                      {resting.map((p) => p.name).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* 2. Standard 2 Predicted On-Deck Matches if no future batch is present */
        upcomingMatches.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingMatches.slice(0, 2).map((match) => {
              const isNext = match.matchNumber === 1;
              const team1 = match.team1PlayerIds.map((id) => playersMap[id]).filter(Boolean);
              const team2 = match.team2PlayerIds.map((id) => playersMap[id]).filter(Boolean);

              return (
                <div
                  key={`upcoming-match-${match.matchNumber}`}
                  id={`upcoming-match-card-${match.matchNumber}`}
                  className={`rounded-2xl p-4.5 border transition-all ${
                    isNext
                      ? 'bg-indigo-900 text-white border-indigo-800 shadow-md ring-2 ring-indigo-500/20'
                      : 'bg-slate-50 text-slate-900 border-slate-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isNext
                            ? 'bg-yellow-400 text-indigo-950 font-black'
                            : 'bg-slate-200 text-slate-700 font-bold'
                        }`}
                      >
                        {isNext ? '★ On-Deck (Next Match)' : 'In The Hole (Match 2)'}
                      </span>
                      {match.isOverridden && (
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/30">
                          Manual Lineup
                        </span>
                      )}
                    </div>

                    {onUpdateNextMatch && (
                      <button
                        type="button"
                        id={`btn-edit-upcoming-match-${match.matchNumber}`}
                        onClick={() => setEditingMatch(match)}
                        className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all active:scale-95 cursor-pointer shrink-0 ${
                          isNext
                            ? 'bg-indigo-800 hover:bg-indigo-700 text-yellow-300 border border-indigo-700'
                            : 'bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 shadow-2xs'
                        }`}
                        title="Edit upcoming match lineup"
                        aria-label="Edit lineup"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div
                      className={`p-3 rounded-xl ${
                        isNext ? 'bg-indigo-950/70 border border-indigo-800' : 'bg-white border border-slate-200'
                      }`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-wider mb-2 opacity-75">
                        Team 1
                      </div>
                      <div className="space-y-1.5">
                        {team1.map((p) => (
                          <div key={`um-t1-${p.id}`} className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 ${p.avatarColor}`}
                            >
                              {p.name.charAt(0)}
                            </span>
                            <span className="text-xs font-bold truncate">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      className={`p-3 rounded-xl ${
                        isNext ? 'bg-indigo-950/70 border border-indigo-800' : 'bg-white border border-slate-200'
                      }`}
                    >
                      <div className="text-[10px] font-black uppercase tracking-wider mb-2 opacity-75">
                        Team 2
                      </div>
                      <div className="space-y-1.5">
                        {team2.map((p) => (
                          <div key={`um-t2-${p.id}`} className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0 ${p.avatarColor}`}
                            >
                              {p.name.charAt(0)}
                            </span>
                            <span className="text-xs font-bold truncate">{p.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* 3. Call-To-Action at the end of the Schedule View */}
      {onOpenBatchGenerator && (
        <div
          id="schedule-generate-more-cta"
          className="rounded-2xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/80 via-white to-amber-50/60 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs"
        >
          <div className="flex items-center gap-3 text-center sm:text-left min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shrink-0 shadow-md shadow-indigo-200">
              <PlusCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-black text-indigo-950 flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                <span>Generate More Matches</span>
                {lastBatchConfig && !rosterHasChanged && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                    Ready to Continue (Rounds {nextBatchStartRound}–{nextBatchEndRound})
                  </span>
                )}
                {rosterHasChanged && lastBatchConfig && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    Roster Changed (Review)
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                New rounds sequentially carry forward games played, partner variety, and rotational rest across the entire session.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            {lastBatchConfig && !rosterHasChanged && onQuickGenerateMore ? (
              <>
                <button
                  type="button"
                  id="btn-quick-generate-next-batch"
                  onClick={onQuickGenerateMore}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md hover:shadow-indigo-300 transition-all cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>
                    Quick Generate {lastBatchConfig.roundCount > 1 ? `R${nextBatchStartRound}–R${nextBatchEndRound}` : `Round ${nextBatchStartRound}`}
                  </span>
                </button>
                <button
                  type="button"
                  id="btn-customize-next-batch"
                  onClick={onOpenBatchGenerator}
                  className="inline-flex items-center justify-center p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                  title="Configure next batch settings"
                  aria-label="Configure next batch settings"
                >
                  <Sliders className="w-4 h-4 text-slate-600" />
                </button>
              </>
            ) : (
              <button
                type="button"
                id="btn-generate-more-matches"
                onClick={handleGenerateMoreClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md hover:shadow-indigo-300 transition-all cursor-pointer"
              >
                <Layers className="w-4 h-4 text-yellow-300" />
                <span>
                  {lastBatchConfig && rosterHasChanged
                    ? 'Confirm Roster & Generate'
                    : 'Generate More Matches'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingMatch && onUpdateNextMatch && onResetNextMatch && (
        <EditLineupModal
          isOpen={true}
          onClose={() => setEditingMatch(null)}
          title={`Edit ${
            editingMatch.matchNumber === 1 ? 'On-Deck Next Match' : 'Match 2 In-The-Hole'
          }`}
          subtitle="Assign or substitute players for this upcoming match"
          playersPerTeam={playersPerTeam}
          allActivePlayers={allActivePlayers}
          initialTeam1={editingMatch.team1PlayerIds}
          initialTeam2={editingMatch.team2PlayerIds}
          isOverridden={editingMatch.isOverridden}
          partnerCounts={partnerCounts}
          playerMatchCounts={playerMatchCounts}
          onResetToAuto={() => onResetNextMatch(editingMatch.matchNumber)}
          onSave={(t1, t2) => {
            onUpdateNextMatch(editingMatch.matchNumber, t1, t2);
            setEditingMatch(null);
          }}
        />
      )}
    </div>
  );
};