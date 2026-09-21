import React, { useState, useMemo, useEffect } from 'react';
import {
  GroupStage,
  TournamentGroup,
  Player,
  SessionConfig,
  Match,
  StandingsRow,
} from '../types';
import {
  buildGroups,
  generateGroupRoundRobin,
  getGroupStandings,
  getGroupStageProgress,
  updateGroupMatchScore,
  assignGroupMatchCourt,
  formatGroupStageForSharing,
} from '../utils/groupStage';
import {
  Trophy,
  Medal,
  Users,
  Swords,
  CheckCircle2,
  Sparkles,
  Share2,
  Check,
  RotateCcw,
  ArrowRight,
  Plus,
  Minus,
  Play,
  Lock,
  Unlock,
  Layers,
  ArrowUpDown,
  Filter,
  Shield,
  HelpCircle,
  BarChart3,
  Calendar,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFx } from '../utils/audio';

interface GroupStageViewProps {
  groupStage: GroupStage | null;
  players: Player[];
  config: SessionConfig;
  onUpdateGroupStage: (updatedStage: GroupStage | null) => void;
  onNavigateToBracket?: () => void;
}

export const GroupStageView: React.FC<GroupStageViewProps> = ({
  groupStage,
  players,
  config,
  onUpdateGroupStage,
  onNavigateToBracket,
}) => {
  const [selectedGroupTab, setSelectedGroupTab] = useState<string>('all');
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);
  const [targetGroupSize, setTargetGroupSize] = useState<number>(4);
  const [seedingType, setSeedingType] = useState<'random' | 'rating'>('rating');
  const [finalsFormat, setFinalsFormat] = useState<'single_final' | 'true_double_elim'>('single_final');
  const [copiedShare, setCopiedShare] = useState<boolean>(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState<boolean>(false);

  // Player Map for quick name / avatar lookups
  const playersMap = useMemo(() => {
    const map = new Map<string, Player>();
    const dict: Record<string, Player> = {};
    players.forEach((p) => {
      map.set(p.id, p);
      dict[p.id] = p;
    });
    return { map, dict };
  }, [players]);

  // Overall Group Stage Progress
  const progress = useMemo(() => {
    return groupStage ? getGroupStageProgress(groupStage) : null;
  }, [groupStage]);

  const isFinalized = Boolean(groupStage?.completedAt);

  // Confetti on finalization
  useEffect(() => {
    if (isFinalized) {
      try {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.5 },
        });
      } catch {}
    }
  }, [isFinalized]);

  // Generate / Initialize Group Stage
  const handleCreateGroupStage = () => {
    const activePlayers = players.filter((p) => p.active);
    if (activePlayers.length < 3) return;

    // Handle singles vs locked duo teams
    let entrantIds: string[];
    let seedOrder: string[] | undefined = undefined;

    if (config.format === 'doubles') {
      // Find duos and unlinked players
      const visited = new Set<string>();
      const teams: string[] = [];

      activePlayers.forEach((p) => {
        if (visited.has(p.id)) return;
        if (p.duoPartnerId) {
          const partner = activePlayers.find((partnerP) => partnerP.id === p.duoPartnerId);
          if (partner) {
            visited.add(p.id);
            visited.add(partner.id);
            teams.push(`${p.id},${partner.id}`);
            return;
          }
        }
        visited.add(p.id);
        teams.push(p.id);
      });

      entrantIds = teams;

      if (seedingType === 'rating') {
        // Average DUPR rating of team
        seedOrder = [...teams].sort((a, b) => {
          const getAvgRating = (entrant: string) => {
            const ids = entrant.split(',');
            const sum = ids.reduce((acc, id) => acc + (playersMap.map.get(id)?.duprRating || 3.5), 0);
            return sum / ids.length;
          };
          return getAvgRating(b) - getAvgRating(a);
        });
      }
    } else {
      // Singles
      entrantIds = activePlayers.map((p) => p.id);

      if (seedingType === 'rating') {
        seedOrder = [...activePlayers]
          .sort((a, b) => (b.duprRating || 3.5) - (a.duprRating || 3.5))
          .map((p) => p.id);
      }
    }

    const generatedGroups = buildGroups(entrantIds, targetGroupSize, seedOrder);

    // Generate round-robin schedule for each group & distribute default courts
    let courtCounter = 1;
    const groupsWithSchedules: TournamentGroup[] = generatedGroups.map((grp) => {
      const scheduledRounds = generateGroupRoundRobin(grp);

      // Distribute initial courts across matches
      const roundsWithCourts = scheduledRounds.map((r) => ({
        ...r,
        matches: r.matches.map((m) => {
          const assignedCourt = ((courtCounter - 1) % config.courtsCount) + 1;
          courtCounter++;
          return {
            ...m,
            courtNumber: assignedCourt,
          };
        }),
      }));

      return {
        ...grp,
        rounds: roundsWithCourts,
      };
    });

    const newStage: GroupStage = {
      id: `group-stage-${Date.now()}`,
      groups: groupsWithSchedules,
      finalsFormat,
    };

    onUpdateGroupStage(newStage);
    setShowSetupModal(false);
    setSelectedGroupTab('all');
    soundFx.playWhistle();
  };

  // Update Match Score
  const handleScoreChange = (matchId: string, deltaTeam: 1 | 2, currentScore1: number, currentScore2: number) => {
    if (!groupStage || isFinalized) return;

    let nextScore1 = currentScore1;
    let nextScore2 = currentScore2;

    if (deltaTeam === 1) {
      nextScore1 = Math.max(0, currentScore1 + 1);
    } else {
      nextScore2 = Math.max(0, currentScore2 + 1);
    }

    soundFx.playPointChime();
    const updated = updateGroupMatchScore(groupStage, matchId, nextScore1, nextScore2);
    onUpdateGroupStage(updated);
  };

  const handleSetDirectScore = (matchId: string, s1: number, s2: number, isDone?: boolean) => {
    if (!groupStage || isFinalized) return;
    const updated = updateGroupMatchScore(groupStage, matchId, s1, s2, isDone);
    onUpdateGroupStage(updated);
  };

  const handleToggleCompleteMatch = (match: Match) => {
    if (!groupStage || isFinalized) return;
    const nextCompleted = !match.completed;
    soundFx.playWhistle();
    const updated = updateGroupMatchScore(groupStage, match.id, match.score1, match.score2, nextCompleted);
    onUpdateGroupStage(updated);
  };

  // Change Assigned Court
  const handleAssignCourt = (matchId: string, courtNumber: number) => {
    if (!groupStage || isFinalized) return;
    const updated = assignGroupMatchCourt(groupStage, matchId, courtNumber);
    onUpdateGroupStage(updated);
  };

  // Finalize Group Stage
  const handleFinalizeGroupStage = () => {
    if (!groupStage || !progress?.isComplete) return;

    soundFx.playVictoryFanfare();
    const finalizedStage: GroupStage = {
      ...groupStage,
      completedAt: Date.now(),
    };
    onUpdateGroupStage(finalizedStage);
  };

  // Unlock Group Stage
  const handleUnlockGroupStage = () => {
    if (!groupStage) return;
    const unlocked: GroupStage = {
      ...groupStage,
      completedAt: undefined,
    };
    onUpdateGroupStage(unlocked);
    setShowUnlockConfirm(false);
    soundFx.playPointChime();
  };

  // Share Results
  const handleCopyShare = () => {
    if (!groupStage) return;
    const text = formatGroupStageForSharing(
      config.sessionName || 'Tournament',
      groupStage,
      players
    );
    navigator.clipboard.writeText(text);
    setCopiedShare(true);
    soundFx.playPointChime();
    setTimeout(() => setCopiedShare(false), 2500);
  };

  // Helper to format player names for a match team
  const formatTeamNames = (playerIds: string[]) => {
    if (!playerIds || playerIds.length === 0) return 'TBD';
    return playerIds
      .map((id) => playersMap.map.get(id)?.name || 'Unknown')
      .join(' & ');
  };

  // If no group stage is active, show the setup landing
  if (!groupStage) {
    return (
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-sm text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-indigo-950 flex items-center justify-center mx-auto shadow-md">
            <Layers className="w-8 h-8" />
          </div>

          <div className="max-w-lg mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Group Stage Tournament
            </h2>
            <p className="text-sm font-medium text-slate-500 leading-relaxed">
              Split entrants into balanced pools (Groups A, B, C...) where each group plays a complete round robin among its own members, advancing top finishers into playoff brackets.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left pt-2">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <span className="text-xs font-black text-indigo-950 uppercase flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                Auto-Balanced Pools
              </span>
              <p className="text-[11px] text-slate-500 font-medium">
                Target 4 per group, automatically adjusting to 3 or 5 when counts don't divide evenly.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <span className="text-xs font-black text-indigo-950 uppercase flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                Concurrent Courts
              </span>
              <p className="text-[11px] text-slate-500 font-medium">
                Dispatch matches from all groups simultaneously across your {config.courtsCount} available courts.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
              <span className="text-xs font-black text-indigo-950 uppercase flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-emerald-600" />
                Dual Playoff Paths
              </span>
              <p className="text-[11px] text-slate-500 font-medium">
                1st place seeds directly into Winners Bracket, 2nd into Losers Bracket.
              </p>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="button"
              id="btn-create-group-stage"
              onClick={() => setShowSetupModal(true)}
              className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-wider transition-all shadow-md hover:shadow-indigo-300 cursor-pointer inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span>Configure &amp; Generate Groups</span>
            </button>
          </div>
        </div>

        {/* Setup Modal */}
        {showSetupModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-5 animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-400 text-indigo-950 flex items-center justify-center font-black">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Setup Group Stage</h3>
                    <p className="text-xs text-slate-500 font-semibold">{players.filter((p) => p.active).length} Active Entrants</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSetupModal(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Target Group Size */}
                <div className="space-y-1.5">
                  <label className="block font-black text-indigo-950 uppercase tracking-wider">
                    Target Group Size
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[3, 4, 5].map((size) => (
                      <button
                        key={`size-${size}`}
                        type="button"
                        onClick={() => setTargetGroupSize(size)}
                        className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer text-center ${
                          targetGroupSize === size
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {size} Entrants
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Groups are mathematically balanced between 3 and 5 so every entrant has equal matches.
                  </p>
                </div>

                {/* Seeding Method */}
                <div className="space-y-1.5">
                  <label className="block font-black text-indigo-950 uppercase tracking-wider">
                    Group Seeding Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSeedingType('rating')}
                      className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer text-left ${
                        seedingType === 'rating'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-black">Snake Seeding (DUPR)</div>
                      <div className="text-[10px] opacity-80">Balances top-ranked players across groups</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSeedingType('random')}
                      className={`py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer text-left ${
                        seedingType === 'random'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-black">Random Draw</div>
                      <div className="text-[10px] opacity-80">Blind lottery shuffle</div>
                    </button>
                  </div>
                </div>

                {/* Playoff Finals Format */}
                <div className="space-y-1.5">
                  <label className="block font-black text-indigo-950 uppercase tracking-wider">
                    Playoff Finals Format
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFinalsFormat('single_final')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        finalsFormat === 'single_final'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs">Single Final (Default)</span>
                        {finalsFormat === 'single_final' && <span className="w-2 h-2 rounded-full bg-amber-300" />}
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        Winner of Match 1 is crowned Champion. Simpler for casual club sessions.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFinalsFormat('true_double_elim')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        finalsFormat === 'true_double_elim'
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs">True Double Elimination</span>
                        {finalsFormat === 'true_double_elim' && <span className="w-2 h-2 rounded-full bg-amber-300" />}
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5">
                        If Losers Bracket champion wins Match 1, a deciding Reset Match follows.
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSetupModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="btn-confirm-generate-groups"
                  onClick={handleCreateGroupStage}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Generate Groups</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Filter groups according to selected tab
  const displayGroups =
    selectedGroupTab === 'all'
      ? groupStage.groups
      : groupStage.groups.filter((g) => g.id === selectedGroupTab);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-7 space-y-6">
      {/* Top Banner & Group Stage Progress */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-indigo-950 flex items-center justify-center font-black shadow-md shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                  {groupStage.groups.length} Groups • {config.sport.toUpperCase()}
                </span>
                {isFinalized ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Finalized &amp; Locked
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-900 border border-indigo-200">
                    Group Stage Active
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                {isFinalized ? 'Group Stage Results & Final Standings' : 'Group Stage Matches & Pools'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <button
              type="button"
              id="btn-share-group-stage"
              onClick={handleCopyShare}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer shrink-0"
            >
              {copiedShare ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedShare ? 'Copied!' : 'Share Results'}</span>
            </button>

            {!isFinalized ? (
              <button
                type="button"
                id="btn-finalize-group-stage"
                disabled={!progress?.isComplete}
                onClick={handleFinalizeGroupStage}
                className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shrink-0 ${
                  progress?.isComplete
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer animate-pulse'
                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                }`}
                title={progress?.isComplete ? 'Lock group stage results and crown qualifiers' : 'Complete all group matches first'}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Finalize Group Stage</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-unlock-group-stage"
                  onClick={() => setShowUnlockConfirm(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Re-open Stage</span>
                </button>

                {onNavigateToBracket && (
                  <button
                    type="button"
                    id="btn-group-stage-go-bracket"
                    onClick={onNavigateToBracket}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>Proceed to Playoffs</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              Group Stage Progress
            </span>
            <span className="font-bold text-indigo-700">
              {progress?.completedMatches} of {progress?.totalMatches} group matches played ({progress?.percentage}%)
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${
                progress?.isComplete ? 'bg-emerald-500' : 'bg-indigo-600'
              }`}
              style={{ width: `${progress?.percentage || 0}%` }}
            />
          </div>
        </div>

        {/* Group Tabs Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1">
          <button
            type="button"
            onClick={() => setSelectedGroupTab('all')}
            className={`px-4 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer shrink-0 ${
              selectedGroupTab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Groups ({groupStage.groups.length})
          </button>

          {groupStage.groups.map((group) => {
            const groupProg = progress?.matchesByGroup[group.id];
            const isGroupDone = groupProg && groupProg.total > 0 && groupProg.completed === groupProg.total;

            return (
              <button
                key={`tab-${group.id}`}
                type="button"
                onClick={() => setSelectedGroupTab(group.id)}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  selectedGroupTab === group.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{group.label}</span>
                {isGroupDone ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <span className="text-[10px] opacity-75">
                    ({groupProg?.completed || 0}/{groupProg?.total || 0})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. FINALIZED GROUP STAGE RESULTS SUMMARY (WHEN COMPLETED) */}
      {isFinalized && (
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-3xl p-5 sm:p-7 shadow-xl space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-indigo-950 flex items-center justify-center font-black">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Group Stage Final Qualifiers</h3>
                <p className="text-xs text-indigo-200">
                  Top 2 from each group advance to Single-Elimination Championship Brackets
                </p>
              </div>
            </div>

            {onNavigateToBracket && (
              <button
                type="button"
                onClick={onNavigateToBracket}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Swords className="w-4 h-4" />
                <span>Open Bracket View</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupStage.groups.map((group) => {
              const groupStandings = getGroupStandings(group, players);
              const winner1 = groupStandings[0];
              const runnerUp2 = groupStandings[1];

              return (
                <div
                  key={`final-summary-${group.id}`}
                  className="bg-white/10 border border-white/10 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="font-black text-amber-300 text-sm uppercase">
                      {group.label}
                    </span>
                    <span className="text-[10px] font-bold text-indigo-200">
                      {groupStandings.length} Entrants
                    </span>
                  </div>

                  <div className="space-y-2">
                    {/* 1st Place */}
                    {winner1 && (
                      <div className="p-2.5 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-lg bg-amber-400 text-indigo-950 font-black text-xs flex items-center justify-center shrink-0">
                            1
                          </span>
                          <span className="font-black text-white text-xs truncate">
                            {winner1.playerName}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-400 text-indigo-950 shrink-0">
                          ➔ Winners Bracket
                        </span>
                      </div>
                    )}

                    {/* 2nd Place */}
                    {runnerUp2 && (
                      <div className="p-2.5 rounded-xl bg-indigo-400/20 border border-indigo-400/30 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-lg bg-indigo-300 text-indigo-950 font-black text-xs flex items-center justify-center shrink-0">
                            2
                          </span>
                          <span className="font-bold text-white text-xs truncate">
                            {runnerUp2.playerName}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-300 text-indigo-950 shrink-0">
                          ➔ Losers Bracket
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GROUPS LISTING & MATCH PLAY CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {displayGroups.map((group) => {
          const groupStandings = getGroupStandings(group, players);
          const allGroupMatches: Match[] = group.rounds.flatMap((r) => r.matches);
          const completedCount = allGroupMatches.filter((m) => m.completed).length;

          return (
            <div
              key={`group-card-${group.id}`}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4"
            >
              {/* Group Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 flex items-center justify-center font-black text-sm">
                    {group.label.charAt(group.label.length - 1)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">{group.label}</h3>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {group.entrantIds.length} Entrants • {completedCount}/{allGroupMatches.length} Matches Done
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    completedCount === allGroupMatches.length && allGroupMatches.length > 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {completedCount === allGroupMatches.length && allGroupMatches.length > 0
                    ? 'Completed'
                    : `${allGroupMatches.length - completedCount} Left`}
                </span>
              </div>

              {/* Mini Standings Table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 px-1">
                  <span>Group Standings</span>
                  <span>W-L • Diff • Win%</span>
                </div>

                <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/50 overflow-hidden text-xs">
                  {groupStandings.map((row, idx) => {
                    const isTop1 = idx === 0;
                    const isTop2 = idx === 1;

                    return (
                      <div
                        key={`std-${group.id}-${row.playerId}`}
                        className={`flex items-center justify-between px-3 py-2 ${
                          isTop1
                            ? 'bg-amber-50/70 font-semibold'
                            : isTop2
                            ? 'bg-indigo-50/50 font-medium'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-4 font-black text-slate-500 text-center text-xs">
                            {idx + 1}
                          </span>
                          <div
                            className={`w-5 h-5 rounded-full ${row.avatarColor} text-[10px] font-black flex items-center justify-center shrink-0`}
                          >
                            {row.playerName.charAt(0)}
                          </div>
                          <span className="font-bold text-slate-900 truncate">
                            {row.playerName}
                          </span>

                          {isTop1 && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-200 text-amber-900 shrink-0">
                              1st
                            </span>
                          )}
                          {isTop2 && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-200 text-indigo-900 shrink-0">
                              2nd
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 font-semibold text-slate-600 shrink-0">
                          <span>
                            <strong className="text-slate-900">{row.won}W</strong>-{row.lost}L
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                          </span>
                          <span className="font-bold text-indigo-600 w-9 text-right">
                            {row.winRate}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Group Match List with Live Score Entry */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block px-1">
                  Scheduled Matches
                </span>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {group.rounds.map((round) => (
                    <div key={`rnd-${group.id}-${round.roundNumber}`} className="space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                        Round {round.roundNumber}
                      </div>

                      {round.matches.map((m) => {
                        const team1Name = formatTeamNames(m.team1.playerIds);
                        const team2Name = formatTeamNames(m.team2.playerIds);

                        return (
                          <div
                            key={`match-${m.id}`}
                            className={`p-3 rounded-2xl border transition-all ${
                              m.completed
                                ? 'bg-slate-50 border-slate-200'
                                : 'bg-white border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs mb-2">
                              {/* Court Assignment Selector */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black text-slate-500 uppercase">
                                  Court:
                                </span>
                                <select
                                  disabled={isFinalized}
                                  value={m.courtNumber || 1}
                                  onChange={(e) =>
                                    handleAssignCourt(m.id, parseInt(e.target.value, 10) || 1)
                                  }
                                  className="text-xs font-black bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
                                >
                                  {Array.from({ length: config.courtsCount }, (_, i) => (
                                    <option key={`court-opt-${i + 1}`} value={i + 1}>
                                      Court {i + 1}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {m.completed ? (
                                <span className="text-emerald-600 font-black text-[10px] flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Final
                                </span>
                              ) : (
                                <span className="text-amber-700 font-bold text-[10px] bg-amber-100 px-2 py-0.5 rounded-full">
                                  In Progress
                                </span>
                              )}
                            </div>

                            {/* Team 1 Score Row */}
                            <div
                              className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold mb-1 ${
                                m.completed && m.score1 > m.score2
                                  ? 'bg-amber-100 text-amber-950 font-black'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              <span className="truncate">{team1Name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {!isFinalized && !m.completed && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetDirectScore(
                                          m.id,
                                          Math.max(0, m.score1 - 1),
                                          m.score2
                                        )
                                      }
                                      className="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-black flex items-center justify-center cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleScoreChange(m.id, 1, m.score1, m.score2)
                                      }
                                      className="w-5 h-5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center justify-center cursor-pointer shadow-2xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                                <span className="font-black text-sm w-6 text-center">{m.score1}</span>
                              </div>
                            </div>

                            {/* Team 2 Score Row */}
                            <div
                              className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold mb-2 ${
                                m.completed && m.score2 > m.score1
                                  ? 'bg-amber-100 text-amber-950 font-black'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              <span className="truncate">{team2Name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {!isFinalized && !m.completed && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetDirectScore(
                                          m.id,
                                          m.score1,
                                          Math.max(0, m.score2 - 1)
                                        )
                                      }
                                      className="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-black flex items-center justify-center cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleScoreChange(m.id, 2, m.score1, m.score2)
                                      }
                                      className="w-5 h-5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center justify-center cursor-pointer shadow-2xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                                <span className="font-black text-sm w-6 text-center">{m.score2}</span>
                              </div>
                            </div>

                            {/* Match Action Button */}
                            {!isFinalized && (
                              <button
                                type="button"
                                onClick={() => handleToggleCompleteMatch(m)}
                                className={`w-full py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                                  m.completed
                                    ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                                }`}
                              >
                                {m.completed ? (
                                  <>
                                    <RotateCcw className="w-3 h-3 text-slate-600" />
                                    <span>Re-open Match</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Confirm Final Score</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation to Unlock / Reopen Finalized Stage */}
      {showUnlockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-slate-900 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-amber-600">
              <Unlock className="w-5 h-5" />
              <h3 className="text-sm font-black text-slate-900">Reopen Group Stage?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Reopening will allow you to edit match scores or reassign courts. You can finalize it again anytime once changes are done.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowUnlockConfirm(false)}
                className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnlockGroupStage}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-indigo-950 font-black text-xs uppercase tracking-wider shadow-sm cursor-pointer"
              >
                Confirm Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
