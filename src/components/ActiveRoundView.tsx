import React, { useState, useMemo } from 'react';
import { FairnessMetric, Player, Round, SessionConfig, StandingsRow, UpcomingMatch } from '../types';
import { CourtCard } from './CourtCard';
import { EditLineupModal } from './EditLineupModal';
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Coffee,
  Sparkles,
  RotateCw,
  Users,
  UserPlus,
  Link2,
  CheckCircle2,
  Scale,
  AlertTriangle,
  X,
  Trophy,
} from 'lucide-react';
import { soundFx } from '../utils/audio';
import {
  getHistoryMatrices,
  getPartnershipCoverage,
  calculateFairnessMetric,
} from '../utils/fairRotation';

interface ActiveRoundViewProps {
  currentRound: Round | null;
  rounds?: Round[];
  roundsCount: number;
  activeRoundIndex?: number;
  onSelectRound?: (roundNumber: number) => void;
  players: Player[];
  playersMap: Record<string, Player>;
  config: SessionConfig;
  fairness?: FairnessMetric;
  upcomingMatches?: UpcomingMatch[];
  standings: StandingsRow[];
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
  onOpenTournamentComplete?: () => void;
}

export const ActiveRoundView: React.FC<ActiveRoundViewProps> = ({
  currentRound,
  rounds = [],
  roundsCount,
  activeRoundIndex = rounds.length > 0 ? rounds.length - 1 : 0,
  onSelectRound,
  players,
  playersMap,
  config,
  fairness,
  upcomingMatches = [],
  standings,
  playerMatchCounts,
  onGenerateNextRound,
  onRegenerateCurrentRound,
  onUpdateScore,
  onCompleteMatch,
  onReopenMatch,
  onUpdateMatchLineup,
  onUpdateNextMatch,
  onResetNextMatch,
  onNavigateToSquad,
  onOpenFairnessModal,
  onViewFullStandings,
  onBenchAndReplacePlayer,
  onStartMatch,
  onShuffleLineup,
  onOpenTournamentComplete,
}) => {
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [showConfirmRegenerate, setShowConfirmRegenerate] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculatedToast, setRecalculatedToast] = useState(false);

  const hasStartedMatches = useMemo(() => {
    if (!currentRound) return false;
    return (currentRound.matches || []).some(
      (m) => m.completed || (m.score1 && m.score1 > 0) || (m.score2 && m.score2 > 0) || m.status === 'in_progress'
    );
  }, [currentRound]);

  const executeRegenerate = () => {
    if (!onRegenerateCurrentRound || !currentRound) return;
    setIsRecalculating(true);
    onRegenerateCurrentRound(currentRound.roundNumber);
    setShowConfirmRegenerate(false);
    setRecalculatedToast(true);
    setTimeout(() => {
      setIsRecalculating(false);
    }, 600);
    setTimeout(() => {
      setRecalculatedToast(false);
    }, 4000);
  };

  const handleRegenerateClick = () => {
    setShowConfirmRegenerate(true);
  };

  const activePlayers = players.filter((p) => p.active);
  const playersPerMatch = config.playersPerTeam * 2;
  const totalSlotsNeeded = config.courtsCount * playersPerMatch;

  const fairnessMetric = useMemo(
    () => fairness || calculateFairnessMetric(players, rounds),
    [fairness, players, rounds]
  );
  const { partnerCount } = useMemo(() => getHistoryMatrices(rounds), [rounds]);
  const partnershipCoverage = useMemo(() => getPartnershipCoverage(players, rounds), [players, rounds]);

  // Active round data and match memoizations (Hooks must be called unconditionally)
  const roundMatches = currentRound?.matches || [];
  const playingPlayerIds = useMemo(() => {
    const set = new Set<string>();
    roundMatches.forEach((m) => {
      m.team1.playerIds.forEach((id) => set.add(id));
      m.team2.playerIds.forEach((id) => set.add(id));
    });
    return set;
  }, [roundMatches]);

  const unassignedActivePlayers = useMemo(
    () => activePlayers.filter((p) => !playingPlayerIds.has(p.id)),
    [activePlayers, playingPlayerIds]
  );

  // Active match being edited
  const editingActiveMatch = currentRound?.matches?.find((m) => m.id === editingMatchId) || null;

  // If zero players exist in the tournament session
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

  // If no round generated yet
  if (!currentRound) {
    const willBenchCount = Math.max(0, activePlayers.length - totalSlotsNeeded);
    const willPlayCount = Math.min(activePlayers.length, totalSlotsNeeded);

    return (
      <div id="no-round-container" className="py-10 px-4 max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-yellow-400 text-indigo-950 flex items-center justify-center mx-auto mb-4 shadow-md font-black">
          <Sparkles className="w-8 h-8 text-indigo-950" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-indigo-950 tracking-tight mb-2">
          Ready for Round 1
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
            id="btn-start-session-generate-r1"
            onClick={() => {
              soundFx.playWhistle();
              onGenerateNextRound();
            }}
            disabled={activePlayers.length < playersPerMatch}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black text-sm uppercase tracking-wider shadow-lg hover:shadow-indigo-300 transition-all cursor-pointer"
          >
            <RotateCw className="w-4 h-4" /> Start Round 1
          </button>

          {onNavigateToSquad && (
            <button
              type="button"
              id="btn-r1-manage-squad"
              onClick={onNavigateToSquad}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold text-sm transition-all cursor-pointer shadow-xs"
            >
              <Users className="w-4 h-4 text-indigo-600" /> Manage Squad &amp; Bench
            </button>
          )}
        </div>

        {activePlayers.length < playersPerMatch && (
          <p className="text-xs text-rose-600 mt-2 font-bold">
            Need at least {playersPerMatch} active players to start a {config.format} match.
          </p>
        )}
      </div>
    );
  }

  // Active round exists
  const completedMatchesCount = roundMatches.filter((m) => m.completed).length;
  const allMatchesCompleted =
    roundMatches.length > 0 && completedMatchesCount === roundMatches.length;

  // Resting players info
  const restingPlayerIds = currentRound.restingPlayerIds || [];
  const restingPlayers = restingPlayerIds
    .map((id) => playersMap[id])
    .filter(Boolean);

  const totalCompletedMatches = roundsCount > 0
    ? standings.reduce((sum, r) => sum + r.matchesPlayed, 0) / (config.playersPerTeam * 2)
    : 0;

  const isViewingPastRound = activeRoundIndex < rounds.length - 1;

  return (
    <div id="active-round-view" className="space-y-3.5 sm:space-y-4">
      {/* Round Navigation Bar (Allows going back to previous rounds) */}
      {rounds.length > 1 && (
        <div
          id="round-navigation-bar"
          className="flex items-center justify-between gap-2 bg-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              id="btn-prev-round"
              disabled={activeRoundIndex <= 0}
              onClick={() => {
                if (activeRoundIndex > 0) {
                  soundFx.playPointChime();
                  onSelectRound?.(rounds[activeRoundIndex - 1].roundNumber);
                }
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-black text-xs transition-all ${
                activeRoundIndex > 0
                  ? 'bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 cursor-pointer shadow-2xs'
                  : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'
              }`}
              title="Go back to previous round"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Previous Round</span>
              <span className="sm:hidden">Prev</span>
            </button>
          </div>

          {/* Round Pills Carousel */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-[55vw] sm:max-w-none scrollbar-none">
            {rounds.map((r, rIdx) => {
              const isSelected = rIdx === activeRoundIndex;
              const isLatest = rIdx === rounds.length - 1;
              const isDone = r.completed || (r.matches.length > 0 && r.matches.every((m) => m.completed));

              return (
                <button
                  key={`round-nav-pill-${r.roundNumber}`}
                  type="button"
                  id={`btn-round-nav-${r.roundNumber}`}
                  onClick={() => {
                    soundFx.playPointChime();
                    onSelectRound?.(r.roundNumber);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>Round {r.roundNumber}</span>
                  {isDone ? (
                    <span className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-green-600'}`}>✓</span>
                  ) : isLatest ? (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase tracking-tight ${
                        isSelected ? 'bg-yellow-400 text-indigo-950' : 'bg-black text-yellow-300'
                      }`}
                    >
                      Active
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isViewingPastRound ? (
              <button
                type="button"
                id="btn-next-round-step"
                onClick={() => {
                  soundFx.playPointChime();
                  onSelectRound?.(rounds[activeRoundIndex + 1].roundNumber);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-black text-xs bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 transition-all cursor-pointer shadow-2xs"
                title="Go to next round"
              >
                <span className="hidden sm:inline">Next Round</span>
                <span className="sm:hidden">Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-2 py-1 bg-slate-100 rounded-lg">
                Current
              </span>
            )}
          </div>
        </div>
      )}

      {/* Past Round Notice */}
      {isViewingPastRound && (
        <div
          id="viewing-past-round-notice"
          className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl sm:rounded-2xl bg-amber-50 border border-amber-300/80 text-amber-950 text-xs shadow-2xs flex-wrap sm:flex-nowrap"
        >
          <div className="flex items-center gap-2 font-medium min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
            <span className="truncate">
              Viewing <strong>Round {currentRound.roundNumber}</strong> history. You can edit scores or review lineups.
            </span>
          </div>
          <button
            type="button"
            id="btn-jump-to-latest"
            onClick={() => {
              soundFx.playPointChime();
              onSelectRound?.(rounds[rounds.length - 1].roundNumber);
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black text-xs uppercase tracking-wider shrink-0 transition-all shadow-xs cursor-pointer ml-auto"
          >
            Jump to Active (R{rounds[rounds.length - 1].roundNumber}) →
          </button>
        </div>
      )}

      {/* Round Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-indigo-600 text-white font-black text-xs sm:text-sm shadow-xs shrink-0">
            R{currentRound.roundNumber}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-indigo-900 flex items-center gap-1 leading-tight truncate">
                Round {currentRound.roundNumber}
              </h2>
              {allMatchesCompleted ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-tight bg-green-100 text-green-800 border border-green-200 shrink-0">
                  All Finished ✓
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-black text-yellow-300 shrink-0">
                  {completedMatchesCount}/{roundMatches.length} Done
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate">
              Target: {config.targetPoints} pts • {isViewingPastRound ? 'Past Round' : 'Live Round'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {/* Recalculate / Redraw Round Matches Button (Always prompts confirmation) */}
          {onRegenerateCurrentRound && (
            <button
              type="button"
              id="btn-header-recalculate-round"
              onClick={handleRegenerateClick}
              disabled={isRecalculating}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-black text-xs uppercase tracking-wider transition-all bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300/80 cursor-pointer shadow-2xs hover:border-amber-400 shrink-0"
              title={`Recalculate & redraw fair pairings for Round ${currentRound.roundNumber}`}
              aria-label={`Recalculate & redraw fair pairings for Round ${currentRound.roundNumber}`}
            >
              <RotateCw className={`w-3.5 h-3.5 text-amber-700 ${isRecalculating ? 'animate-spin' : ''}`} />
              <span>Redraw Round</span>
            </button>
          )}

          {isViewingPastRound ? (
            <button
              type="button"
              id="btn-header-next-round"
              onClick={() => {
                soundFx.playPointChime();
                onSelectRound?.(rounds[activeRoundIndex + 1].roundNumber);
              }}
              className="inline-flex items-center justify-center gap-1 px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-black text-xs uppercase tracking-wider transition-all bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-xs shrink-0"
            >
              <span>Next (R{rounds[activeRoundIndex + 1].roundNumber})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              id="btn-generate-next-round"
              onClick={() => {
                soundFx.playWhistle();
                onGenerateNextRound();
              }}
              className={`inline-flex items-center justify-center gap-1 px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer shrink-0 ${
                allMatchesCompleted
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                  : 'bg-slate-800 hover:bg-black text-white'
              }`}
            >
              <span>Next Round</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Recalculated Fair Pairings Toast */}
      {recalculatedToast && (
        <div
          id="alert-recalculated-toast"
          className="p-3 bg-amber-50 border border-amber-300/80 text-amber-950 rounded-xl sm:rounded-2xl flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-300 shadow-2xs"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-amber-800" />
            </div>
            <span className="truncate sm:whitespace-normal">
              Round {currentRound.roundNumber} matches recalculated! Pairings and court assignments have been freshly drawn.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRecalculatedToast(false)}
            className="text-amber-700 hover:text-amber-900 cursor-pointer p-1 rounded-lg hover:bg-amber-100 transition-colors shrink-0"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Round Completed Celebration & Action Banner */}
      {allMatchesCompleted && !isViewingPastRound && (
        <div
          id="round-complete-banner"
          className={`${
            config.tournamentMode?.enabled && currentRound.roundNumber >= (config.tournamentMode.totalRounds || 0)
              ? 'bg-amber-500 border-amber-400 text-amber-950'
              : 'bg-emerald-600 border-emerald-500 text-white'
          } rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm border flex flex-col sm:flex-row items-center justify-between gap-3.5`}
        >
          <div className="flex items-center gap-3 min-w-0 text-center sm:text-left">
            <div
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl ${
                config.tournamentMode?.enabled && currentRound.roundNumber >= (config.tournamentMode.totalRounds || 0)
                  ? 'bg-amber-600 text-white'
                  : 'bg-emerald-700/80 text-white'
              } flex items-center justify-center font-black shrink-0`}
            >
              {config.tournamentMode?.enabled && currentRound.roundNumber >= (config.tournamentMode.totalRounds || 0) ? (
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </div>
            <div>
              <div className="text-sm sm:text-base font-black">
                {config.tournamentMode?.enabled && currentRound.roundNumber >= (config.tournamentMode.totalRounds || 0)
                  ? `Tournament Finished! (All ${config.tournamentMode.totalRounds} Rounds Done)`
                  : `Round ${currentRound.roundNumber} Finished!`}
              </div>
              <p className={`text-[11px] sm:text-xs mt-0.5 ${
                config.tournamentMode?.enabled && currentRound.roundNumber >= (config.tournamentMode.totalRounds || 0)
                  ? 'text-amber-950/80 font-medium'
                  : 'text-emerald-100'
              }`}>
                {config.tournamentMode?.enabled && currentRound.roundNumber >= (config.tournamentMode.totalRounds || 0)
                  ? 'All scheduled tournament matches are finished. View the final championship standings & awards podium!'
                  : `All matches have concluded. Round ${currentRound.roundNumber + 1} will only start or activate once you press Next Round.`}
              </p>
            </div>
          </div>
          {config.tournamentMode?.enabled && currentRound.roundNumber >= (config.tournamentMode.totalRounds || 0) ? (
            <button
              type="button"
              id="btn-banner-view-podium"
              onClick={() => onOpenTournamentComplete?.()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl sm:rounded-2xl bg-indigo-950 hover:bg-indigo-900 text-yellow-300 font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            >
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span>Championship Podium</span>
            </button>
          ) : (
            <button
              type="button"
              id="btn-banner-start-next-round"
              onClick={() => {
                soundFx.playWhistle();
                onGenerateNextRound();
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl sm:rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-indigo-950 font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            >
              <span>Next Round (R{currentRound.roundNumber + 1})</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Unscheduled / Added Players Alert Banner */}
      {unassignedActivePlayers.length > 0 && onRegenerateCurrentRound && (
        <div
          id="banner-added-players-need-redraw"
          className="bg-amber-500/10 border border-amber-500/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                <span>{unassignedActivePlayers.length} Added Player{unassignedActivePlayers.length > 1 ? 's' : ''} Ready to Play</span>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                  Not in Round {currentRound.roundNumber} yet
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                Redraw this round to generate all possible matches for everyone with zero benched: {unassignedActivePlayers.map((p) => p.name).join(', ')}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-banner-redraw-for-added-players"
            onClick={handleRegenerateClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer shrink-0 active:scale-95"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Redraw Round {currentRound.roundNumber}</span>
          </button>
        </div>
      )}

      {/* Courts Grid */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
          {roundMatches.map((match) => (
            <CourtCard
              key={match.id}
              match={match}
              playersMap={playersMap}
              config={config}
              partnerCounts={partnerCount}
              onUpdateScore={onUpdateScore}
              onCompleteMatch={onCompleteMatch}
              onReopenMatch={onReopenMatch}
              onEditLineup={() => setEditingMatchId(match.id)}
              onBenchAndReplacePlayer={onBenchAndReplacePlayer}
              onStartMatch={onStartMatch}
              onShuffleLineup={onShuffleLineup}
            />
          ))}
        </div>
      </div>

      {/* Resting Players Bench */}
      {restingPlayers.length > 0 && (
        <div
          id="resting-bench-section"
          className="bg-slate-50 border border-slate-200/90 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-2xs"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-black">
                <Coffee className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Resting on Bench ({restingPlayers.length})
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-500">
              Prioritized next round
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {restingPlayers.map((player) => (
              <div
                key={`bench-${player.id}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs font-bold text-slate-800"
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border border-white shrink-0 ${player.avatarColor}`}
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
              Cycle {fairnessMetric.currentCycle} ({fairnessMetric.playersInCurrentCycle}/{fairnessMetric.totalActivePlayers} players) • Partner variety &amp; equal court time guaranteed
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

      {/* Spacer so bottom elements are never overlapped on mobile */}
      <div className="h-16 md:hidden pointer-events-none" />

      {/* Mobile Floating Quick-Advance Bar */}
      <div className="fixed bottom-16 sm:bottom-[4.25rem] left-0 right-0 z-30 px-3 md:hidden pointer-events-none">
        <div className="max-w-md mx-auto bg-slate-900/95 backdrop-blur-md text-white rounded-xl sm:rounded-2xl p-2 sm:p-2.5 shadow-2xl border border-slate-700/80 flex items-center justify-between gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 min-w-0 pl-1">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
              R{currentRound.roundNumber}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-black truncate flex items-center gap-1">
                <span>{completedMatchesCount}/{roundMatches.length} Done</span>
                {allMatchesCompleted && <span className="text-emerald-400 font-bold">✓</span>}
              </div>
              <p className="text-[10px] text-slate-400 font-semibold truncate">
                {allMatchesCompleted ? 'Round complete!' : 'In progress'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onRegenerateCurrentRound && (
              <button
                type="button"
                id="btn-mobile-recalculate-round"
                onClick={handleRegenerateClick}
                disabled={isRecalculating}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-400 border border-slate-700 transition-all cursor-pointer min-h-[38px] flex items-center justify-center"
                title={`Recalculate Round ${currentRound.roundNumber} matches`}
                aria-label={`Recalculate Round ${currentRound.roundNumber} matches`}
              >
                <RotateCw className={`w-4 h-4 text-amber-400 ${isRecalculating ? 'animate-spin' : ''}`} />
              </button>
            )}

            {config.tournamentMode?.enabled && currentRound.roundNumber >= (config.tournamentMode.totalRounds || 0) && allMatchesCompleted ? (
              <button
                type="button"
                id="btn-mobile-quick-podium"
                onClick={() => onOpenTournamentComplete?.()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg sm:rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer min-h-[38px] sm:min-h-[42px] bg-yellow-400 text-indigo-950 shadow-yellow-500/30 ring-2 ring-yellow-300"
              >
                <Trophy className="w-3.5 h-3.5 text-indigo-950" />
                <span>Podium</span>
              </button>
            ) : (
              <button
                type="button"
                id="btn-mobile-quick-next-round"
                onClick={() => {
                  soundFx.playWhistle();
                  onGenerateNextRound();
                }}
                className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg sm:rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer min-h-[38px] sm:min-h-[42px] ${
                  allMatchesCompleted
                    ? 'bg-yellow-400 text-indigo-950 shadow-yellow-500/30 ring-2 ring-yellow-300'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white'
                }`}
              >
                <span>Next R{currentRound.roundNumber + 1}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit Active Match Lineup Modal */}
      {editingActiveMatch && (
        <EditLineupModal
          isOpen={true}
          onClose={() => setEditingMatchId(null)}
          title={`Edit Court ${editingActiveMatch.courtNumber} Lineup`}
          subtitle="Substitute or swap active players on this court"
          playersPerTeam={config.playersPerTeam}
          allActivePlayers={activePlayers}
          initialTeam1={editingActiveMatch.team1.playerIds}
          initialTeam2={editingActiveMatch.team2.playerIds}
          prioritizedBenchPlayerIds={currentRound.restingPlayerIds}
          playerMatchCounts={playerMatchCounts}
          partnerCounts={partnerCount}
          onSave={(t1, t2) => {
            onUpdateMatchLineup(editingActiveMatch.id, t1, t2);
            setEditingMatchId(null);
          }}
        />
      )}

      {/* Confirm Recalculate / Regenerate Modal */}
      {showConfirmRegenerate && (
        <div
          id="modal-confirm-regenerate"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 my-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                  Redraw Round {currentRound.roundNumber} Matches?
                </h3>
                <p className="text-xs text-slate-500 font-semibold truncate">
                  Recalculate court matchups &amp; player pairings
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
              {unassignedActivePlayers.length > 0 ? (
                <>
                  Found <strong>{unassignedActivePlayers.length} added player{unassignedActivePlayers.length > 1 ? 's' : ''}</strong> ({unassignedActivePlayers.map((p) => p.name).join(', ')}) waiting to play. Redrawing will generate all required matches so that <strong>every active player plays a match with zero benched players</strong>.
                </>
              ) : hasStartedMatches ? (
                <>
                  Scores or completed matches have already been recorded in <strong>Round {currentRound.roundNumber}</strong>. Redrawing will <strong>reset these matches</strong> and generate completely new, fair partner and opponent pairings so that every active player plays with <strong>zero benched players</strong>.
                </>
              ) : (
                <>
                  Are you sure you want to redraw? This will re-run the rotation matchmaking algorithm and generate all possible matches for <strong>Round {currentRound.roundNumber}</strong> so that all players play with <strong>zero benched players</strong>.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="btn-cancel-regenerate"
                onClick={() => setShowConfirmRegenerate(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Keep Current
              </button>
              <button
                type="button"
                id="btn-confirm-regenerate"
                onClick={executeRegenerate}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase tracking-wider transition-colors shadow-sm cursor-pointer active:scale-95"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Yes, Redraw Round</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
