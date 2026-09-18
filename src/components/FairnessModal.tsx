import React, { useState } from 'react';
import { FairnessMetric, Player, Round } from '../types';
import {
  getHistoryMatrices,
  getPartnershipCoverage,
  getPlayerMatchCounts,
  getMatchupCoverage,
} from '../utils/fairRotation';
import { TeamTracker } from './TeamTracker';
import { HeadToHeadTracker } from './HeadToHeadTracker';
import {
  ShieldCheck,
  Scale,
  Users,
  CheckCircle2,
  Award,
  Clock,
  Sparkles,
  HeartHandshake,
  Swords,
  Trophy,
  Flame,
  Shuffle,
  ArrowRightLeft,
} from 'lucide-react';

interface FairnessModalProps {
  isOpen: boolean;
  onClose: () => void;
  fairness: FairnessMetric;
  players: Player[];
  rounds: Round[];
}

export const FairnessModal: React.FC<FairnessModalProps> = ({
  isOpen,
  onClose,
  fairness,
  players,
  rounds,
}) => {
  const [activeTab, setActiveTab] = useState<'rotation' | 'partners' | 'matchups' | 'teams'>('rotation');
  const [selectedPartnerPlayerId, setSelectedPartnerPlayerId] = useState<string | null>(null);

  if (!isOpen) return null;

  const activePlayers = players.filter((p) => p.active);
  const matchCounts = getPlayerMatchCounts(activePlayers, rounds);
  const { partnerCount } = getHistoryMatrices(rounds);
  const partnership = getPartnershipCoverage(players, rounds);
  const matchupCoverage = getMatchupCoverage(players, rounds);

  const inspectedPlayer = selectedPartnerPlayerId
    ? activePlayers.find((p) => p.id === selectedPartnerPlayerId) || activePlayers[0]
    : activePlayers[0];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-hidden">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Pinned Top Bar: Header & Tab Navigation (Always visible, never clipped) */}
        <div className="p-4 sm:p-5 pb-3 border-b border-slate-100 bg-white shrink-0 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-yellow-400 text-indigo-950 flex items-center justify-center font-black shadow-xs shrink-0">
                <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-950" />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-indigo-950 text-sm sm:text-base leading-tight truncate">
                  Fair Rotation &amp; Equal Play Engine
                </h2>
                <p className="text-[11px] sm:text-xs font-semibold text-slate-500 truncate">
                  Equal matches • Partner variety • Matchup balance
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center text-lg font-bold leading-none cursor-pointer transition-colors shrink-0"
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Clean Icon-Based Tab Navigation */}
          <div className="flex items-center justify-between gap-2.5 bg-slate-50 p-1.5 rounded-xl sm:rounded-2xl border border-slate-200/80">
            {/* Segmented Icon Buttons */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-200/80 rounded-lg sm:rounded-xl shrink-0">
              <button
                type="button"
                id="tab-fairness-rotation"
                onClick={() => setActiveTab('rotation')}
                title={`Equal Rotation (${fairness.fairnessScorePercentage}% Balanced)`}
                aria-label="Equal Rotation Engine"
                className={`w-9 h-8 sm:w-10 sm:h-8.5 rounded-md sm:rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                  activeTab === 'rotation'
                    ? 'bg-white text-indigo-600 shadow-xs ring-1 ring-slate-300'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                }`}
              >
                <ShieldCheck className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
              </button>

              <button
                type="button"
                id="tab-fairness-partners"
                onClick={() => setActiveTab('partners')}
                title={`Partner Prioritization (${partnership.coveragePercentage}% Duos Formed)`}
                aria-label="Partner Prioritization Engine"
                className={`w-9 h-8 sm:w-10 sm:h-8.5 rounded-md sm:rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                  activeTab === 'partners'
                    ? 'bg-white text-emerald-600 shadow-xs ring-1 ring-slate-300'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                }`}
              >
                <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
              </button>

              <button
                type="button"
                id="tab-fairness-matchups"
                onClick={() => setActiveTab('matchups')}
                title={`Matchup Prioritization & Head-to-Head (${matchupCoverage.coveragePercentage}% Opponents Faced)`}
                aria-label="Matchup Prioritization & Head-to-Head Tracker"
                className={`w-9 h-8 sm:w-10 sm:h-8.5 rounded-md sm:rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                  activeTab === 'matchups'
                    ? 'bg-white text-amber-600 shadow-xs ring-1 ring-slate-300'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                }`}
              >
                <Swords className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
              </button>

              <button
                type="button"
                id="tab-fairness-teams"
                onClick={() => setActiveTab('teams')}
                title="Team Matchups Tracker (Team vs Team Standings)"
                aria-label="Team Matchups Tracker"
                className={`w-9 h-8 sm:w-10 sm:h-8.5 rounded-md sm:rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                  activeTab === 'teams'
                    ? 'bg-white text-violet-600 shadow-xs ring-1 ring-slate-300'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                }`}
              >
                <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.2]" />
              </button>
            </div>

            {/* Active Tab Label & Status Badge */}
            <div className="text-right min-w-0 pr-1">
              <div className="text-xs font-black text-slate-800 truncate flex items-center justify-end gap-1.5">
                {activeTab === 'rotation' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                    <span>Equal Rotation</span>
                  </>
                )}
                {activeTab === 'partners' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
                    <span>Partner Prioritization</span>
                  </>
                )}
                {activeTab === 'matchups' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0"></span>
                    <span>Head to Head</span>
                  </>
                )}
                {activeTab === 'teams' && (
                  <>
                    <span className="w-2 h-2 rounded-full bg-violet-600 shrink-0"></span>
                    <span>Team Matchups</span>
                  </>
                )}
              </div>
              <p className="text-[10px] font-bold text-slate-500 truncate mt-0.5">
                {activeTab === 'rotation' && `${fairness.fairnessScorePercentage}% Balanced`}
                {activeTab === 'partners' && `${partnership.coveragePercentage}% Duos Formed`}
                {activeTab === 'matchups' && `${matchupCoverage.coveragePercentage}% Opponents Faced`}
                {activeTab === 'teams' && 'Pick 2 vs 2 to check head-to-head standings'}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4">
          {activeTab === 'rotation' ? (
            <>
              {/* Live Fairness Score Card */}
              <div className="bg-indigo-900 text-white border border-indigo-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden shadow-sm">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-800 rounded-full opacity-50 pointer-events-none" />
                <div className="relative z-10">
                  <div className="text-xs font-black uppercase tracking-wider text-yellow-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-yellow-300" />
                    Fairness Health Score
                  </div>
                  <div className="text-3xl font-black text-white mt-1">
                    {fairness.fairnessScorePercentage}% Balanced
                  </div>
                  <div className="text-xs text-indigo-200 font-semibold mt-1">
                    Match Spread: <strong className="text-white">{fairness.spread}</strong> (Max {fairness.maxPlayed} vs Min {fairness.minPlayed} matches played)
                  </div>
                </div>

                <div className="sm:text-right relative z-10">
                  <span className="inline-block px-3.5 py-1.5 rounded-full bg-yellow-400 text-indigo-950 font-black text-xs uppercase tracking-wider shadow-xs">
                    Cycle #{fairness.currentCycle} Active
                  </span>
                  <div className="text-[11px] text-indigo-200 font-semibold mt-1.5">
                    {fairness.playersInCurrentCycle} / {fairness.totalActivePlayers} players in current cycle
                  </div>
                </div>
              </div>

              {/* 3 Core Pillars */}
              <div className="space-y-2.5 text-xs text-slate-700">
                <h3 className="font-black text-indigo-950 text-xs uppercase tracking-wider">
                  How Equal Fairness Is Guaranteed:
                </h3>

                <div className="flex gap-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 font-bold">1. Strict 1-Match Barrier</strong>
                    <p className="text-slate-600 font-medium mt-0.5">
                      Every player must play their 1st match before any player is assigned their 2nd match. The difference in games played across active players never exceeds 1.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50">
                  <Clock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 font-bold">2. Catch-Up Cadence (2 Straight, 1 Rest)</strong>
                    <p className="text-slate-600 font-medium mt-0.5">
                      Players behind in matches played can play 2 games straight to catch up, rest for the next match, then play 2 games straight again, and repeat this cadence until they have caught up to the group's matches played.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50">
                  <Users className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 font-bold">3. Unpaired Duo Priority</strong>
                    <p className="text-slate-600 font-medium mt-0.5">
                      Players who have never partnered together are given strict priority to pair up so everyone gets a chance to team up with each attendee.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50">
                  <Shuffle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 font-bold">4. Unbiased Round 1 Random Draw</strong>
                    <p className="text-slate-600 font-medium mt-0.5">
                      When starting a round for the very first time, the players chosen for the first match are selected randomly rather than following bench list position, eliminating any loophole where players register first to play first.
                    </p>
                  </div>
                </div>
              </div>

              {/* Player Match Distribution List */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70">
                <div className="font-black text-indigo-950 text-xs uppercase tracking-wider mb-2.5">
                  Active Players Rotation Tracker:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {activePlayers.map((p) => {
                    const count = matchCounts[p.id] || 0;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs"
                      >
                        <span className="truncate font-bold text-slate-800">{p.name}</span>
                        <span className="ml-1 font-black text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-lg text-[11px]">
                          {count} {count === 1 ? 'match' : 'matches'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : activeTab === 'partners' ? (
            <>
              {/* Partner Coverage Card */}
              <div className="bg-emerald-950 text-white border border-emerald-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden shadow-sm">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-800 rounded-full opacity-50 pointer-events-none" />
                <div className="relative z-10">
                  <div className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                    Partnership Mixing Progress
                  </div>
                  <div className="text-3xl font-black text-white mt-1">
                    {partnership.uniquePairsFormed} / {partnership.totalPossiblePairs} Duos
                  </div>
                  <div className="text-xs text-emerald-200 font-semibold mt-1">
                    {partnership.coveragePercentage}% of all possible attendee pairs have teamed up
                  </div>
                </div>

                <div className="sm:text-right relative z-10">
                  <span className="inline-block px-3.5 py-1.5 rounded-full bg-emerald-400 text-emerald-950 font-black text-xs uppercase tracking-wider shadow-xs">
                    {partnership.neverPairedCount} Unpaired Duos
                  </span>
                  <div className="text-[11px] text-emerald-200 font-semibold mt-1.5">
                    Unpaired pairs receive #1 priority
                  </div>
                </div>
              </div>

              {/* Guarantee Explanation Banner */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1">
                <div className="font-black flex items-center gap-1.5 text-emerald-900">
                  <HeartHandshake className="w-4 h-4 text-emerald-700" />
                  Unpaired Partner Prioritization Guarantee
                </div>
                <p className="text-slate-700 leading-relaxed font-medium">
                  When assigning teams for each court, the algorithm evaluates all candidate duos and scores zero-history partners with the highest bonus weight (+250pts). This guarantees every player gets a chance to team up with every other player!
                </p>
              </div>

              {/* Interactive Player Duo Inspector */}
              {activePlayers.length > 0 && inspectedPlayer && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-black text-indigo-950 text-xs uppercase tracking-wider">
                        Inspect Player Partnerships:
                      </div>
                      <div className="flex items-center gap-2.5 text-[10px] font-semibold text-slate-500 mt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          Unpaired (0x)
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                          Paired
                        </span>
                      </div>
                    </div>
                    <select
                      value={inspectedPlayer.id}
                      onChange={(e) => setSelectedPartnerPlayerId(e.target.value)}
                      className="text-xs font-bold bg-white text-slate-800 border border-slate-300 rounded-xl px-2.5 py-1 focus:ring-2 focus:ring-indigo-600 focus:outline-none cursor-pointer"
                    >
                      {activePlayers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {activePlayers
                      .filter((p) => p.id !== inspectedPlayer.id)
                      .map((other) => {
                        const times = partnerCount[inspectedPlayer.id]?.[other.id] || 0;
                        const hasPaired = times > 0;
                        return (
                          <div
                            key={other.id}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs border transition-colors ${
                              hasPaired
                                ? 'bg-white border-slate-200 text-slate-800'
                                : 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border border-white shrink-0 ${other.avatarColor}`}
                              >
                                {other.name.charAt(0)}
                              </span>
                              <span className="font-bold truncate">{other.name}</span>
                            </div>

                            {hasPaired ? (
                              <span className="font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg text-[11px] shrink-0">
                                {times}x
                              </span>
                            ) : (
                              <span className="font-black text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-lg text-[11px] shrink-0">
                                0x
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </>
          ) : activeTab === 'matchups' ? (
            <>
              {/* Matchup Prioritization & Diversity Card */}
              <div className="bg-amber-950 text-white border border-amber-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden shadow-sm">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-800 rounded-full opacity-40 pointer-events-none" />
                <div className="relative z-10">
                  <div className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Swords className="w-4 h-4 text-amber-300" />
                    Matchup Diversity &amp; Rivalry Progress
                  </div>
                  <div className="text-3xl font-black text-white mt-1">
                    {matchupCoverage.uniqueMatchupsFormed} / {matchupCoverage.totalPossibleMatchups} Matchups
                  </div>
                  <div className="text-xs text-amber-200 font-semibold mt-1">
                    {matchupCoverage.coveragePercentage}% of all possible opponent pairings have battled on court
                  </div>
                </div>

                <div className="sm:text-right relative z-10">
                  <span className="inline-block px-3.5 py-1.5 rounded-full bg-amber-400 text-amber-950 font-black text-xs uppercase tracking-wider shadow-xs">
                    {matchupCoverage.neverFacedCount} Unfaced Matchups
                  </span>
                  <div className="text-[11px] text-amber-200 font-semibold mt-1.5">
                    Unfaced rivals prioritized next
                  </div>
                </div>
              </div>

              {/* Matchup Guarantee Explanation */}
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs space-y-1">
                <div className="font-black flex items-center gap-1.5 text-amber-900">
                  <Swords className="w-4 h-4 text-amber-700" />
                  Opponent Matchup Prioritization Guarantee
                </div>
                <p className="text-slate-700 leading-relaxed font-medium">
                  The matchmaking algorithm actively discourages repeat encounters by assessing previous matchups (+10 penalty per prior game). Players who have not yet faced each other are prioritized to square off across the net, ensuring fresh and varied gameplays for all!
                </p>
              </div>

              {/* Head-to-Head Record Tracker Component */}
              <HeadToHeadTracker players={players} rounds={rounds} />
            </>
          ) : (
            <div className="pt-1">
              <TeamTracker players={players} rounds={rounds} />
            </div>
          )}
        </div>

        {/* Modal Bottom Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end shrink-0">
          <button
            type="button"
            id="btn-close-fairness-modal"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

