import React, { useState, useMemo, useEffect } from 'react';
import {
  Bracket,
  BracketMatch,
  BracketSlot,
  GroupDoubleBracketTournament,
  Player,
  SessionConfig,
  StandingsRow,
} from '../types';
import {
  seedEntrants,
  generateBracket,
  recordBracketResult,
  getBracketRoundName,
  getBracketProgress,
  SeedingMethod,
  DoublesPairingMethod,
} from '../utils/bracket';
import {
  Trophy,
  Swords,
  Users,
  RotateCcw,
  Sparkles,
  Share2,
  Check,
  Plus,
  Play,
  CheckCircle2,
  X,
  AlertCircle,
  Award,
  ChevronRight,
  Shield,
  Layers,
  ArrowRight,
  Flame,
  Crown,
  Zap,
  Columns,
  Maximize2,
  HelpCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundFx } from '../utils/audio';

interface BracketViewProps {
  bracket: Bracket | null;
  doubleTournament?: GroupDoubleBracketTournament | null;
  players: Player[];
  standings: StandingsRow[];
  config: SessionConfig;
  onStartBracket: (
    method: SeedingMethod,
    format: 'singles' | 'doubles',
    doublesPairingMethod: DoublesPairingMethod,
    selectedPlayerIds?: string[]
  ) => void;
  onRecordResult: (matchId: string, score1: number, score2: number) => void;
  onRecordDoubleBracketResult?: (
    bracketType: 'winners' | 'losers',
    matchId: string,
    score1: number,
    score2: number
  ) => void;
  onRecordGrandFinalResult?: (
    matchType: 'match1' | 'resetMatch',
    score1: number,
    score2: number
  ) => void;
  onResetBracket: () => void;
  onResetDoubleTournament?: () => void;
}

export const BracketView: React.FC<BracketViewProps> = ({
  bracket,
  doubleTournament,
  players,
  standings,
  config,
  onStartBracket,
  onRecordResult,
  onRecordDoubleBracketResult,
  onRecordGrandFinalResult,
  onResetBracket,
  onResetDoubleTournament,
}) => {
  // Navigation & View state for Double Tournament
  const [activeDoubleTab, setActiveDoubleTab] = useState<'winners' | 'losers' | 'finals' | 'side_by_side'>('winners');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [activeScoreMatch, setActiveScoreMatch] = useState<{
    match: BracketMatch;
    bracketType?: 'winners' | 'losers' | 'single';
  } | null>(null);
  const [activeGrandFinalModal, setActiveGrandFinalModal] = useState<'match1' | 'resetMatch' | null>(null);

  const [score1, setScore1] = useState<number>(0);
  const [score2, setScore2] = useState<number>(0);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Player Map for fast ID lookup
  const playersMap = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [players]);

  // Overall Champion detection
  const grandChampionIds = useMemo(() => {
    if (doubleTournament?.grandFinal?.championId) {
      return doubleTournament.grandFinal.championId.split(',').map((s) => s.trim());
    }
    if (bracket?.championPlayerIds && bracket.championPlayerIds.length > 0) {
      return bracket.championPlayerIds;
    }
    return null;
  }, [doubleTournament, bracket]);

  // Confetti trigger when champion is crowned
  useEffect(() => {
    if (grandChampionIds && grandChampionIds.length > 0) {
      try {
        confetti({
          particleCount: 90,
          spread: 85,
          origin: { y: 0.5 },
          colors: ['#f59e0b', '#6366f1', '#10b981', '#ec4899', '#fbbf24'],
        });
      } catch {}
    }
  }, [grandChampionIds]);

  // Format slot player names helper
  const getSlotEntrantNames = (slot: BracketSlot | null): string => {
    if (!slot) return 'Waiting for previous round...';
    if (slot.isBye) return 'BYE';
    if (!slot.playerIds || slot.playerIds.length === 0) return 'TBD';

    return slot.playerIds
      .map((id) => playersMap.get(id)?.name || 'Unknown')
      .join(' & ');
  };

  const getSlotPlayerAvatars = (slot: BracketSlot | null) => {
    if (!slot || slot.isBye || !slot.playerIds) return [];
    return slot.playerIds.map((id) => playersMap.get(id)).filter(Boolean) as Player[];
  };

  // Open Score Entry for regular / double bracket match
  const handleOpenScoreEntry = (match: BracketMatch, bracketType: 'winners' | 'losers' | 'single') => {
    if (!match.slotA || !match.slotB) return;
    if (match.slotA.isBye || match.slotB.isBye) return;

    setActiveScoreMatch({ match, bracketType });
    setScore1(match.score1 ?? config.targetPoints ?? 21);
    setScore2(match.score2 ?? Math.max(0, (config.targetPoints ?? 21) - 3));
    setScoreError(null);
  };

  const handleConfirmScore = () => {
    if (!activeScoreMatch) return;
    if (score1 === score2) {
      setScoreError('Single-elimination matches cannot end in a tie.');
      return;
    }
    if (score1 < 0 || score2 < 0) {
      setScoreError('Scores cannot be negative.');
      return;
    }

    soundFx.playWhistle();

    if (activeScoreMatch.bracketType === 'winners' || activeScoreMatch.bracketType === 'losers') {
      if (onRecordDoubleBracketResult) {
        onRecordDoubleBracketResult(activeScoreMatch.bracketType, activeScoreMatch.match.id, score1, score2);
      }
    } else {
      onRecordResult(activeScoreMatch.match.id, score1, score2);
    }

    setActiveScoreMatch(null);
    setScoreError(null);
  };

  // Open Score Entry for Grand Final
  const handleOpenGrandFinalScore = (matchType: 'match1' | 'resetMatch') => {
    setActiveGrandFinalModal(matchType);
    const existing =
      matchType === 'match1'
        ? doubleTournament?.grandFinal?.match1
        : doubleTournament?.grandFinal?.resetMatch;

    setScore1(existing?.score1 ?? config.targetPoints ?? 21);
    setScore2(existing?.score2 ?? Math.max(0, (config.targetPoints ?? 21) - 3));
    setScoreError(null);
  };

  const handleConfirmGrandFinalScore = () => {
    if (!activeGrandFinalModal || !onRecordGrandFinalResult) return;
    if (score1 === score2) {
      setScoreError('Grand Final matches cannot end in a tie.');
      return;
    }
    if (score1 < 0 || score2 < 0) {
      setScoreError('Scores cannot be negative.');
      return;
    }

    soundFx.playVictoryFanfare();
    onRecordGrandFinalResult(activeGrandFinalModal, score1, score2);
    setActiveGrandFinalModal(null);
    setScoreError(null);
  };

  // Format shareable summary
  const handleShareTournament = () => {
    const lines: string[] = [];

    if (doubleTournament) {
      lines.push(`🏆 *${config.sessionName.toUpperCase()} — DUAL PLAYOFF BRACKETS*`);
      lines.push(`Format: Group Stage ➔ Winners & Losers Bracket ➔ Grand Finals`);
      lines.push(`Finals Format: ${doubleTournament.finalsFormat === 'true_double_elim' ? 'True Double-Elimination' : 'Single Final'}`);
      lines.push('');

      if (grandChampionIds) {
        const champNames = grandChampionIds
          .map((id) => playersMap.get(id)?.name || 'Champion')
          .join(' & ');
        lines.push(`👑 *GRAND TOURNAMENT CHAMPION: ${champNames}* 🏆`);
        lines.push('');
      }

      // Winners Bracket
      lines.push(`*🥇 WINNERS BRACKET (Group 1st Place Qualifiers):*`);
      if (doubleTournament.winnersBracket.championPlayerIds) {
        const wbChamp = doubleTournament.winnersBracket.championPlayerIds
          .map((id) => playersMap.get(id)?.name || 'Champ')
          .join(' & ');
        lines.push(`Winner: ${wbChamp}`);
      }
      doubleTournament.winnersBracket.matches.forEach((m) => {
        const nameA = getSlotEntrantNames(m.slotA);
        const nameB = getSlotEntrantNames(m.slotB);
        if (m.winnerSlot) {
          const sc = m.score1 !== undefined ? `(${m.score1}-${m.score2})` : '';
          const w = m.winnerSlot === 'A' ? nameA : nameB;
          lines.push(`  ✓ ${nameA} vs ${nameB} ➔ ${w} ${sc}`);
        }
      });
      lines.push('');

      // Losers Bracket
      lines.push(`*🥈 LOSERS BRACKET (Group 2nd Place Qualifiers):*`);
      if (doubleTournament.losersBracket.championPlayerIds) {
        const lbChamp = doubleTournament.losersBracket.championPlayerIds
          .map((id) => playersMap.get(id)?.name || 'Champ')
          .join(' & ');
        lines.push(`Winner: ${lbChamp}`);
      }
      doubleTournament.losersBracket.matches.forEach((m) => {
        const nameA = getSlotEntrantNames(m.slotA);
        const nameB = getSlotEntrantNames(m.slotB);
        if (m.winnerSlot) {
          const sc = m.score1 !== undefined ? `(${m.score1}-${m.score2})` : '';
          const w = m.winnerSlot === 'A' ? nameA : nameB;
          lines.push(`  ✓ ${nameA} vs ${nameB} ➔ ${w} ${sc}`);
        }
      });
      lines.push('');

      // Grand Final
      if (doubleTournament.grandFinal?.match1) {
        lines.push(`*👑 GRAND FINALS:*`);
        const m1 = doubleTournament.grandFinal.match1;
        lines.push(`  Match 1: Winners Champ vs Losers Champ ➔ Score: ${m1.score1}-${m1.score2} (${m1.winner === 'winners' ? 'Winners Champ Won' : 'Losers Champ Won'})`);
        if (doubleTournament.grandFinal.resetMatch) {
          const rm = doubleTournament.grandFinal.resetMatch;
          lines.push(`  Bracket Reset Match ➔ Score: ${rm.score1}-${rm.score2} (${rm.winner === 'winners' ? 'Winners Champ Won' : 'Losers Champ Won'})`);
        }
      }
    } else if (bracket) {
      lines.push(`🏆 *${config.sessionName.toUpperCase()} — PLAYOFF BRACKET*`);
      lines.push(`Format: ${bracket.size}-Entrant Single Elimination`);
      if (bracket.championPlayerIds) {
        const champNames = bracket.championPlayerIds
          .map((id) => playersMap.get(id)?.name || 'Champion')
          .join(' & ');
        lines.push(`🥇 *CHAMPION: ${champNames}* 🏆`);
      }
      lines.push('');
      bracket.matches.forEach((m) => {
        const nameA = getSlotEntrantNames(m.slotA);
        const nameB = getSlotEntrantNames(m.slotB);
        if (m.winnerSlot) {
          const sc = m.score1 !== undefined ? `(${m.score1}-${m.score2})` : '';
          const w = m.winnerSlot === 'A' ? nameA : nameB;
          lines.push(`✓ ${nameA} vs ${nameB} ➔ ${w} ${sc}`);
        }
      });
    }

    lines.push('');
    lines.push('Generated with FairPlay Tournament & Bracket Engine');

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedShare(true);
    soundFx.playPointChime();
    setTimeout(() => setCopiedShare(false), 2500);

    try {
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.8 } });
    } catch {}
  };

  /* ----------------------------------------------------------------------- */
  /* EMPTY STATE                                                             */
  /* ----------------------------------------------------------------------- */
  if (!doubleTournament && (!bracket || !bracket.matches || bracket.matches.length === 0)) {
    return (
      <div id="bracket-empty-state" className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-6 bg-yellow-400 rounded-full"></span>
              <Swords className="w-5 h-5 text-indigo-600" />
              <h2 className="text-xl font-black text-indigo-950">Playoff Bracket</h2>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Single-elimination playoff tree or dual group-stage tournament brackets
            </p>
          </div>
          <button
            type="button"
            id="btn-create-bracket-top"
            onClick={() => setShowSetupModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Start Playoff Bracket
          </button>
        </div>

        {/* Empty State Banner */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
            <Trophy className="w-8 h-8 stroke-[2]" />
          </div>
          <h3 className="text-lg sm:text-xl font-black text-indigo-950">
            No Active Playoff Bracket
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed font-medium">
            Seed players based on pool play standings, verified player ratings, or a random draw. If you ran a Group Stage, finalize it to generate dual Winners &amp; Losers brackets automatically!
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto text-left pt-2">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <Award className="w-4 h-4 text-yellow-500 mb-1" />
              <div className="text-xs font-black text-slate-800">Standings Seeding</div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Top seeds rewarded based on session match wins and point differential.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <Shield className="w-4 h-4 text-indigo-600 mb-1" />
              <div className="text-xs font-black text-slate-800">DUPR Rating</div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Ranked by verified DUPR ratings for fair skill-tiered playoffs.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <Sparkles className="w-4 h-4 text-emerald-600 mb-1" />
              <div className="text-xs font-black text-slate-800">Dual Playoff Paths</div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Run simultaneous Winners &amp; Losers brackets leading to the Grand Final.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              id="btn-create-first-bracket"
              onClick={() => setShowSetupModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-wider shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" /> Create Tournament Bracket
            </button>
          </div>
        </div>

        {showSetupModal && (
          <BracketSetupModal
            players={players}
            standings={standings}
            config={config}
            onClose={() => setShowSetupModal(false)}
            onConfirm={(method, format, pairingMethod, selectedIds) => {
              onStartBracket(method, format, pairingMethod, selectedIds);
              setShowSetupModal(false);
            }}
          />
        )}
      </div>
    );
  }

  /* ----------------------------------------------------------------------- */
  /* DUAL BRACKET TOURNAMENT (GROUPS -> WINNERS & LOSERS) VIEW               */
  /* ----------------------------------------------------------------------- */
  if (doubleTournament) {
    const wbProgress = getBracketProgress(doubleTournament.winnersBracket);
    const lbProgress = getBracketProgress(doubleTournament.losersBracket);
    const wbChamp = doubleTournament.winnersBracket.championPlayerIds;
    const lbChamp = doubleTournament.losersBracket.championPlayerIds;
    const isBothBracketsDone = Boolean(wbChamp && wbChamp.length > 0 && lbChamp && lbChamp.length > 0);
    const grandFinal = doubleTournament.grandFinal;
    const isResetTriggered =
      doubleTournament.finalsFormat === 'true_double_elim' &&
      grandFinal?.match1?.winner === 'losers';

    const wbChampNames = wbChamp
      ? wbChamp.map((id) => playersMap.get(id)?.name || 'Champion').join(' & ')
      : 'TBD (Winners Bracket Finalist)';
    const lbChampNames = lbChamp
      ? lbChamp.map((id) => playersMap.get(id)?.name || 'Champion').join(' & ')
      : 'TBD (Losers Bracket Finalist)';

    return (
      <div id="double-bracket-view" className="space-y-6 animate-in fade-in duration-300">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-6 bg-gradient-to-b from-amber-500 to-indigo-600 rounded-full"></span>
              <Trophy className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg sm:text-xl font-black text-indigo-950">
                Groups ➔ Dual Playoff Brackets
              </h2>
              {grandChampionIds ? (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] uppercase">
                  🏆 Grand Final Completed
                </span>
              ) : isBothBracketsDone ? (
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-300 font-black text-[10px] uppercase animate-pulse">
                  ⚔️ Grand Finals Live
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-[10px] uppercase">
                  Dual Brackets In Progress
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              1st place seeds compete in Winners Bracket • 2nd place seeds compete in Losers Bracket • Finalists clash in Grand Finals
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
            <button
              type="button"
              id="btn-double-bracket-share"
              onClick={handleShareTournament}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer border border-slate-200"
            >
              {copiedShare ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" /> Copied!
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-indigo-600" /> Share Summary
                </>
              )}
            </button>

            {onResetDoubleTournament && (
              <button
                type="button"
                id="btn-double-bracket-reset"
                onClick={() => setShowResetConfirm(true)}
                className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Reset Double Tournament Brackets"
                aria-label="Reset Double Tournament Brackets"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Grand Champion Coronation Banner (if crowned) */}
        {grandChampionIds && grandChampionIds.length > 0 && (
          <div
            id="grand-champion-banner"
            className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 p-5 sm:p-6 text-indigo-950 shadow-xl border-2 border-yellow-300 animate-in zoom-in-95 duration-500"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-indigo-950 text-yellow-400 flex items-center justify-center shadow-lg shrink-0">
                  <Crown className="w-8 h-8 stroke-[2.5]" />
                </div>
                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 text-yellow-300 font-black text-[10px] uppercase tracking-wider">
                      Overall Tournament Champion
                    </span>
                    <span className="text-xs font-bold text-indigo-900 opacity-80">
                      Grand Final Winner
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-indigo-950 tracking-tight mt-1">
                    👑 {grandChampionIds.map((id) => playersMap.get(id)?.name || 'Champion').join(' & ')}
                  </h2>
                  <p className="text-xs font-bold text-indigo-900/90 mt-0.5">
                    Triumphant in the {config.sessionName} Grand Finals!
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleShareTournament}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-950 hover:bg-indigo-900 text-yellow-300 font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <Share2 className="w-4 h-4" /> Share Victory
              </button>
            </div>
            <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-yellow-200/50 rounded-full blur-xl pointer-events-none" />
          </div>
        )}

        {/* Grand Final Arena Match Section */}
        <div
          id="grand-finals-arena-card"
          className={`rounded-3xl border p-5 sm:p-6 transition-all ${
            isBothBracketsDone
              ? 'bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white border-indigo-700 shadow-xl'
              : 'bg-white text-slate-900 border-slate-200 shadow-xs'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-indigo-800/40">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-indigo-950 flex items-center justify-center font-black shadow-md">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black uppercase tracking-wider">
                    Grand Finals Championship Arena
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      doubleTournament.finalsFormat === 'true_double_elim'
                        ? 'bg-indigo-700/60 text-indigo-200 border border-indigo-500/50'
                        : 'bg-slate-700/60 text-slate-200 border border-slate-500/50'
                    }`}
                  >
                    {doubleTournament.finalsFormat === 'true_double_elim'
                      ? 'True Double-Elimination'
                      : 'Single Final'}
                  </span>
                </div>
                <p className={`text-xs font-medium ${isBothBracketsDone ? 'text-indigo-200' : 'text-slate-500'}`}>
                  Winners Bracket Champion vs Losers Bracket Champion
                </p>
              </div>
            </div>

            {/* Quick Status / Reset Status */}
            {isResetTriggered && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500 text-indigo-950 font-black text-xs uppercase tracking-wider shadow-md animate-pulse">
                <Flame className="w-4 h-4" /> Reset Match Triggered!
              </span>
            )}
          </div>

          {/* Visible Format Rule Callout Box */}
          <div
            className={`mt-4 p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 transition-all ${
              isBothBracketsDone
                ? 'bg-indigo-900/50 border-indigo-700/60 text-indigo-100'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-amber-300 block">
                {doubleTournament.finalsFormat === 'true_double_elim'
                  ? 'True Double Elimination Finals Rule'
                  : 'Single Championship Final Rule'}
              </span>
              <p className="text-[11px] leading-relaxed">
                {doubleTournament.finalsFormat === 'true_double_elim'
                  ? 'The Winners Bracket champion has never lost a bracket match. If the Losers Bracket finalist wins this match, a deciding Bracket Reset match will follow.'
                  : 'Single final match — whoever wins Match 1 is immediately crowned overall tournament Champion.'}
              </p>
            </div>
          </div>

          {/* Clash Match Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            {/* Match 1 Card */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                isBothBracketsDone
                  ? 'bg-indigo-900/40 border-indigo-700/60 text-white'
                  : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider mb-3">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Swords className="w-4 h-4" /> Grand Final — Match 1
                </span>
                {grandFinal?.match1 ? (
                  <span className="text-emerald-400 flex items-center gap-1 text-[10px]">
                    <Check className="w-3.5 h-3.5" /> Completed
                  </span>
                ) : isBothBracketsDone ? (
                  <span className="text-amber-300 text-[10px] animate-pulse">
                    Ready to Score
                  </span>
                ) : (
                  <span className="text-slate-400 text-[10px]">Awaiting Finalists</span>
                )}
              </div>

              {/* Team 1: Winners Champion */}
              <div
                className={`p-3 rounded-xl flex items-center justify-between mb-2 ${
                  grandFinal?.match1?.winner === 'winners'
                    ? 'bg-amber-400 text-indigo-950 font-black shadow-md'
                    : isBothBracketsDone
                    ? 'bg-indigo-800/60 text-white font-bold'
                    : 'bg-white border border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 text-[10px] font-black shrink-0">
                    🥇 WB
                  </span>
                  <span className="truncate">{wbChampNames}</span>
                </div>
                <span className="font-black text-sm w-6 text-center shrink-0">
                  {grandFinal?.match1?.score1 ?? '-'}
                </span>
              </div>

              {/* Team 2: Losers Champion */}
              <div
                className={`p-3 rounded-xl flex items-center justify-between mb-3 ${
                  grandFinal?.match1?.winner === 'losers'
                    ? 'bg-amber-400 text-indigo-950 font-black shadow-md'
                    : isBothBracketsDone
                    ? 'bg-indigo-800/60 text-white font-bold'
                    : 'bg-white border border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-700 text-[10px] font-black shrink-0">
                    🥈 LB
                  </span>
                  <span className="truncate">{lbChampNames}</span>
                </div>
                <span className="font-black text-sm w-6 text-center shrink-0">
                  {grandFinal?.match1?.score2 ?? '-'}
                </span>
              </div>

              {/* Action Button */}
              {isBothBracketsDone && onRecordGrandFinalResult && (
                <button
                  type="button"
                  id="btn-score-grand-final-m1"
                  onClick={() => handleOpenGrandFinalScore('match1')}
                  className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    grandFinal?.match1
                      ? 'bg-indigo-800 hover:bg-indigo-700 text-indigo-200'
                      : 'bg-amber-400 hover:bg-amber-300 text-indigo-950 shadow-md active:scale-95'
                  }`}
                >
                  {grandFinal?.match1 ? (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" /> Edit Match 1 Score
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" /> Enter Match 1 Score
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Match 2 / Reset Match Card (for True Double-Elimination) */}
            <div
              className={`p-4 rounded-2xl border transition-all ${
                isResetTriggered
                  ? 'bg-amber-950/40 border-amber-500 text-white ring-2 ring-amber-400/30 shadow-lg'
                  : doubleTournament.finalsFormat === 'true_double_elim'
                  ? 'bg-indigo-900/20 border-indigo-800/40 text-slate-400 opacity-60'
                  : 'bg-slate-50 border-slate-200 text-slate-400 opacity-40'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider mb-3">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Flame className="w-4 h-4" /> Reset Match (If Needed)
                </span>
                {grandFinal?.resetMatch ? (
                  <span className="text-emerald-400 flex items-center gap-1 text-[10px]">
                    <Check className="w-3.5 h-3.5" /> Completed
                  </span>
                ) : isResetTriggered ? (
                  <span className="text-amber-300 text-[10px] animate-pulse">
                    Decisive Final
                  </span>
                ) : (
                  <span className="text-[10px]">
                    {doubleTournament.finalsFormat === 'true_double_elim'
                      ? 'Only if LB Champ wins M1'
                      : 'Not Applicable (Single Final)'}
                  </span>
                )}
              </div>

              {/* Team 1 */}
              <div
                className={`p-3 rounded-xl flex items-center justify-between mb-2 ${
                  grandFinal?.resetMatch?.winner === 'winners'
                    ? 'bg-amber-400 text-indigo-950 font-black shadow-md'
                    : isResetTriggered
                    ? 'bg-indigo-800/60 text-white font-bold'
                    : 'bg-white/50 border border-slate-200 text-slate-500'
                }`}
              >
                <span className="truncate">{wbChampNames}</span>
                <span className="font-black text-sm w-6 text-center shrink-0">
                  {grandFinal?.resetMatch?.score1 ?? '-'}
                </span>
              </div>

              {/* Team 2 */}
              <div
                className={`p-3 rounded-xl flex items-center justify-between mb-3 ${
                  grandFinal?.resetMatch?.winner === 'losers'
                    ? 'bg-amber-400 text-indigo-950 font-black shadow-md'
                    : isResetTriggered
                    ? 'bg-indigo-800/60 text-white font-bold'
                    : 'bg-white/50 border border-slate-200 text-slate-500'
                }`}
              >
                <span className="truncate">{lbChampNames}</span>
                <span className="font-black text-sm w-6 text-center shrink-0">
                  {grandFinal?.resetMatch?.score2 ?? '-'}
                </span>
              </div>

              {/* Action Button */}
              {isResetTriggered && onRecordGrandFinalResult && (
                <button
                  type="button"
                  id="btn-score-grand-final-reset"
                  onClick={() => handleOpenGrandFinalScore('resetMatch')}
                  className="w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-amber-400 hover:bg-amber-300 text-indigo-950 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>
                    {grandFinal?.resetMatch ? 'Edit Reset Score' : 'Score Decisive Reset Match'}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Switcher for Brackets */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              id="tab-btn-winners-bracket"
              onClick={() => setActiveDoubleTab('winners')}
              className={`px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activeDoubleTab === 'winners'
                  ? 'bg-amber-500 text-indigo-950 shadow-md ring-2 ring-amber-400/30'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>🥇 Winners Bracket</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeDoubleTab === 'winners' ? 'bg-indigo-950 text-amber-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {wbProgress.completedMatches}/{wbProgress.totalMatches}
              </span>
            </button>

            <button
              type="button"
              id="tab-btn-losers-bracket"
              onClick={() => setActiveDoubleTab('losers')}
              className={`px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activeDoubleTab === 'losers'
                  ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/30'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>🥈 Losers Bracket</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  activeDoubleTab === 'losers' ? 'bg-indigo-950 text-indigo-200' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {lbProgress.completedMatches}/{lbProgress.totalMatches}
              </span>
            </button>

            <button
              type="button"
              id="tab-btn-grand-finals"
              onClick={() => setActiveDoubleTab('finals')}
              className={`px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activeDoubleTab === 'finals'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-indigo-950 shadow-md ring-2 ring-amber-400/30'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Crown className="w-3.5 h-3.5 fill-current" />
              <span>Grand Finals</span>
              {grandChampionIds ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-950 text-yellow-300">
                  🏆 Champion
                </span>
              ) : isBothBracketsDone ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 animate-pulse">
                  Ready
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                  Finals
                </span>
              )}
            </button>

            <button
              type="button"
              id="tab-btn-side-by-side"
              onClick={() => setActiveDoubleTab('side_by_side')}
              className={`hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
                activeDoubleTab === 'side_by_side'
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Side-by-Side</span>
            </button>
          </div>

          <span className="text-xs font-bold text-slate-500">
            Tap any match card to enter scores
          </span>
        </div>

        {/* Bracket Trees Container */}
        {activeDoubleTab === 'finals' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-black">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-indigo-950">
                    Grand Finals Championship Hub
                  </h3>
                  <p className="text-xs font-medium text-slate-500">
                    {doubleTournament.finalsFormat === 'true_double_elim'
                      ? 'True Double Elimination Format • Reset Match if needed'
                      : 'Single Final Format • Sudden Death Championship'}
                  </p>
                </div>
              </div>

              {isBothBracketsDone && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Both Finalists Qualified
                </span>
              )}
            </div>

            {/* Detailed Grand Finals Screen Matchups Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
              {/* Entrants Clash Showcase */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Winners Bracket Finalist */}
                <div className="p-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/80 to-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                      🥇 Winners Bracket Champion
                    </span>
                    <span className="text-[11px] font-bold text-amber-800">
                      Undefeated in Bracket
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-indigo-950 flex items-center justify-center font-black text-base shadow-sm">
                      🥇
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-indigo-950 text-base truncate">
                        {wbChampNames}
                      </h4>
                      <p className="text-xs font-semibold text-slate-500">
                        Group 1st-Place Playoff Winner
                      </p>
                    </div>
                  </div>
                </div>

                {/* Losers Bracket Finalist */}
                <div className="p-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-200 text-indigo-900 text-[10px] font-black uppercase tracking-wider">
                      🥈 Losers Bracket Champion
                    </span>
                    <span className="text-[11px] font-bold text-indigo-800">
                      Losers Bracket Winner
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                      🥈
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-black text-indigo-950 text-base truncate">
                        {lbChampNames}
                      </h4>
                      <p className="text-xs font-semibold text-slate-500">
                        Group 2nd-Place Playoff Winner
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Match Scoring Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Match 1 Card */}
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-3">
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 text-indigo-950">
                      <Swords className="w-4 h-4 text-indigo-600" /> Match 1
                    </span>
                    {grandFinal?.match1 ? (
                      <span className="text-emerald-600 flex items-center gap-1 text-[10px] font-black">
                        <Check className="w-3.5 h-3.5" /> Scored
                      </span>
                    ) : isBothBracketsDone ? (
                      <span className="text-amber-600 text-[10px] font-black animate-pulse">
                        Ready to Score
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">Awaiting Finalists</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div
                      className={`p-3 rounded-xl flex items-center justify-between ${
                        grandFinal?.match1?.winner === 'winners'
                          ? 'bg-amber-100 text-amber-950 font-black border border-amber-300'
                          : 'bg-white border border-slate-200 text-slate-800 font-bold'
                      }`}
                    >
                      <span className="truncate pr-2">🥇 {wbChampNames}</span>
                      <span className="font-mono text-base font-black w-8 text-right">
                        {grandFinal?.match1?.score1 ?? '-'}
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-xl flex items-center justify-between ${
                        grandFinal?.match1?.winner === 'losers'
                          ? 'bg-amber-100 text-amber-950 font-black border border-amber-300'
                          : 'bg-white border border-slate-200 text-slate-800 font-bold'
                      }`}
                    >
                      <span className="truncate pr-2">🥈 {lbChampNames}</span>
                      <span className="font-mono text-base font-black w-8 text-right">
                        {grandFinal?.match1?.score2 ?? '-'}
                      </span>
                    </div>
                  </div>

                  {isBothBracketsDone && onRecordGrandFinalResult && (
                    <button
                      type="button"
                      id="btn-grand-final-m1-tab"
                      onClick={() => handleOpenGrandFinalScore('match1')}
                      className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        grandFinal?.match1
                          ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95'
                      }`}
                    >
                      {grandFinal?.match1 ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" /> Edit Match 1 Score
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" /> Enter Match 1 Score
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Match 2 / Reset Match Card */}
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    isResetTriggered
                      ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/20 shadow-md'
                      : 'bg-slate-50/50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 text-indigo-950">
                      <Flame className="w-4 h-4 text-amber-500" /> Bracket Reset (Match 2)
                    </span>
                    {grandFinal?.resetMatch ? (
                      <span className="text-emerald-600 flex items-center gap-1 text-[10px] font-black">
                        <Check className="w-3.5 h-3.5" /> Decisive Final Won
                      </span>
                    ) : isResetTriggered ? (
                      <span className="text-amber-600 text-[10px] font-black animate-pulse">
                        🔥 Decisive Final Live
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">
                        {doubleTournament.finalsFormat === 'true_double_elim'
                          ? 'Only if LB wins M1'
                          : 'Single Final Only'}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div
                      className={`p-3 rounded-xl flex items-center justify-between ${
                        grandFinal?.resetMatch?.winner === 'winners'
                          ? 'bg-amber-100 text-amber-950 font-black border border-amber-300'
                          : 'bg-white border border-slate-200 text-slate-800 font-bold'
                      }`}
                    >
                      <span className="truncate pr-2">🥇 {wbChampNames}</span>
                      <span className="font-mono text-base font-black w-8 text-right">
                        {grandFinal?.resetMatch?.score1 ?? '-'}
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-xl flex items-center justify-between ${
                        grandFinal?.resetMatch?.winner === 'losers'
                          ? 'bg-amber-100 text-amber-950 font-black border border-amber-300'
                          : 'bg-white border border-slate-200 text-slate-800 font-bold'
                      }`}
                    >
                      <span className="truncate pr-2">🥈 {lbChampNames}</span>
                      <span className="font-mono text-base font-black w-8 text-right">
                        {grandFinal?.resetMatch?.score2 ?? '-'}
                      </span>
                    </div>
                  </div>

                  {isResetTriggered && onRecordGrandFinalResult && (
                    <button
                      type="button"
                      id="btn-grand-final-reset-tab"
                      onClick={() => handleOpenGrandFinalScore('resetMatch')}
                      className="w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-indigo-950 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Flame className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {grandFinal?.resetMatch ? 'Edit Reset Score' : 'Score Decisive Reset Match'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {activeDoubleTab === 'winners' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-800 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Winners Bracket (1st-Place Group Finishers)
              </h3>
              {wbChamp && wbChamp.length > 0 && (
                <span className="text-xs font-black text-amber-700 bg-amber-100 px-3 py-1 rounded-xl border border-amber-300 flex items-center gap-1">
                  🥇 Champion: {wbChampNames}
                </span>
              )}
            </div>

            <SingleBracketTree
              bracket={doubleTournament.winnersBracket}
              playersMap={playersMap}
              themeColor="amber"
              onOpenScoreEntry={(m) => handleOpenScoreEntry(m, 'winners')}
            />
          </div>
        )}

        {activeDoubleTab === 'losers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                Losers Bracket (2nd-Place Group Finishers)
              </h3>
              {lbChamp && lbChamp.length > 0 && (
                <span className="text-xs font-black text-indigo-700 bg-indigo-100 px-3 py-1 rounded-xl border border-indigo-300 flex items-center gap-1">
                  🥈 Champion: {lbChampNames}
                </span>
              )}
            </div>

            <SingleBracketTree
              bracket={doubleTournament.losersBracket}
              playersMap={playersMap}
              themeColor="indigo"
              onOpenScoreEntry={(m) => handleOpenScoreEntry(m, 'losers')}
            />
          </div>
        )}

        {activeDoubleTab === 'side_by_side' && (
          <div className="space-y-8">
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-800 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                Winners Bracket (1st-Place Qualifiers)
              </h3>
              <SingleBracketTree
                bracket={doubleTournament.winnersBracket}
                playersMap={playersMap}
                themeColor="amber"
                onOpenScoreEntry={(m) => handleOpenScoreEntry(m, 'winners')}
              />
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-black uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                Losers Bracket (2nd-Place Qualifiers)
              </h3>
              <SingleBracketTree
                bracket={doubleTournament.losersBracket}
                playersMap={playersMap}
                themeColor="indigo"
                onOpenScoreEntry={(m) => handleOpenScoreEntry(m, 'losers')}
              />
            </div>
          </div>
        )}

        {/* Modals */}
        {activeScoreMatch && (
          <ScoreEntryModal
            match={activeScoreMatch.match}
            playersMap={playersMap}
            score1={score1}
            score2={score2}
            setScore1={setScore1}
            setScore2={setScore2}
            error={scoreError}
            targetPoints={config.targetPoints ?? 21}
            onClose={() => {
              setActiveScoreMatch(null);
              setScoreError(null);
            }}
            onConfirm={handleConfirmScore}
          />
        )}

        {activeGrandFinalModal && (
          <GrandFinalScoreModal
            matchType={activeGrandFinalModal}
            wbChampNames={wbChampNames}
            lbChampNames={lbChampNames}
            score1={score1}
            score2={score2}
            setScore1={setScore1}
            setScore2={setScore2}
            error={scoreError}
            targetPoints={config.targetPoints ?? 21}
            onClose={() => {
              setActiveGrandFinalModal(null);
              setScoreError(null);
            }}
            onConfirm={handleConfirmGrandFinalScore}
          />
        )}

        {showResetConfirm && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Clear Playoff Brackets?</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                This will reset the Winners and Losers Brackets and all playoff scores. Your group stage pools and match records will remain safe.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onResetDoubleTournament) onResetDoubleTournament();
                    setShowResetConfirm(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider cursor-pointer"
                >
                  Clear Brackets
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ----------------------------------------------------------------------- */
  /* SINGLE STANDALONE BRACKET VIEW (Classic)                                */
  /* ----------------------------------------------------------------------- */
  const singleProgress = bracket ? getBracketProgress(bracket) : null;
  const roundsData = useMemo(() => {
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
  }, [bracket]);

  return (
    <div id="bracket-view" className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="w-1.5 h-5 sm:w-2 sm:h-6 bg-yellow-400 rounded-full"></span>
            <Swords className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
            <h2 className="text-base sm:text-xl font-black text-indigo-950">
              Playoff Tournament Bracket
            </h2>
            {bracket?.championPlayerIds ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] uppercase">
                Completed
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-[10px] uppercase">
                In Progress
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5 sm:mt-1">
            {bracket?.size}-Entrant Tree • {roundsData.length} Rounds • Tap any active match to record scores
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
          {singleProgress && (
            <div className="hidden lg:flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
              <span>
                {singleProgress.completedMatches} / {singleProgress.totalMatches} Matches
              </span>
              <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${singleProgress.percentage}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            id="btn-bracket-share"
            onClick={handleShareTournament}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer border border-slate-200"
          >
            {copiedShare ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied!
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-indigo-600" /> <span>Share</span>
              </>
            )}
          </button>

          <button
            type="button"
            id="btn-bracket-reseed"
            onClick={() => setShowSetupModal(true)}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> <span>New / Re-Seed</span>
          </button>

          <button
            type="button"
            id="btn-bracket-reset"
            onClick={() => setShowResetConfirm(true)}
            className="p-1.5 sm:p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            title="Clear active bracket"
            aria-label="Clear active bracket"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Champion Banner */}
      {bracket?.championPlayerIds && bracket.championPlayerIds.length > 0 && (
        <div
          id="bracket-champion-banner"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 p-5 sm:p-6 text-indigo-950 shadow-lg border-2 border-yellow-300 animate-in fade-in zoom-in-95 duration-500"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-indigo-950 text-yellow-400 flex items-center justify-center shadow-md shrink-0">
                <Trophy className="w-8 h-8 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 text-yellow-300 font-black text-[10px] uppercase tracking-wider">
                    Tournament Winner
                  </span>
                  <span className="text-xs font-bold text-indigo-900 opacity-80">
                    Single Elimination Playoff
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-indigo-950 tracking-tight mt-1">
                  🏆 {bracket.championPlayerIds.map((id) => playersMap.get(id)?.name || 'Champion').join(' & ')}
                </h2>
                <p className="text-xs font-bold text-indigo-900/90 mt-0.5">
                  Crowned Champion of the {config.sessionName} Bracket!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleShareTournament}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-950 hover:bg-indigo-900 text-yellow-300 font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4" /> Share Champion
            </button>
          </div>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-yellow-200/50 rounded-full blur-xl pointer-events-none" />
        </div>
      )}

      {/* Bracket Tree Container */}
      {bracket && (
        <SingleBracketTree
          bracket={bracket}
          playersMap={playersMap}
          themeColor="indigo"
          onOpenScoreEntry={(m) => handleOpenScoreEntry(m, 'single')}
        />
      )}

      {/* Modals */}
      {showSetupModal && (
        <BracketSetupModal
          players={players}
          standings={standings}
          config={config}
          onClose={() => setShowSetupModal(false)}
          onConfirm={(method, format, pairingMethod, selectedIds) => {
            onStartBracket(method, format, pairingMethod, selectedIds);
            setShowSetupModal(false);
          }}
        />
      )}

      {activeScoreMatch && (
        <ScoreEntryModal
          match={activeScoreMatch.match}
          playersMap={playersMap}
          score1={score1}
          score2={score2}
          setScore1={setScore1}
          setScore2={setScore2}
          error={scoreError}
          targetPoints={config.targetPoints ?? 21}
          onClose={() => {
            setActiveScoreMatch(null);
            setScoreError(null);
          }}
          onConfirm={handleConfirmScore}
        />
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Clear Active Bracket?</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              This will remove the current bracket and all recorded scores. Your session match rounds and standings will remain intact.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetBracket();
                  setShowResetConfirm(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider cursor-pointer"
              >
                Clear Bracket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* Single Bracket Tree Renderer Component                                    */
/* ------------------------------------------------------------------------- */

interface SingleBracketTreeProps {
  bracket: Bracket;
  playersMap: Map<string, Player>;
  themeColor?: 'amber' | 'indigo' | 'emerald';
  onOpenScoreEntry: (match: BracketMatch) => void;
}

const SingleBracketTree: React.FC<SingleBracketTreeProps> = ({
  bracket,
  playersMap,
  themeColor = 'indigo',
  onOpenScoreEntry,
}) => {
  const roundsData = useMemo(() => {
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
  }, [bracket]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 overflow-x-auto overflow-y-hidden select-none">
      <div className="flex gap-6 sm:gap-10 min-w-max pb-4 items-stretch">
        {roundsData.map((roundGroup, roundIndex) => {
          const isLastRound = roundIndex === roundsData.length - 1;

          return (
            <div
              key={`round-col-${roundGroup.round}`}
              className="flex flex-col w-[260px] sm:w-[290px] shrink-0"
            >
              {/* Round Header */}
              <div className="mb-4 pb-2 border-b-2 border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      themeColor === 'amber'
                        ? 'bg-amber-500'
                        : themeColor === 'emerald'
                        ? 'bg-emerald-500'
                        : 'bg-indigo-600'
                    }`}
                  ></span>
                  <h3 className="text-xs sm:text-sm font-black text-indigo-950 uppercase tracking-wider">
                    {roundGroup.name}
                  </h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {roundGroup.matches.length} {roundGroup.matches.length === 1 ? 'Match' : 'Matches'}
                </span>
              </div>

              {/* Match Cards Column */}
              <div className="flex flex-col justify-around flex-1 gap-4 sm:gap-6">
                {roundGroup.matches.map((match) => (
                  <BracketMatchCard
                    key={match.id}
                    match={match}
                    playersMap={playersMap}
                    isFinalRound={isLastRound}
                    themeColor={themeColor}
                    onOpenScoreEntry={() => onOpenScoreEntry(match)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* Single Bracket Match Card Component                                       */
/* ------------------------------------------------------------------------- */

interface BracketMatchCardProps {
  match: BracketMatch;
  playersMap: Map<string, Player>;
  isFinalRound: boolean;
  themeColor?: 'amber' | 'indigo' | 'emerald';
  onOpenScoreEntry: () => void;
}

const BracketMatchCard: React.FC<BracketMatchCardProps> = ({
  match,
  playersMap,
  isFinalRound,
  themeColor = 'indigo',
  onOpenScoreEntry,
}) => {
  const isCompleted = match.winnerSlot !== undefined;
  const isByeMatch = Boolean(match.slotA?.isBye || match.slotB?.isBye);
  const isWaiting = !match.slotA || !match.slotB;
  const isReadyToPlay = !isByeMatch && !isWaiting && !isCompleted;

  const renderSlotRow = (
    slot: BracketSlot | null,
    slotKey: 'A' | 'B',
    score?: number
  ) => {
    const isWinner = match.winnerSlot === slotKey;
    const isLoser = match.winnerSlot && match.winnerSlot !== slotKey;
    const isBye = Boolean(slot?.isBye);

    let entrantName = 'Waiting...';
    let seedBadge: React.ReactNode = null;

    if (slot) {
      if (isBye) {
        entrantName = 'BYE (Auto-Advance)';
      } else if (slot.playerIds && slot.playerIds.length > 0) {
        entrantName = slot.playerIds
          .map((id) => playersMap.get(id)?.name || 'Unknown')
          .join(' & ');
        seedBadge = (
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${
              isWinner
                ? 'bg-amber-200 text-amber-900'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            #{slot.seed}
          </span>
        );
      }
    }

    return (
      <div
        className={`flex items-center justify-between px-3 py-2 text-xs transition-colors ${
          isWinner
            ? 'bg-amber-100/90 text-amber-950 font-black'
            : isLoser
            ? 'text-slate-400 bg-slate-50 line-through opacity-70'
            : isBye
            ? 'text-slate-400 italic bg-slate-50/50'
            : 'text-slate-700 bg-white font-bold'
        }`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          {seedBadge}
          <span className="truncate">{entrantName}</span>
        </div>

        {score !== undefined && !isBye && (
          <span
            className={`font-mono font-black text-sm px-1.5 py-0.5 rounded ${
              isWinner ? 'bg-amber-300 text-amber-950' : 'text-slate-600'
            }`}
          >
            {score}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      onClick={isReadyToPlay || isCompleted ? onOpenScoreEntry : undefined}
      className={`relative rounded-2xl border transition-all overflow-hidden ${
        isReadyToPlay
          ? 'ring-2 ring-indigo-500/50 border-indigo-400 bg-white shadow-md hover:scale-[1.02] cursor-pointer hover:border-indigo-600'
          : isCompleted
          ? 'border-slate-200 bg-white shadow-xs hover:border-slate-400 cursor-pointer'
          : 'border-slate-200 bg-slate-50/50 opacity-80 cursor-default'
      }`}
    >
      {/* Top Status Bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-slate-100/90 border-b border-slate-200/80 text-[10px] font-bold text-slate-500">
        <span className="flex items-center gap-1">
          {isFinalRound ? '🏆 Championship Match' : `Match #${match.position}`}
        </span>
        {isCompleted ? (
          <span className="text-emerald-600 font-black flex items-center gap-0.5">
            <Check className="w-3 h-3" /> Final
          </span>
        ) : isReadyToPlay ? (
          <span className="text-indigo-600 font-black animate-pulse flex items-center gap-1">
            <Play className="w-2.5 h-2.5 fill-indigo-600" /> Tap to Score
          </span>
        ) : isByeMatch ? (
          <span className="text-slate-400 font-semibold">Bye Assigned</span>
        ) : (
          <span className="text-slate-400">Up Next</span>
        )}
      </div>

      {/* Team 1 Slot */}
      {renderSlotRow(match.slotA, 'A', match.score1)}

      {/* Divider */}
      <div className="h-px bg-slate-200/80 w-full" />

      {/* Team 2 Slot */}
      {renderSlotRow(match.slotB, 'B', match.score2)}
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* Score Entry Dialog Component                                              */
/* ------------------------------------------------------------------------- */

interface ScoreEntryModalProps {
  match: BracketMatch;
  playersMap: Map<string, Player>;
  score1: number;
  score2: number;
  setScore1: (s: number) => void;
  setScore2: (s: number) => void;
  error: string | null;
  targetPoints: number;
  onClose: () => void;
  onConfirm: () => void;
}

const ScoreEntryModal: React.FC<ScoreEntryModalProps> = ({
  match,
  playersMap,
  score1,
  score2,
  setScore1,
  setScore2,
  error,
  targetPoints,
  onClose,
  onConfirm,
}) => {
  const nameA = match.slotA?.playerIds
    ?.map((id) => playersMap.get(id)?.name || 'Unknown')
    .join(' & ') || 'Team A';

  const nameB = match.slotB?.playerIds
    ?.map((id) => playersMap.get(id)?.name || 'Unknown')
    .join(' & ') || 'Team B';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-slate-900 text-sm sm:text-base">
              Enter Playoff Match Score
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          {/* Team 1 Score Input */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 truncate pr-2">
                #{match.slotA?.seed} {nameA}
              </span>
              <span className="text-xl font-black text-indigo-950 font-mono">
                {score1}
              </span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => setScore1(Math.max(0, score1 - 1))}
                className="w-8 h-8 rounded-xl bg-white border border-slate-300 font-black text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer shadow-2xs"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setScore1(score1 + 1)}
                className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center justify-center cursor-pointer shadow-2xs"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setScore1(targetPoints)}
                className="px-2.5 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
              >
                {targetPoints}
              </button>
            </div>
          </div>

          {/* Team 2 Score Input */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800 truncate pr-2">
                #{match.slotB?.seed} {nameB}
              </span>
              <span className="text-xl font-black text-indigo-950 font-mono">
                {score2}
              </span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => setScore2(Math.max(0, score2 - 1))}
                className="w-8 h-8 rounded-xl bg-white border border-slate-300 font-black text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer shadow-2xs"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setScore2(score2 + 1)}
                className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center justify-center cursor-pointer shadow-2xs"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setScore2(targetPoints)}
                className="px-2.5 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
              >
                {targetPoints}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 cursor-pointer"
          >
            Confirm &amp; Advance
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* Grand Final Score Dialog Component                                        */
/* ------------------------------------------------------------------------- */

interface GrandFinalScoreModalProps {
  matchType: 'match1' | 'resetMatch';
  wbChampNames: string;
  lbChampNames: string;
  score1: number;
  score2: number;
  setScore1: (s: number) => void;
  setScore2: (s: number) => void;
  error: string | null;
  targetPoints: number;
  onClose: () => void;
  onConfirm: () => void;
}

const GrandFinalScoreModal: React.FC<GrandFinalScoreModalProps> = ({
  matchType,
  wbChampNames,
  lbChampNames,
  score1,
  score2,
  setScore1,
  setScore2,
  error,
  targetPoints,
  onClose,
  onConfirm,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">
                {matchType === 'match1' ? 'Grand Final Score' : 'Bracket Reset Final Score'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {matchType === 'match1' ? 'Match 1 of Championship Arena' : 'Decisive Reset Match'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          {/* Winners Champion Input */}
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-amber-950 truncate pr-2 flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-black">
                  🥇 WB
                </span>
                {wbChampNames}
              </span>
              <span className="text-xl font-black text-amber-950 font-mono">
                {score1}
              </span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => setScore1(Math.max(0, score1 - 1))}
                className="w-8 h-8 rounded-xl bg-white border border-amber-300 font-black text-amber-950 hover:bg-amber-100 flex items-center justify-center cursor-pointer shadow-2xs"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setScore1(score1 + 1)}
                className="w-8 h-8 rounded-xl bg-amber-500 hover:bg-amber-600 text-indigo-950 font-black flex items-center justify-center cursor-pointer shadow-2xs"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setScore1(targetPoints)}
                className="px-2.5 h-8 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-xs cursor-pointer"
              >
                {targetPoints}
              </button>
            </div>
          </div>

          {/* Losers Champion Input */}
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-indigo-950 truncate pr-2 flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-indigo-200 text-indigo-900 text-[10px] font-black">
                  🥈 LB
                </span>
                {lbChampNames}
              </span>
              <span className="text-xl font-black text-indigo-950 font-mono">
                {score2}
              </span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => setScore2(Math.max(0, score2 - 1))}
                className="w-8 h-8 rounded-xl bg-white border border-indigo-300 font-black text-indigo-950 hover:bg-indigo-100 flex items-center justify-center cursor-pointer shadow-2xs"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setScore2(score2 + 1)}
                className="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center justify-center cursor-pointer shadow-2xs"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setScore2(targetPoints)}
                className="px-2.5 h-8 rounded-xl bg-indigo-200 hover:bg-indigo-300 text-indigo-950 font-bold text-xs cursor-pointer"
              >
                {targetPoints}
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-indigo-950 font-black text-xs uppercase tracking-wider shadow-md active:scale-95 cursor-pointer"
          >
            Crown Result ➔
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* Bracket Setup Modal Component                                             */
/* ------------------------------------------------------------------------- */

interface BracketSetupModalProps {
  players: Player[];
  standings: StandingsRow[];
  config: SessionConfig;
  onClose: () => void;
  onConfirm: (
    method: SeedingMethod,
    format: 'singles' | 'doubles',
    pairingMethod: DoublesPairingMethod,
    selectedPlayerIds?: string[]
  ) => void;
}

const BracketSetupModal: React.FC<BracketSetupModalProps> = ({
  players,
  standings,
  config,
  onClose,
  onConfirm,
}) => {
  const [seedingMethod, setSeedingMethod] = useState<SeedingMethod>('standings');
  const [format, setFormat] = useState<'singles' | 'doubles'>(
    config.format === 'singles' ? 'singles' : 'doubles'
  );
  const [pairingMethod, setPairingMethod] = useState<DoublesPairingMethod>('duo_or_adjacent');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    return new Set(players.filter((p) => p.active).map((p) => p.id));
  });

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(players.map((p) => p.id)));
  };

  const selectedCount = selectedIds.size;
  const entrantCount = format === 'doubles' ? Math.ceil(selectedCount / 2) : selectedCount;

  const handleGenerate = () => {
    onConfirm(seedingMethod, format, pairingMethod, Array.from(selectedIds));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-indigo-600" />
            <h3 className="font-black text-slate-900 text-sm sm:text-base">
              Configure Playoff Bracket
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Playoff Format (Singles / Doubles) */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
            Match Format
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormat('singles')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                format === 'singles'
                  ? 'bg-indigo-50 border-indigo-600 text-indigo-950 font-black ring-1 ring-indigo-600'
                  : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50'
              }`}
            >
              <div className="text-xs">Singles Playoff</div>
              <div className="text-[10px] text-slate-500 font-medium">1 Player / Team</div>
            </button>
            <button
              type="button"
              onClick={() => setFormat('doubles')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                format === 'doubles'
                  ? 'bg-indigo-50 border-indigo-600 text-indigo-950 font-black ring-1 ring-indigo-600'
                  : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50'
              }`}
            >
              <div className="text-xs">Doubles Playoff</div>
              <div className="text-[10px] text-slate-500 font-medium">2 Players / Team</div>
            </button>
          </div>
        </div>

        {/* Seeding Source */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
            Seeding Method
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSeedingMethod('standings')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                seedingMethod === 'standings'
                  ? 'bg-indigo-50 border-indigo-600 text-indigo-950 font-black ring-1 ring-indigo-600'
                  : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50'
              }`}
            >
              <Award className="w-4 h-4 text-yellow-500 mb-1" />
              <div className="text-xs leading-tight">Standings</div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5">Win rate</div>
            </button>

            <button
              type="button"
              onClick={() => setSeedingMethod('rating')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                seedingMethod === 'rating'
                  ? 'bg-indigo-50 border-indigo-600 text-indigo-950 font-black ring-1 ring-indigo-600'
                  : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50'
              }`}
            >
              <Shield className="w-4 h-4 text-indigo-600 mb-1" />
              <div className="text-xs leading-tight">DUPR Rating</div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5">Skill index</div>
            </button>

            <button
              type="button"
              onClick={() => setSeedingMethod('random')}
              className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                seedingMethod === 'random'
                  ? 'bg-indigo-50 border-indigo-600 text-indigo-950 font-black ring-1 ring-indigo-600'
                  : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-4 h-4 text-emerald-600 mb-1" />
              <div className="text-xs leading-tight">Blind Draw</div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5">Randomized</div>
            </button>
          </div>
        </div>

        {/* Doubles Pairing Method */}
        {format === 'doubles' && (
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Doubles Partner Pairing
            </label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs font-bold text-slate-800">
                <input
                  type="radio"
                  name="pairing"
                  checked={pairingMethod === 'duo_or_adjacent'}
                  onChange={() => setPairingMethod('duo_or_adjacent')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span>Preserve Locked Duos (Recommended)</span>
                  <div className="text-[10px] text-slate-500 font-medium">
                    Keeps linked partner pairs together, then pairs adjacent remaining seeds
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs font-bold text-slate-800">
                <input
                  type="radio"
                  name="pairing"
                  checked={pairingMethod === 'adjacent'}
                  onChange={() => setPairingMethod('adjacent')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span>Adjacent Seeds (1&amp;2, 3&amp;4...)</span>
                  <div className="text-[10px] text-slate-500 font-medium">
                    Pairs closest seeds together as equal-skill teams
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs font-bold text-slate-800">
                <input
                  type="radio"
                  name="pairing"
                  checked={pairingMethod === 'snake'}
                  onChange={() => setPairingMethod('snake')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span>Snake Pairing (1&amp;N, 2&amp;N-1...)</span>
                  <div className="text-[10px] text-slate-500 font-medium">
                    Pairs highest seed with lowest seed for handicap parity
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Entrant Selection List */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Selected Entrants ({selectedCount} players • {entrantCount} slots)
            </label>
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              Select All
            </button>
          </div>

          <div className="max-h-36 overflow-y-auto rounded-2xl border border-slate-200 p-2 space-y-1 bg-slate-50">
            {players.map((p) => {
              const isSelected = selectedIds.has(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex items-center justify-between p-1.5 px-2.5 rounded-xl cursor-pointer text-xs transition-colors ${
                    isSelected ? 'bg-white font-bold text-slate-900 shadow-xs' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePlayer(p.id)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{p.name}</span>
                    {p.duoPartnerId && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-bold">
                        Duo Linked
                      </span>
                    )}
                  </div>
                  {p.duprRating ? (
                    <span className="text-[10px] font-mono text-slate-400">
                      {p.duprRating.toFixed(2)}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedCount < 2}
            onClick={handleGenerate}
            className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 cursor-pointer"
          >
            Generate Bracket ({entrantCount} Entrants)
          </button>
        </div>
      </div>
    </div>
  );
};
