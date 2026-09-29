import React, { useState, useMemo, useEffect } from 'react';
import { Player, BatchGenerationConfig, BatchGenerationMode, SessionConfig } from '../types';
import {
  X,
  Layers,
  Sparkles,
  Users,
  Trophy,
  Shuffle,
  Grid,
  ShieldCheck,
  CheckSquare,
  Square,
  AlertTriangle,
  Play,
  Plus,
  Minus,
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface BatchMatchGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  config: SessionConfig;
  initialConfig?: Partial<BatchGenerationConfig>;
  onGenerate: (batchConfig: BatchGenerationConfig) => void;
  existingRoundsCount: number;
}

export const BatchMatchGeneratorModal: React.FC<BatchMatchGeneratorModalProps> = ({
  isOpen,
  onClose,
  players,
  config,
  initialConfig,
  onGenerate,
  existingRoundsCount,
}) => {
  const [mode, setMode] = useState<BatchGenerationMode>(
    (initialConfig?.mode as BatchGenerationMode) || 'social'
  );
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(() => {
    if (initialConfig?.activePlayerIds) return initialConfig.activePlayerIds;
    return players.filter((p) => p.active).map((p) => p.id);
  });
  const [courtsCount, setCourtsCount] = useState<number>(
    initialConfig?.courtsCount ?? config.courtsCount ?? 2
  );
  const [targetPoints, setTargetPoints] = useState<number>(
    initialConfig?.targetPoints ?? config.targetPoints ?? 11
  );
  const [winByTwo, setWinByTwo] = useState<boolean>(
    initialConfig?.winByTwo ?? config.winByTwo ?? true
  );

  const playersPerMatch = config.playersPerTeam * 2;
  const activeCount = selectedPlayerIds.length;

  // Maximum courts that can be used simultaneously given active players
  const courtsToUse = useMemo(() => {
    if (activeCount < playersPerMatch) return 0;
    const maxPossibleCourts = Math.floor(activeCount / playersPerMatch);
    return Math.min(courtsCount, maxPossibleCourts) || 1;
  }, [activeCount, playersPerMatch, courtsCount]);

  // Desired matches directly chosen by the organizer
  const [desiredMatches, setDesiredMatches] = useState<number>(() => {
    if (initialConfig?.roundCount) {
      const courts = initialConfig.courtsCount ?? config.courtsCount ?? 2;
      return initialConfig.roundCount * courts;
    }
    return 6;
  });

  // Re-sync if initialConfig changes
  useEffect(() => {
    if (isOpen) {
      if (initialConfig?.mode) setMode(initialConfig.mode as BatchGenerationMode);
      if (initialConfig?.courtsCount !== undefined) setCourtsCount(initialConfig.courtsCount);
      if (initialConfig?.targetPoints !== undefined) setTargetPoints(initialConfig.targetPoints);
      if (initialConfig?.winByTwo !== undefined) setWinByTwo(initialConfig.winByTwo);
      if (initialConfig?.activePlayerIds) {
        setSelectedPlayerIds(initialConfig.activePlayerIds);
      } else {
        setSelectedPlayerIds(players.filter((p) => p.active).map((p) => p.id));
      }
      if (initialConfig?.roundCount !== undefined) {
        const courts = initialConfig.courtsCount ?? config.courtsCount ?? 2;
        setDesiredMatches(initialConfig.roundCount * courts);
      }
    }
  }, [isOpen, initialConfig, players, config.courtsCount]);

  // Internally derive roundCount = Math.ceil(desiredMatches / courtsToUse) — round up, never down!
  const roundCount = useMemo(() => {
    if (mode !== 'social') return 1;
    const effectiveCourts = Math.max(1, courtsToUse);
    return Math.max(1, Math.ceil(desiredMatches / effectiveCourts));
  }, [mode, desiredMatches, courtsToUse]);

  // Actual total matches that will be generated: roundCount * courtsToUse
  const actualMatchesGenerated = useMemo(() => {
    if (mode === 'social') {
      return roundCount * courtsToUse;
    }
    return courtsToUse;
  }, [mode, roundCount, courtsToUse]);

  const fairnessExpectation = useMemo(() => {
    if (activeCount === 0 || courtsToUse === 0 || mode !== 'social') return null;
    const totalSlots = roundCount * courtsToUse * playersPerMatch;
    const minMatches = Math.floor(totalSlots / activeCount);
    const maxMatches = Math.ceil(totalSlots / activeCount);
    const spread = maxMatches - minMatches;
    return {
      minMatches,
      maxMatches,
      spread,
      isPerfect: spread === 0,
    };
  }, [activeCount, courtsToUse, roundCount, playersPerMatch, mode]);

  const benchedPerRound = useMemo(() => {
    return Math.max(0, activeCount - courtsToUse * playersPerMatch);
  }, [activeCount, courtsToUse, playersPerMatch]);

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedPlayerIds(players.map((p) => p.id));
  };

  const handleDeselectAll = () => {
    setSelectedPlayerIds([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeCount < playersPerMatch) return;

    soundFx.playWhistle();
    onGenerate({
      mode,
      courtsCount,
      targetPoints,
      winByTwo,
      activePlayerIds: selectedPlayerIds,
      roundCount: mode === 'social' ? roundCount : 1,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="batch-generator-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-generator-title"
    >
      <div
        id="batch-generator-modal"
        className="bg-white rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 my-auto animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-200">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="batch-generator-title" className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                Generate Matches
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow-400 text-indigo-950">
                  Batch Setup
                </span>
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                Pre-generate multiple fair rounds in sequence with carry-forward fairness
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div>
          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
            Generation Mode
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl">
            <button
              type="button"
              id="batch-mode-social"
              onClick={() => setMode('social')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                mode === 'social'
                  ? 'bg-white text-indigo-950 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Social</span>
            </button>
            <button
              type="button"
              id="batch-mode-openplay"
              onClick={() => setMode('openplay')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                mode === 'openplay'
                  ? 'bg-white text-indigo-950 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5 text-emerald-600" />
              <span>Open Play</span>
            </button>
            <button
              type="button"
              id="batch-mode-tournament"
              onClick={() => setMode('tournament')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                mode === 'tournament'
                  ? 'bg-white text-indigo-950 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
              <span>Tournament</span>
            </button>
            <button
              type="button"
              id="batch-mode-shuffle"
              onClick={() => setMode('shuffle')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                mode === 'shuffle'
                  ? 'bg-white text-indigo-950 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5 text-purple-600" />
              <span>Shuffle</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Social Mode: Match Count Stepper + Derived Round Calculation */}
          {mode === 'social' ? (
            <div
              id="social-match-picker"
              className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-3.5 sm:p-4 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    How Many Matches to Generate?
                  </span>
                  <p className="text-[11px] font-semibold text-indigo-900/80 mt-0.5">
                    Set your desired total match count. FairPlay calculates the optimal fair rounds.
                  </p>
                </div>

                {/* Match Count Stepper */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div className="inline-flex items-center bg-white border border-indigo-200 rounded-xl shadow-2xs p-1">
                    <button
                      type="button"
                      id="btn-decrement-matches"
                      onClick={() => setDesiredMatches((prev) => Math.max(1, prev - 1))}
                      disabled={desiredMatches <= 1}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                      title="Decrease matches"
                      aria-label="Decrease matches"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={desiredMatches}
                      onChange={(e) => setDesiredMatches(Math.max(1, parseInt(e.target.value) || 1))}
                      id="stepper-match-count-input"
                      className="w-12 text-center font-black text-sm text-indigo-950 bg-transparent focus:outline-hidden"
                    />
                    <button
                      type="button"
                      id="btn-increment-matches"
                      onClick={() => setDesiredMatches((prev) => Math.min(60, prev + 1))}
                      disabled={desiredMatches >= 60}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                      title="Increase matches"
                      aria-label="Increase matches"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-xs font-bold text-indigo-900">Matches</span>
                </div>
              </div>

              {/* Live Match Comparison & Derived Round Notice */}
              <div
                id="match-generation-status-callout"
                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                  actualMatchesGenerated !== desiredMatches
                    ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                    : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0">
                    {actualMatchesGenerated !== desiredMatches ? '⚡' : '✓'}
                  </span>
                  <span className="truncate sm:whitespace-normal">
                    {actualMatchesGenerated !== desiredMatches
                      ? `You asked for ${desiredMatches} — generating ${actualMatchesGenerated} across ${roundCount} rounds`
                      : `Generating ${actualMatchesGenerated} matches across ${roundCount} round${roundCount > 1 ? 's' : ''}`}
                  </span>
                </div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white/80 border border-current shrink-0">
                  {roundCount} {roundCount === 1 ? 'Round' : 'Rounds'}
                </span>
              </div>

              {/* Derived Total Match Count & Fairness Preview Display */}
              <div
                id="derived-match-count-badge"
                className="bg-white/90 rounded-xl p-2.5 sm:p-3 border border-indigo-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-yellow-400 text-indigo-950 font-black flex items-center justify-center text-xs shrink-0">
                    {actualMatchesGenerated}
                  </span>
                  <div>
                    <div className="font-black text-indigo-950">
                      {actualMatchesGenerated} Matches across {courtsToUse} Court{courtsToUse > 1 ? 's' : ''}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      {roundCount} rounds × {courtsToUse} active court{courtsToUse > 1 ? 's' : ''}
                      {existingRoundsCount > 0 ? ` (Rounds ${existingRoundsCount + 1}–${existingRoundsCount + roundCount})` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  {fairnessExpectation && (
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-1 rounded-md border shrink-0 ${
                        fairnessExpectation.isPerfect
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : fairnessExpectation.spread === 1
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                          : 'bg-amber-50 text-amber-900 border-amber-300'
                      }`}
                      title={
                        fairnessExpectation.isPerfect
                          ? `All ${activeCount} players play exactly ${fairnessExpectation.minMatches} matches`
                          : `Players play between ${fairnessExpectation.minMatches} and ${fairnessExpectation.maxMatches} matches`
                      }
                    >
                      {fairnessExpectation.isPerfect
                        ? `Exact ${fairnessExpectation.minMatches} per player`
                        : `${fairnessExpectation.minMatches}–${fairnessExpectation.maxMatches} per player`}
                    </span>
                  )}
                  <span className="text-[10px] font-black uppercase px-2 py-1 rounded-md bg-emerald-100 text-emerald-900 shrink-0">
                    Carry-Forward
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-600">
              <span className="font-bold text-slate-800">
                {mode === 'openplay'
                  ? 'Open Play Mode: '
                  : mode === 'tournament'
                  ? 'Tournament Mode: '
                  : 'Shuffle Mode: '}
              </span>
              Generates matches immediately for current active courts.
            </div>
          )}

          {/* Courts & Scoring Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1">
                Available Courts
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={courtsCount}
                  onChange={(e) => setCourtsCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-sm font-black text-slate-900 text-center"
                />
                <span className="text-xs font-semibold text-slate-500">
                  (Uses up to {courtsToUse} court{courtsToUse > 1 ? 's' : ''} for {activeCount} players)
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1">
                Target Points &amp; Win by 2
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={targetPoints}
                  onChange={(e) => setTargetPoints(Math.max(1, parseInt(e.target.value) || 11))}
                  className="w-16 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-sm font-black text-slate-900 text-center"
                />
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={winByTwo}
                    onChange={(e) => setWinByTwo(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Win by 2</span>
                </label>
              </div>
            </div>
          </div>

          {/* Active Players Checklist */}
          <div className="border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  Active Roster for this Batch ({activeCount}/{players.length})
                </span>
                <span className="text-[11px] text-slate-500 block">
                  {benchedPerRound > 0
                    ? `${benchedPerRound} player${benchedPerRound > 1 ? 's' : ''} will rest per round on rotation`
                    : 'All players fit simultaneously on available courts'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="text-[10px] font-black text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 pr-1">
              {players.map((player) => {
                const isSelected = selectedPlayerIds.includes(player.id);
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => togglePlayer(player.id)}
                    className="w-full py-1.5 px-2 flex items-center justify-between hover:bg-slate-50 rounded-lg text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 ${player.avatarColor}`}
                      >
                        {player.name.charAt(0)}
                      </span>
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {player.name}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isSelected ? 'Active' : 'Resting'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Validation Notice if not enough players */}
          {activeCount < playersPerMatch && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                Need at least {playersPerMatch} active players for {config.format} format. Please select more players.
              </span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-black text-xs uppercase hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-confirm-generate-batch"
              disabled={activeCount < playersPerMatch}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black text-xs uppercase tracking-wider shadow-md hover:shadow-indigo-300 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {mode === 'social'
                  ? `Generate ${roundCount} Round${roundCount > 1 ? 's' : ''} (${actualMatchesGenerated} Matches)`
                  : `Generate Matches (${actualMatchesGenerated})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
