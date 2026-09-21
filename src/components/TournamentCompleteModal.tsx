import React, { useState, useEffect, useMemo } from 'react';
import {
  Bracket,
  BracketMatch,
  BracketSlot,
  Player,
  Round,
  SessionConfig,
  StandingsRow,
} from '../types';
import {
  calculateStandings,
  formatStandingsForSharing,
  formatCombinedTournamentForSharing,
} from '../utils/standings';
import { getMatchupCoverage } from '../utils/fairRotation';
import {
  seedEntrants,
  generateBracket,
  getBracketRoundName,
  getBracketProgress,
  SeedingMethod,
  DoublesPairingMethod,
} from '../utils/bracket';
import {
  Trophy,
  Medal,
  Sparkles,
  Share2,
  Check,
  RotateCcw,
  ArrowRight,
  X,
  Award,
  Users,
  Target,
  BarChart3,
  ShieldCheck,
  Swords,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Flame,
  CheckCircle2,
  Play,
  Maximize2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFx } from '../utils/audio';

interface TournamentCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SessionConfig;
  players: Player[];
  rounds: Round[];
  bracket?: Bracket | null;
  onExitTournamentMode: () => void;
  onViewStandingsTab?: () => void;
  onRunExtraRound?: () => void;
  onStartNewTournament?: () => void;
  onOpenBracket?: () => void;
  onStartBracket?: (
    method: SeedingMethod,
    format: 'singles' | 'doubles',
    doublesPairingMethod: DoublesPairingMethod,
    selectedPlayerIds?: string[]
  ) => void;
  onRecordBracketResult?: (matchId: string, score1: number, score2: number) => void;
  onResetBracket?: () => void;
}

type ModalTab = 'pool_standings' | 'playoff_bracket' | 'champion_recap';

export const TournamentCompleteModal: React.FC<TournamentCompleteModalProps> = ({
  isOpen,
  onClose,
  config,
  players,
  rounds,
  bracket,
  onExitTournamentMode,
  onViewStandingsTab,
  onRunExtraRound,
  onStartNewTournament,
  onOpenBracket,
  onStartBracket,
  onRecordBracketResult,
  onResetBracket,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<ModalTab>('pool_standings');
  const [isAdjustingQualifiers, setIsAdjustingQualifiers] = useState(false);
  const [selectedPlayerIdsForBracket, setSelectedPlayerIdsForBracket] = useState<string[]>([]);

  // Bracket inline scoring state
  const [activeScoreMatch, setActiveScoreMatch] = useState<BracketMatch | null>(null);
  const [score1, setScore1] = useState<number>(0);
  const [score2, setScore2] = useState<number>(0);
  const [scoreError, setScoreError] = useState<string | null>(null);

  // Player map lookup
  const playersMap = useMemo(() => {
    const map = new Map<string, Player>();
    const dict: Record<string, Player> = {};
    players.forEach((p) => {
      map.set(p.id, p);
      dict[p.id] = p;
    });
    return { map, dict };
  }, [players]);

  // Compute final pool standings
  const standings = useMemo(() => {
    return calculateStandings(players, rounds);
  }, [players, rounds]);

  const bracketCutoff = config.tournamentMode?.bracketCutoff;
  const isCombinedFormat = Boolean(bracketCutoff && bracketCutoff > 0);

  // Default qualifier selection (top N from standings)
  useEffect(() => {
    if (isOpen && standings.length > 0) {
      const cutoff = bracketCutoff || (config.format === 'doubles' ? 8 : 4);
      const topIds = standings.slice(0, Math.min(cutoff, standings.length)).map((s) => s.playerId);
      setSelectedPlayerIdsForBracket(topIds);

      // Default active tab based on status
      if (bracket?.championPlayerIds && bracket.championPlayerIds.length > 0) {
        setActiveTab('champion_recap');
      } else if (bracket && bracket.matches.length > 0) {
        setActiveTab('playoff_bracket');
      } else {
        setActiveTab('pool_standings');
      }

      soundFx.playVictoryFanfare();
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
        });
      } catch {}
    }
  }, [isOpen, standings, bracketCutoff]);

  if (!isOpen) return null;

  const coverage = getMatchupCoverage(players, rounds);
  const totalCompletedMatches = rounds.reduce(
    (acc, r) => acc + r.matches.filter((m) => m.completed).length,
    0
  );
  const totalPoints = rounds.reduce(
    (acc, r) =>
      acc +
      r.matches
        .filter((m) => m.completed)
        .reduce((mAcc, m) => mAcc + (m.score1 || 0) + (m.score2 || 0), 0),
    0
  );

  const firstPlace = standings[0];
  const secondPlace = standings[1];
  const thirdPlace = standings[2];

  // Bracket progress
  const bracketProgress = bracket ? getBracketProgress(bracket) : null;
  const isBracketFinished = Boolean(
    bracket?.championPlayerIds && bracket.championPlayerIds.length > 0
  );

  // Bracket Champion Name(s)
  const bracketChampionNames =
    bracket?.championPlayerIds && bracket.championPlayerIds.length > 0
      ? bracket.championPlayerIds.map((id) => playersMap.map.get(id)?.name || id).join(' & ')
      : null;

  // Bracket Rounds Data for inline view
  const bracketRoundsData = () => {
    if (!bracket || !bracket.matches || bracket.matches.length === 0) return [];
    const totalRounds = Math.max(...bracket.matches.map((m) => m.round), 1);
    const groups: { round: number; name: string; matches: BracketMatch[] }[] = [];

    for (let r = 1; r <= totalRounds; r++) {
      const matchesInRound = bracket.matches
        .filter((m) => m.round === r)
        .sort((a, b) => a.position - b.position);

      groups.push({
        round: r,
        name: getBracketRoundName(r, totalRounds),
        matches: matchesInRound,
      });
    }

    return groups;
  };

  // Copy shareable summary
  const handleCopy = () => {
    let text = '';
    if (isCombinedFormat || bracket) {
      text = formatCombinedTournamentForSharing(
        config.sessionName || 'Tournament',
        standings,
        rounds.length,
        bracket,
        playersMap.dict
      );
    } else {
      text = formatStandingsForSharing(
        config.sessionName || 'Tournament',
        standings,
        rounds.length
      );
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    soundFx.playPointChime();
    setTimeout(() => setCopied(false), 2500);
  };

  // Qualifier adjustment helpers
  const handleMoveQualifier = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= selectedPlayerIdsForBracket.length) return;

    const list = [...selectedPlayerIdsForBracket];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    setSelectedPlayerIdsForBracket(list);
  };

  const handleTogglePlayerSelection = (playerId: string) => {
    if (selectedPlayerIdsForBracket.includes(playerId)) {
      if (selectedPlayerIdsForBracket.length <= 2) {
        return; // minimum 2 entrants
      }
      setSelectedPlayerIdsForBracket(selectedPlayerIdsForBracket.filter((id) => id !== playerId));
    } else {
      setSelectedPlayerIdsForBracket([...selectedPlayerIdsForBracket, playerId]);
    }
  };

  // Generate Bracket from Qualifiers
  const handleGenerateBracket = () => {
    if (!onStartBracket) return;
    const format = config.format === 'singles' ? 'singles' : 'doubles';
    const doublesMethod: DoublesPairingMethod = 'adjacent';

    onStartBracket('standings', format, doublesMethod, selectedPlayerIdsForBracket);
    setActiveTab('playoff_bracket');
    soundFx.playWhistle();
    try {
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {}
  };

  // Inline Bracket Match Scoring
  const handleOpenInlineScore = (match: BracketMatch) => {
    if (!match.slotA || !match.slotB) return;
    if (match.slotA.isBye || match.slotB.isBye) return;

    setActiveScoreMatch(match);
    setScore1(match.score1 ?? config.targetPoints ?? 21);
    setScore2(match.score2 ?? Math.max(0, (config.targetPoints ?? 21) - 3));
    setScoreError(null);
  };

  const handleConfirmInlineScore = () => {
    if (!activeScoreMatch || !onRecordBracketResult) return;
    if (score1 === score2) {
      setScoreError('Single-elimination matches cannot end in a tie.');
      return;
    }
    if (score1 < 0 || score2 < 0) {
      setScoreError('Scores cannot be negative.');
      return;
    }

    soundFx.playWhistle();
    onRecordBracketResult(activeScoreMatch.id, score1, score2);
    setActiveScoreMatch(null);
    setScoreError(null);
  };

  const getSlotNames = (slot: BracketSlot | null): string => {
    if (!slot) return 'Waiting for previous match...';
    if (slot.isBye) return 'BYE';
    if (!slot.playerIds || slot.playerIds.length === 0) return 'TBD';

    return slot.playerIds
      .map((id) => playersMap.map.get(id)?.name || 'Unknown')
      .join(' & ');
  };

  return (
    <div
      id="tournament-complete-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full my-6 p-5 sm:p-7 shadow-2xl border border-slate-200 text-slate-900 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header with Format Badge */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-indigo-950 flex items-center justify-center font-black shadow-md shrink-0">
              <Trophy className="w-6 h-6 text-indigo-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  {isCombinedFormat ? (
                    <>
                      <Swords className="w-3 h-3 text-amber-700" />
                      <span>Combined Format: Pool Play + Bracket</span>
                    </>
                  ) : (
                    <span>Round Robin Completed</span>
                  )}
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  {rounds.length} Pool Rounds • {config.sport}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                {isBracketFinished
                  ? '🏆 Tournament Champions Crowned!'
                  : isCombinedFormat
                  ? 'Pool Play Complete — Advancing to Bracket!'
                  : 'Tournament Pool Play Complete! 🎉'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs for Continuous Tournament Flow */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-2xl overflow-x-auto shadow-2xs">
          <button
            type="button"
            id="modal-tab-pool-standings"
            onClick={() => setActiveTab('pool_standings')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'pool_standings'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Medal className="w-3.5 h-3.5" />
            <span>1. Pool Standings &amp; Qualifiers</span>
          </button>

          <button
            type="button"
            id="modal-tab-playoff-bracket"
            onClick={() => setActiveTab('playoff_bracket')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap relative ${
              activeTab === 'playoff_bracket'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>2. Playoff Bracket</span>
            {bracket && !isBracketFinished && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
            {isBracketFinished && (
              <Check className="w-3 h-3 text-emerald-400" />
            )}
          </button>

          <button
            type="button"
            id="modal-tab-champion-recap"
            onClick={() => setActiveTab('champion_recap')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'champion_recap'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>3. Podium &amp; Recap</span>
          </button>
        </div>

        {/* TAB 1: POOL STANDINGS & ADVANCING QUALIFIERS */}
        {activeTab === 'pool_standings' && (
          <div className="space-y-4">
            {/* 🏆 PODIUM SECTION FOR POOL PLAY */}
            {standings.length >= 2 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-500" />
                    Pool Play Finishers
                  </span>
                  <span className="text-[11px] font-bold text-indigo-600">
                    {rounds.length} Rounds of Fair Play
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
                  {/* 2nd Place */}
                  {secondPlace && (
                    <div className="order-2 sm:order-1 bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center space-y-1.5 shadow-2xs">
                      <div className="w-7 h-7 mx-auto rounded-full bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center border-2 border-slate-300">
                        🥈 2
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-center gap-1.5">
                          <div
                            className={`w-5 h-5 rounded-full ${secondPlace.avatarColor} text-[10px] font-black flex items-center justify-center shrink-0`}
                          >
                            {secondPlace.playerName.charAt(0)}
                          </div>
                          <h3 className="text-xs font-black text-slate-900 truncate">
                            {secondPlace.playerName}
                          </h3>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                          {secondPlace.won}W - {secondPlace.lost}L • {secondPlace.pointDiff > 0 ? `+${secondPlace.pointDiff}` : secondPlace.pointDiff} diff
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 1st Place (Pool Winner) */}
                  {firstPlace && (
                    <div className="order-1 sm:order-2 bg-gradient-to-b from-amber-50 to-yellow-100/60 border-2 border-amber-400 rounded-2xl p-3.5 text-center space-y-2 shadow-md">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-indigo-950 font-black text-[9px] uppercase tracking-wider">
                        <Sparkles className="w-2.5 h-2.5" /> Pool #1 Seed
                      </div>
                      <div className="w-9 h-9 mx-auto rounded-xl bg-amber-400 text-indigo-950 font-black text-sm flex items-center justify-center border-2 border-amber-300">
                        🥇 1
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-center gap-1.5">
                          <div
                            className={`w-5 h-5 rounded-full ${firstPlace.avatarColor} text-[10px] font-black flex items-center justify-center shrink-0`}
                          >
                            {firstPlace.playerName.charAt(0)}
                          </div>
                          <h3 className="text-sm font-black text-amber-950 truncate">
                            {firstPlace.playerName}
                          </h3>
                        </div>
                        <p className="text-[11px] font-black text-amber-900 mt-0.5">
                          {firstPlace.won}W - {firstPlace.lost}L • {firstPlace.pointDiff > 0 ? `+${firstPlace.pointDiff}` : firstPlace.pointDiff} diff
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {thirdPlace && (
                    <div className="order-3 bg-amber-50/40 border border-amber-200/70 rounded-2xl p-3 text-center space-y-1.5 shadow-2xs">
                      <div className="w-7 h-7 mx-auto rounded-full bg-amber-200/80 text-amber-900 font-black text-xs flex items-center justify-center border-2 border-amber-300">
                        🥉 3
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-center gap-1.5">
                          <div
                            className={`w-5 h-5 rounded-full ${thirdPlace.avatarColor} text-[10px] font-black flex items-center justify-center shrink-0`}
                          >
                            {thirdPlace.playerName.charAt(0)}
                          </div>
                          <h3 className="text-xs font-black text-slate-900 truncate">
                            {thirdPlace.playerName}
                          </h3>
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                          {thirdPlace.won}W - {thirdPlace.lost}L • {thirdPlace.pointDiff > 0 ? `+${thirdPlace.pointDiff}` : thirdPlace.pointDiff} diff
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ⚡ ADVANCING TO PLAYOFF BRACKET CARD */}
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-400 text-indigo-950 flex items-center justify-center font-black shadow-xs">
                    <Swords className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white">
                      Advancing to Single-Elimination Bracket
                    </h3>
                    <p className="text-xs text-indigo-200">
                      Top {selectedPlayerIdsForBracket.length} Qualifiers Seeded by Pool Standings
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  id="btn-adjust-qualifiers-toggle"
                  onClick={() => setIsAdjustingQualifiers(!isAdjustingQualifiers)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-indigo-100 transition-colors cursor-pointer border border-white/10 flex items-center gap-1.5"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isAdjustingQualifiers ? 'Done Adjusting' : 'Adjust Seeds / Ties'}</span>
                </button>
              </div>

              {/* Qualifiers Seed List */}
              <div className="bg-white/10 border border-white/10 rounded-xl p-3 divide-y divide-white/10 max-h-56 overflow-y-auto text-xs space-y-1">
                {selectedPlayerIdsForBracket.map((id, seedIdx) => {
                  const player = playersMap.map.get(id);
                  const poolRow = standings.find((s) => s.playerId === id);
                  if (!player) return null;

                  return (
                    <div
                      key={`qualifier-${id}`}
                      className="flex items-center justify-between py-1.5 first:pt-0 last:pb-0 gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-amber-400 text-indigo-950 font-black text-xs flex items-center justify-center shrink-0">
                          #{seedIdx + 1}
                        </span>
                        <div
                          className={`w-6 h-6 rounded-full ${player.avatarColor || 'bg-slate-700'} text-[10px] font-black flex items-center justify-center text-white shrink-0`}
                        >
                          {player.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-white truncate block">
                            {player.name}
                          </span>
                          <span className="text-[10px] text-indigo-200 block">
                            Pool Rank #{poolRow ? standings.indexOf(poolRow) + 1 : '—'} •{' '}
                            {poolRow ? `${poolRow.won}W-${poolRow.lost}L (${poolRow.pointDiff > 0 ? `+${poolRow.pointDiff}` : poolRow.pointDiff})` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Organizer Seed Adjustment Controls */}
                      {isAdjustingQualifiers && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={seedIdx === 0}
                            onClick={() => handleMoveQualifier(seedIdx, 'up')}
                            className="p-1 rounded bg-white/20 hover:bg-white/30 disabled:opacity-30 cursor-pointer"
                            title="Move Seed Up"
                          >
                            <ChevronUp className="w-3.5 h-3.5 text-white" />
                          </button>
                          <button
                            type="button"
                            disabled={seedIdx === selectedPlayerIdsForBracket.length - 1}
                            onClick={() => handleMoveQualifier(seedIdx, 'down')}
                            className="p-1 rounded bg-white/20 hover:bg-white/30 disabled:opacity-30 cursor-pointer"
                            title="Move Seed Down"
                          >
                            <ChevronDown className="w-3.5 h-3.5 text-white" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action: Generate Bracket */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[11px] text-indigo-200 font-medium">
                  {config.format === 'doubles'
                    ? 'Pairs formed based on seeds with automatic byes if needed.'
                    : '1v1 matches seeded (1 vs 4, 2 vs 3, etc.).'}
                </span>

                <button
                  type="button"
                  id="btn-modal-generate-bracket"
                  onClick={handleGenerateBracket}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-indigo-950 font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <Swords className="w-4 h-4" />
                  <span>
                    {bracket ? 'Regenerate Bracket' : `Launch Playoff Bracket (Top ${selectedPlayerIdsForBracket.length})`}
                  </span>
                </button>
              </div>
            </div>

            {/* Standings Table Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Full Pool Standings ({standings.length} Players)
                </span>
                {onViewStandingsTab && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onViewStandingsTab();
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Standings Tab</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white text-xs">
                {standings.map((row, idx) => {
                  const isAdvancing = selectedPlayerIdsForBracket.includes(row.playerId);
                  return (
                    <div
                      key={row.playerId}
                      className={`flex items-center justify-between px-3 py-2 ${
                        isAdvancing ? 'bg-indigo-50/50 font-semibold' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-slate-500 w-5 text-center">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full ${row.avatarColor} text-[10px] font-black flex items-center justify-center shrink-0`}
                        >
                          {row.playerName.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-900 truncate">
                          {row.playerName}
                        </span>
                        {isAdvancing && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-indigo-100 text-indigo-800">
                            Advances
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 font-semibold text-slate-600 shrink-0">
                        <span>
                          <strong className="text-slate-900">{row.won}W</strong> - {row.lost}L
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff} diff
                        </span>
                        <span className="font-bold text-indigo-600 w-10 text-right">
                          {row.winRate}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PLAYOFF BRACKET (INTERACTIVE TREE & SCORE ENTRY) */}
        {activeTab === 'playoff_bracket' && (
          <div className="space-y-4">
            {!bracket ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                  <Swords className="w-6 h-6" />
                </div>
                <h3 className="font-black text-slate-900 text-base">No Playoff Bracket Generated Yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Click below to generate the single-elimination playoff bracket seeded from the pool play standings.
                </p>
                <button
                  type="button"
                  id="btn-tab2-start-bracket"
                  onClick={handleGenerateBracket}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md inline-flex items-center gap-2"
                >
                  <Swords className="w-4 h-4" />
                  <span>Seed &amp; Start Bracket</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Progress & Quick Controls Bar */}
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-400 text-indigo-950 flex items-center justify-center font-black">
                      <Swords className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">
                        {bracketProgress?.isComplete
                          ? '🎉 Playoff Complete!'
                          : `${bracketProgress?.completedMatches} of ${bracketProgress?.totalMatches} Matches Completed`}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-500">
                        {bracketProgress?.percentage}% Playoff Progress
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {onOpenBracket && (
                      <button
                        type="button"
                        id="btn-modal-open-full-bracket"
                        onClick={() => {
                          onClose();
                          onOpenBracket();
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Open Full Screen Bracket Canvas"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Full Canvas</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Champion Banner if Crowned */}
                {isBracketFinished && bracketChampionNames && (
                  <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-indigo-950 p-4 rounded-2xl shadow-md flex items-center justify-between animate-in zoom-in-95">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-950 text-yellow-300 flex items-center justify-center text-lg shadow-xs">
                        👑
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 block">
                          Playoff Bracket Champion
                        </span>
                        <h4 className="text-base font-black text-indigo-950">
                          {bracketChampionNames}
                        </h4>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('champion_recap')}
                      className="px-3 py-1.5 rounded-xl bg-indigo-950 text-yellow-300 font-black text-xs uppercase tracking-wider cursor-pointer hover:bg-black transition-colors"
                    >
                      View Podium ➔
                    </button>
                  </div>
                )}

                {/* Interactive Bracket Rounds List */}
                <div className="space-y-3 max-h-96 overflow-y-auto p-1">
                  {bracketRoundsData().map((roundGroup) => (
                    <div key={`modal-b-round-${roundGroup.round}`} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                          {roundGroup.name}
                        </span>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {roundGroup.matches.map((m) => {
                          const isBye = m.slotA?.isBye || m.slotB?.isBye;
                          const isCompleted = m.winnerSlot !== undefined;
                          const nameA = getSlotNames(m.slotA);
                          const nameB = getSlotNames(m.slotB);

                          return (
                            <div
                              key={`modal-match-${m.id}`}
                              className={`p-3 rounded-2xl border transition-all ${
                                isCompleted
                                  ? 'bg-slate-50/80 border-slate-200'
                                  : !m.slotA || !m.slotB || isBye
                                  ? 'bg-slate-50/40 border-slate-200 opacity-70'
                                  : 'bg-white border-amber-300 ring-2 ring-amber-400/20 shadow-xs'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1.5">
                                <span>Match {m.position}</span>
                                {isCompleted && (
                                  <span className="text-emerald-600 flex items-center gap-0.5">
                                    <Check className="w-3 h-3" /> Final
                                  </span>
                                )}
                              </div>

                              {/* Slot A */}
                              <div
                                className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold mb-1 ${
                                  m.winnerSlot === 'A'
                                    ? 'bg-amber-100/80 text-amber-950 font-black'
                                    : 'bg-slate-100/70 text-slate-800'
                                }`}
                              >
                                <span className="truncate">{nameA}</span>
                                <span className="font-black text-sm ml-2">
                                  {m.score1 !== undefined ? m.score1 : '—'}
                                </span>
                              </div>

                              {/* Slot B */}
                              <div
                                className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold mb-2 ${
                                  m.winnerSlot === 'B'
                                    ? 'bg-amber-100/80 text-amber-950 font-black'
                                    : 'bg-slate-100/70 text-slate-800'
                                }`}
                              >
                                <span className="truncate">{nameB}</span>
                                <span className="font-black text-sm ml-2">
                                  {m.score2 !== undefined ? m.score2 : '—'}
                                </span>
                              </div>

                              {/* Action Button */}
                              {!isBye && m.slotA && m.slotB && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenInlineScore(m)}
                                  className={`w-full py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                                    isCompleted
                                      ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                                  }`}
                                >
                                  <span>{isCompleted ? 'Edit Score' : 'Enter Score'}</span>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CHAMPION & PODIUM RECAP */}
        {activeTab === 'champion_recap' && (
          <div className="space-y-4">
            {/* Grand Champion Highlight */}
            <div className="bg-gradient-to-b from-amber-100 via-amber-50 to-white border-2 border-amber-400 rounded-3xl p-6 text-center space-y-3 shadow-lg">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-amber-400 text-indigo-950 flex items-center justify-center text-2xl shadow-md border-2 border-amber-300">
                👑
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-3 py-1 rounded-full">
                  {isBracketFinished
                    ? 'Playoff Tournament Champion'
                    : 'Pool Play Tournament Leader'}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                  {isBracketFinished && bracketChampionNames
                    ? bracketChampionNames
                    : firstPlace?.playerName}
                </h3>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  {config.sessionName} • {config.sport.toUpperCase()}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-md mx-auto pt-2 text-left">
                <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Pool Winner
                  </span>
                  <span className="text-xs font-black text-slate-900 truncate block">
                    🥇 {firstPlace?.playerName}
                  </span>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Total Matches
                  </span>
                  <span className="text-xs font-black text-slate-900 block">
                    {totalCompletedMatches + (bracketProgress?.completedMatches || 0)} Matches
                  </span>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Total Points
                  </span>
                  <span className="text-xs font-black text-slate-900 block">
                    {totalPoints} Pts Scored
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-slate-700">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Equal Match Rotation Guarantee
                </span>
                <span className="text-emerald-700">{coverage.coveragePercentage}% Fair Coverage</span>
              </div>
              <p className="text-[11px] font-medium text-slate-500">
                All {players.filter((p) => p.active).length} squad members rotated through balanced partner pairings and court assignments.
              </p>
            </div>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            id="btn-modal-share-results"
            onClick={handleCopy}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-300 hover:bg-slate-100 font-bold text-xs text-slate-700 transition-colors cursor-pointer shrink-0"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            <span>{copied ? 'Results Copied!' : 'Share Complete Recap'}</span>
          </button>

          <div className="w-full sm:w-auto flex items-center justify-end gap-2 flex-wrap">
            {onExitTournamentMode && (
              <button
                type="button"
                id="btn-exit-tournament-casual"
                onClick={() => {
                  onExitTournamentMode();
                  onClose();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-950 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer border border-indigo-200 shrink-0"
                title="Continue playing casually in open-ended mode"
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-700" />
                <span>Casual Open Play</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-sm shrink-0"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Inline Score Entry Sub-Dialog */}
      {activeScoreMatch && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-200 text-slate-900 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-900">Record Match Score</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveScoreMatch(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 truncate">
                    {getSlotNames(activeScoreMatch.slotA)}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={score1}
                    onChange={(e) => setScore1(parseInt(e.target.value, 10) || 0)}
                    className="w-16 px-2 py-1.5 text-center font-black text-base rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 truncate">
                    {getSlotNames(activeScoreMatch.slotB)}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={score2}
                    onChange={(e) => setScore2(parseInt(e.target.value, 10) || 0)}
                    className="w-16 px-2 py-1.5 text-center font-black text-base rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              {scoreError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                  {scoreError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveScoreMatch(null)}
                className="px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmInlineScore}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-sm cursor-pointer"
              >
                Save Score
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
