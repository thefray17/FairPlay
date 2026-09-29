import React, { useState, useMemo } from 'react';
import {
  FairnessMetric,
  Player,
  Round,
  SessionConfig,
  StandingsRow,
  UpcomingMatch,
  BatchGenerationConfig,
  Match,
} from '../types';
import { CompactMatchRow } from './CompactMatchRow';
import { FloatingMatchWindow } from './FloatingMatchWindow';
import { EditLineupModal } from './EditLineupModal';
import {
  ShieldCheck,
  Coffee,
  Sparkles,
  RotateCw,
  Users,
  UserPlus,
  CheckCircle2,
  Scale,
  AlertTriangle,
  X,
  Layers,
  Clock,
  PlusCircle,
  Sliders,
  ArrowRight,
  Flame,
  Play,
} from 'lucide-react';
import { soundFx } from '../utils/audio';
import {
  getHistoryMatrices,
  calculateFairnessMetric,
} from '../utils/fairRotation';

interface ActiveRoundViewProps {
  currentRound?: Round | null;
  rounds?: Round[];
  roundsCount?: number;
  players: Player[];
  playersMap: Record<string, Player>;
  config: SessionConfig;
  fairness?: FairnessMetric;
  upcomingMatches?: UpcomingMatch[];
  standings?: StandingsRow[];
  playerMatchCounts: Record<string, number>;
  onGenerateNextRound: () => void;
  onRegenerateCurrentRound?: (roundNumber?: number) => void;
  onUpdateScore: (matchId: string, score1: number, score2: number, completed?: boolean) => void;
  onCompleteMatch: (matchId: string) => void;
  onReopenMatch: (matchId: string) => void;
  onUpdateMatchLineup: (matchId: string, team1: string[], team2: string[]) => void;
  onUpdateNextMatch?: (matchNumber: 1 | 2, team1: string[], team2: string[]) => void;
  onResetNextMatch?: (matchNumber: 1 | 2) => void;
  onNavigateToSquad?: () => void;
  onOpenFairnessModal: () => void;
  onViewFullStandings: () => void;
  onBenchAndReplacePlayer?: (matchId: string, playerId: string) => void;
  onStartMatch?: (matchId: string) => void;
  onShuffleLineup?: (matchId: string) => void;
  onOpenBatchGenerator?: () => void;
  onQuickGenerateMore?: () => void;
  lastBatchConfig?: BatchGenerationConfig | null;
  onDeleteMatch?: (matchId: string) => void;
  onDeleteRound?: (roundNumber: number) => void;
}

export const ActiveRoundView: React.FC<ActiveRoundViewProps> = ({
  rounds = [],
  players,
  playersMap,
  config,
  fairness,
  upcomingMatches = [],
  playerMatchCounts,
  onGenerateNextRound,
  onRegenerateCurrentRound,
  onUpdateScore,
  onCompleteMatch,
  onReopenMatch,
  onUpdateMatchLineup,
  onNavigateToSquad,
  onOpenFairnessModal,
  onBenchAndReplacePlayer,
  onStartMatch,
  onShuffleLineup,
  onOpenBatchGenerator,
  onQuickGenerateMore,
  lastBatchConfig,
  onDeleteMatch,
  onDeleteRound,
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [showConfirmRegenerate, setShowConfirmRegenerate] = useState<number | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculatedToast, setRecalculatedToast] = useState<string | null>(null);

  const activePlayers = useMemo(() => players.filter((p) => p.active), [players]);
  const playersPerMatch = config.playersPerTeam * 2;

  const fairnessMetric = useMemo(
    () => fairness || calculateFairnessMetric(players, rounds),
    [fairness, players, rounds]
  );
  const { partnerCount } = useMemo(() => getHistoryMatrices(rounds), [rounds]);

  // Flatten all matches in chronological order across the entire session
  const allMatchesInSession = useMemo(() => {
    const list: { match: Match; roundNumber: number }[] = [];
    rounds.forEach((round) => {
      round.matches.forEach((match) => {
        list.push({ match, roundNumber: round.roundNumber });
      });
    });
    return list;
  }, [rounds]);

  // Find currently selected match item for floating window
  const selectedMatchItem = useMemo(() => {
    if (!selectedMatchId) return null;
    return allMatchesInSession.find((item) => item.match.id === selectedMatchId) || null;
  }, [allMatchesInSession, selectedMatchId]);

  // Identify the live round for informational display only
  const liveRound = useMemo(() => {
    return rounds.find((r) => !r.completed && r.matches.some((m) => !m.completed)) || null;
  }, [rounds]);
  const liveRoundNumber = liveRound ? liveRound.roundNumber : null;

  // Active match being edited via lineup modal
  const editingActiveMatch = useMemo(() => {
    if (!editingMatchId) return null;
    for (const r of rounds) {
      const found = r.matches.find((m) => m.id === editingMatchId);
      if (found) return found;
    }
    return null;
  }, [rounds, editingMatchId]);

  // Calculate unassigned players for the latest incomplete round
  const unassignedActivePlayers = useMemo(() => {
    if (!liveRound) return [];
    const playingIds = new Set<string>();
    liveRound.matches.forEach((m) => {
      m.team1.playerIds.forEach((id) => playingIds.add(id));
      m.team2.playerIds.forEach((id) => playingIds.add(id));
    });
    return activePlayers.filter((p) => !playingIds.has(p.id));
  }, [liveRound, activePlayers]);

  const executeRegenerate = (roundNum: number) => {
    if (!onRegenerateCurrentRound) return;
    setIsRecalculating(true);
    onRegenerateCurrentRound(roundNum);
    setShowConfirmRegenerate(null);
    setRecalculatedToast(`Round ${roundNum} matches recalculated!`);
    setTimeout(() => {
      setIsRecalculating(false);
    }, 600);
    setTimeout(() => {
      setRecalculatedToast(null);
    }, 4000);
  };

  // Next batch calculation for Quick Generate CTA
  const maxExistingRoundNumber = useMemo(() => {
    return rounds.reduce((max, r) => Math.max(max, r.roundNumber || 0), 0);
  }, [rounds]);

  const nextBatchStartRound = maxExistingRoundNumber + 1;
  const nextBatchEndRound = maxExistingRoundNumber + (lastBatchConfig?.roundCount || 1);

  const rosterHasChanged = useMemo(() => {
    if (!lastBatchConfig?.activePlayerIds) return true;
    const currentActiveIds = activePlayers.map((p) => p.id).sort();
    const lastActiveIds = [...lastBatchConfig.activePlayerIds].sort();
    if (currentActiveIds.length !== lastActiveIds.length) return true;
    return currentActiveIds.some((id, idx) => id !== lastActiveIds[idx]);
  }, [activePlayers, lastBatchConfig]);

  const handleGenerateMoreClick = () => {
    if (lastBatchConfig && !rosterHasChanged && onQuickGenerateMore) {
      onQuickGenerateMore();
    } else if (onOpenBatchGenerator) {
      onOpenBatchGenerator();
    }
  };

  // 1. Empty State: No players in session
  if (players.length === 0) {
    return (
      <div id="zero-players-container" className="py-12 px-4 max-w-lg mx-auto text-center">
        <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mx-auto mb-4 shadow-xs">
          <Users className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-black text-indigo-950 tracking-tight mb-2">
          No Players in Session
        </h2>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          This session currently has 0 players registered. Add players to your squad roster or paste your club member list to begin scheduling fair rounds.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {onNavigateToSquad && (
            <button
              type="button"
              id="btn-zero-players-add-squad"
              onClick={onNavigateToSquad}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-wider shadow-md hover:shadow-indigo-200 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Add Squad Players
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. Empty State: Players ready, no rounds generated yet
  if (rounds.length === 0) {
    return (
      <div id="no-round-container" className="py-10 px-4 max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-yellow-400 text-indigo-950 flex items-center justify-center mx-auto mb-4 shadow-md font-black">
          <Sparkles className="w-8 h-8 text-indigo-950" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-indigo-950 tracking-tight mb-2">
          Ready to Play
        </h2>

        <p className="text-sm font-semibold text-slate-600 mb-6 leading-relaxed">
          {config.sessionName} • <span className="uppercase font-bold text-indigo-700">{config.sport.replace('-', ' ')}</span> ({config.format.toUpperCase()})
          <br />
          <strong className="text-slate-900">{activePlayers.length} active players</strong> ready across{' '}
          <strong className="text-slate-900">{config.courtsCount} courts</strong>.
        </p>

        {/* Fairness Score Badge Button Card */}
        <div className="bg-indigo-900 text-white rounded-3xl p-5 mb-6 text-left shadow-md border border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-indigo-950 flex items-center justify-center font-black shrink-0">
              <ShieldCheck className="w-5 h-5 text-indigo-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-yellow-300">
                  Equal Play Guarantee
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-400 text-emerald-950">
                  {fairnessMetric.fairnessScorePercentage === 100 ? '100% Equal' : `${fairnessMetric.fairnessScorePercentage}% Balanced`}
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Every player gets equal matches, new partners, and balanced opponent exposure.
              </p>
            </div>
          </div>

          <button
            type="button"
            id="btn-r1-open-fairness"
            onClick={onOpenFairnessModal}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-800 hover:bg-indigo-700 text-yellow-300 border border-indigo-600 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer shrink-0"
          >
            <Scale className="w-3.5 h-3.5 text-yellow-400" />
            <span>Fairness Audit</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            id="btn-generate-matches-initial"
            onClick={() => {
              soundFx.playWhistle();
              if (onOpenBatchGenerator) {
                onOpenBatchGenerator();
              } else {
                onGenerateNextRound();
              }
            }}
            disabled={activePlayers.length < playersPerMatch}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black text-sm uppercase tracking-wider shadow-lg hover:shadow-indigo-300 transition-all cursor-pointer active:scale-98"
          >
            <Play className="w-4 h-4 fill-current text-yellow-300" />
            <span>Generate Matches</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Compact Timeline Schedule View: Shows EVERY round in a compact list with floating officiating window
  const completedRoundsCount = rounds.filter((r) => r.completed || r.matches.every((m) => m.completed)).length;

  return (
    <div id="unified-schedule-view" className="space-y-6 sm:space-y-8 pb-12">
      {/* Schedule Top Control & Overview Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shrink-0 shadow-sm shadow-indigo-200">
            <Flame className="w-5 h-5 text-yellow-300 fill-yellow-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-xl font-black text-indigo-950">
                Match Schedule
              </h2>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200">
                {rounds.length} {rounds.length === 1 ? 'Round' : 'Rounds'} Total
              </span>
              {liveRoundNumber && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow-400 text-indigo-950 border border-yellow-500/40">
                  Round {liveRoundNumber} In Progress
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Every match can be started, edited, and scored at any time • Tap any match to open the match window
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenBatchGenerator && (
            <button
              type="button"
              id="btn-schedule-batch-generator"
              onClick={onOpenBatchGenerator}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-indigo-950 font-black text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer"
              title="Pre-generate more fair rounds"
            >
              <Layers className="w-4 h-4 text-indigo-950" />
              <span>Batch Setup</span>
            </button>
          )}

          <button
            type="button"
            id="btn-schedule-fairness-audit"
            onClick={onOpenFairnessModal}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-900 border border-indigo-200 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            title="Inspect fairness score and match variety"
          >
            <Scale className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Fairness Audit</span>
          </button>
        </div>
      </div>

      {/* Recalculated Fair Pairings Toast */}
      {recalculatedToast && (
        <div
          id="alert-recalculated-toast"
          className="p-3 bg-amber-50 border border-amber-300/80 text-amber-950 rounded-xl sm:rounded-2xl flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-300 shadow-2xs"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-800" />
            </div>
            <span>{recalculatedToast} Pairings and courts freshly drawn.</span>
          </div>
          <button
            type="button"
            onClick={() => setRecalculatedToast(null)}
            className="text-amber-700 hover:text-amber-900 cursor-pointer p-1 rounded-lg hover:bg-amber-100"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Compact Chronological Stream of Every Round in the Tournament */}
      <div className="space-y-5 sm:space-y-6">
        {rounds.map((round) => {
          const isRoundCompleted = round.completed || round.matches.every((m) => m.completed);
          const isLiveSection = !isRoundCompleted && (liveRoundNumber === null || round.roundNumber === liveRoundNumber);

          const restingPlayers = (round.restingPlayerIds || [])
            .map((id) => playersMap[id])
            .filter(Boolean);

          const completedCount = round.matches.filter((m) => m.completed).length;

          return (
            <section
              key={`round-section-${round.roundNumber}`}
              id={`round-section-${round.roundNumber}`}
              className={`rounded-2xl sm:rounded-3xl border transition-all overflow-hidden bg-white ${
                isLiveSection
                  ? 'border-yellow-400/90 shadow-md ring-2 ring-yellow-400/20'
                  : isRoundCompleted
                  ? 'border-slate-200 shadow-2xs'
                  : 'border-slate-200/90 shadow-2xs'
              }`}
            >
              {/* Round Header */}
              <div
                className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b ${
                  isLiveSection
                    ? 'bg-linear-to-r from-yellow-50 via-white to-indigo-50/40 border-yellow-200'
                    : isRoundCompleted
                    ? 'bg-slate-50 border-slate-200 text-slate-800'
                    : 'bg-indigo-50/40 border-slate-200 text-indigo-950'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${
                      isLiveSection
                        ? 'bg-indigo-600 text-yellow-300 ring-2 ring-yellow-400'
                        : isRoundCompleted
                        ? 'bg-slate-700 text-white'
                        : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                    }`}
                  >
                    R{round.roundNumber}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                        Round {round.roundNumber}
                      </h3>

                      {isRoundCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" /> Finished ({completedCount}/{round.matches.length})
                        </span>
                      ) : isLiveSection ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-yellow-300 shadow-xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          Live Round ({completedCount}/{round.matches.length} Done)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                          <Clock className="w-3 h-3 text-indigo-600" /> Scheduled ({completedCount}/{round.matches.length} Done)
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                      {round.matches.length} {round.matches.length === 1 ? 'Court Match' : 'Court Matches'} • Target {config.targetPoints} pts
                    </p>
                  </div>
                </div>

                {/* Right Actions for Round */}
                <div className="flex items-center gap-2">
                  {onRegenerateCurrentRound && (
                    <button
                      type="button"
                      id={`btn-redraw-round-${round.roundNumber}`}
                      onClick={() => setShowConfirmRegenerate(round.roundNumber)}
                      disabled={isRecalculating}
                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                      title="Redraw fair pairings for this round"
                    >
                      <RotateCw className={`w-3.5 h-3.5 text-amber-700 ${isRecalculating ? 'animate-spin' : ''}`} />
                      <span>Redraw Round</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Unassigned / Added Players Alert for this Round */}
              {isLiveSection && unassignedActivePlayers.length > 0 && onRegenerateCurrentRound && (
                <div
                  id={`alert-added-players-r${round.roundNumber}`}
                  className="bg-amber-500/10 border-b border-amber-500/20 p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{unassignedActivePlayers.length} Added Player{unassignedActivePlayers.length > 1 ? 's' : ''} Ready</span>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                          Not scheduled in this round yet
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                        Redraw to include everyone: {unassignedActivePlayers.map((p) => p.name).join(', ')}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => executeRegenerate(round.roundNumber)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer shrink-0"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Redraw Round {round.roundNumber}</span>
                  </button>
                </div>
              )}

              {/* Compact Matches List */}
              <div className="p-3 sm:p-4 space-y-2.5">
                {round.matches.map((match) => (
                  <CompactMatchRow
                    key={match.id}
                    match={match}
                    roundNumber={round.roundNumber}
                    playersMap={playersMap}
                    config={config}
                    partnerCounts={partnerCount}
                    isSelected={selectedMatchId === match.id}
                    onSelectMatch={(id) => setSelectedMatchId(id)}
                    onUpdateScore={onUpdateScore}
                    onCompleteMatch={onCompleteMatch}
                    onReopenMatch={onReopenMatch}
                    onStartMatch={onStartMatch}
                    onEditLineup={() => setEditingMatchId(match.id)}
                    onShuffleLineup={onShuffleLineup}
                    onBenchAndReplacePlayer={onBenchAndReplacePlayer}
                    onDeleteMatch={onDeleteMatch}
                  />
                ))}

                {/* Resting Bench for this Round */}
                {restingPlayers.length > 0 && (
                  <div
                    key={`resting-bench-r${round.roundNumber}`}
                    className="mt-3 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 sm:p-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center text-[11px] font-black">
                          <Coffee className="w-3 h-3 text-slate-600" />
                        </div>
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                          Resting on Bench ({restingPlayers.length})
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">
                        Rotational Rest
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {restingPlayers.map((player) => (
                        <div
                          key={`bench-r${round.roundNumber}-${player.id}`}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs text-xs font-bold text-slate-800"
                        >
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black border border-white shrink-0 ${player.avatarColor}`}
                          >
                            {player.name.charAt(0)}
                          </span>
                          <span className="truncate max-w-[120px]">{player.name}</span>
                          <span className="text-[9px] px-1 rounded bg-slate-100 text-slate-500 font-semibold">
                            {playerMatchCounts[player.id] || 0} GP
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Confirmation Modal to Redraw Round */}
      {showConfirmRegenerate !== null && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <RotateCw className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Redraw Round {showConfirmRegenerate}?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                This will recalculate pairings and courts for Round {showConfirmRegenerate} to balance partner variety and games played.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmRegenerate(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeRegenerate(showConfirmRegenerate)}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider cursor-pointer shadow-sm"
              >
                Yes, Redraw
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Call-To-Action Card at the end of the matches list */}
      {onOpenBatchGenerator && (
        <div
          id="schedule-generate-more-cta"
          className="rounded-2xl sm:rounded-3xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/80 via-white to-amber-50/60 p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs"
        >
          <div className="flex items-center gap-3 text-center sm:text-left min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shrink-0 shadow-md shadow-indigo-200">
              <PlusCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm sm:text-base font-black text-indigo-950 flex items-center gap-2 flex-wrap justify-center sm:justify-start">
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
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md hover:shadow-indigo-300 transition-all cursor-pointer active:scale-95"
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
                  className="inline-flex items-center justify-center p-3 rounded-xl sm:rounded-2xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
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
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md hover:shadow-indigo-300 transition-all cursor-pointer active:scale-95"
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

      {/* Live Fairness Score & Partner Rotation Badge Card */}
      <div
        id="fairness-score-card"
        className="rounded-2xl sm:rounded-3xl bg-indigo-950 text-white p-4 sm:p-5 shadow-sm border border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-yellow-400 text-indigo-950 flex items-center justify-center font-black shrink-0 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-indigo-950" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-yellow-300">
                Fairness &amp; Equal Play Engine
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-400 text-emerald-950 shrink-0">
                {fairnessMetric.fairnessScorePercentage === 100 ? '100% Equal' : `${fairnessMetric.fairnessScorePercentage}% Balanced`}
              </span>
            </div>
            <p className="text-xs text-indigo-200 mt-0.5 truncate sm:whitespace-normal">
              Cycle {fairnessMetric.currentCycle} ({fairnessMetric.playersInCurrentCycle}/{fairnessMetric.totalActivePlayers} players) • Partner variety &amp; equal court time guaranteed across whole schedule
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btn-livematches-fairness-badge"
          onClick={onOpenFairnessModal}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 active:scale-95 text-indigo-950 font-black text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer shrink-0"
        >
          <Scale className="w-4 h-4 text-indigo-950" />
          <span>Fairness Score Audit &amp; Pairings</span>
          <ArrowRight className="w-3.5 h-3.5 text-indigo-950" />
        </button>
      </div>

      {/* Floating Match Window for Active / Officiated Match */}
      {selectedMatchItem && (
        <FloatingMatchWindow
          match={selectedMatchItem.match}
          roundNumber={selectedMatchItem.roundNumber}
          allMatchesInSession={allMatchesInSession}
          playersMap={playersMap}
          config={config}
          partnerCounts={partnerCount}
          playerMatchCounts={playerMatchCounts}
          onClose={() => setSelectedMatchId(null)}
          onSelectMatch={(id) => setSelectedMatchId(id)}
          onUpdateScore={onUpdateScore}
          onCompleteMatch={onCompleteMatch}
          onReopenMatch={onReopenMatch}
          onStartMatch={onStartMatch}
          onEditLineup={() => setEditingMatchId(selectedMatchItem.match.id)}
          onShuffleLineup={onShuffleLineup}
          onBenchAndReplacePlayer={onBenchAndReplacePlayer}
          onDeleteMatch={onDeleteMatch}
        />
      )}

      {/* Edit Active Match Lineup Modal */}
      {editingActiveMatch && (
        <EditLineupModal
          isOpen={true}
          onClose={() => setEditingMatchId(null)}
          title={`Edit Court ${editingActiveMatch.courtNumber || 1} Lineup`}
          subtitle={`Round ${editingActiveMatch.roundNumber}`}
          playersPerTeam={config.playersPerTeam}
          allActivePlayers={activePlayers}
          initialTeam1={editingActiveMatch.team1.playerIds}
          initialTeam2={editingActiveMatch.team2.playerIds}
          partnerCounts={partnerCount}
          playerMatchCounts={playerMatchCounts}
          onSave={(t1, t2) => {
            onUpdateMatchLineup(editingActiveMatch.id, t1, t2);
            setEditingMatchId(null);
          }}
        />
      )}
    </div>
  );
};
