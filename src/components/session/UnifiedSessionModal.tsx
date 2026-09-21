import React, { useState, useEffect } from 'react';
import {
  MatchFormat,
  SessionType,
  SportType,
  UnifiedSessionCreationOptions,
  Club,
} from '../../types';
import { SPORT_PRESETS } from '../../utils/sampleData';
import {
  Sliders,
  X,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  Trophy,
  Layers,
  Activity,
  Check,
  Lock,
} from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface UnifiedSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSession: (options: UnifiedSessionCreationOptions) => void;
  initialConfig?: Partial<UnifiedSessionCreationOptions>;
  club?: Club | null;
  isEditing?: boolean;
  isLocked?: boolean;
}

export const UnifiedSessionModal: React.FC<UnifiedSessionModalProps> = ({
  isOpen,
  onClose,
  onStartSession,
  initialConfig,
  club,
  isEditing = false,
  isLocked = false,
}) => {
  const [sessionType, setSessionType] = useState<SessionType>(
    initialConfig?.sessionType || 'social'
  );
  const [sport, setSport] = useState<SportType>(
    initialConfig?.sport || club?.sport || 'badminton'
  );
  const [format, setFormat] = useState<MatchFormat>(
    initialConfig?.format || 'doubles'
  );
  const [courtsCount, setCourtsCount] = useState<number>(
    initialConfig?.courtsCount || 2
  );
  const [targetPoints, setTargetPoints] = useState<number>(
    initialConfig?.targetPoints || 21
  );
  const [winByTwo, setWinByTwo] = useState<boolean>(
    initialConfig?.winByTwo ?? true
  );
  const [sessionName, setSessionName] = useState<string>(
    initialConfig?.sessionName ||
      (club?.name ? `${club.name} Session` : 'Badminton Session')
  );

  useEffect(() => {
    if (initialConfig) {
      if (initialConfig.sessionType) setSessionType(initialConfig.sessionType);
      if (initialConfig.sport) setSport(initialConfig.sport);
      if (initialConfig.format) setFormat(initialConfig.format);
      if (initialConfig.courtsCount) setCourtsCount(initialConfig.courtsCount);
      if (initialConfig.targetPoints) setTargetPoints(initialConfig.targetPoints);
      if (initialConfig.winByTwo !== undefined) setWinByTwo(initialConfig.winByTwo);
      if (initialConfig.sessionName) setSessionName(initialConfig.sessionName);
    }
  }, [initialConfig, isOpen]);

  if (!isOpen) return null;

  const handleSportChange = (newSport: SportType) => {
    if (isLocked) return;
    const preset = SPORT_PRESETS[newSport];
    setSport(newSport);
    if (preset) {
      setTargetPoints(preset.targetPoints);
      setFormat(preset.defaultFormat);
    }
  };

  const handleFormatChange = (newFormat: MatchFormat) => {
    if (isLocked) return;
    setFormat(newFormat);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playPointChime();
    onStartSession({
      sessionType,
      sport,
      format,
      courtsCount,
      targetPoints,
      winByTwo,
      sessionName: sessionName.trim() || 'FairPlay Session',
      clubId: club?.id,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full my-6 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-indigo-950 flex items-center justify-center font-black shadow-md shrink-0">
              <Sliders className="w-5 h-5 text-indigo-950" />
            </div>
            <div>
              <h2 className="font-black text-white text-base sm:text-lg leading-tight">
                {isEditing ? 'Session & Court Configuration' : 'Start New Session'}
              </h2>
              <p className="text-xs font-semibold text-indigo-200">
                {club?.name ? `Squad: ${club.name}` : 'Unified Rotation Setup'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto text-xs">
          {/* Locked Notice if matches in progress */}
          {isLocked && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-semibold text-xs">
                Matches are currently in progress. Session format and type are locked.
              </span>
            </div>
          )}

          {/* 1. Pick Session Engine / Type */}
          <div>
            <label className="block font-black text-slate-800 mb-2 uppercase tracking-wider text-xs flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              1. Choose Session Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Social Rotation */}
              <button
                type="button"
                disabled={isLocked}
                onClick={() => setSessionType('social')}
                className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                  sessionType === 'social'
                    ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-xs text-indigo-950">Social Rotation</span>
                    <Users className="w-4 h-4 text-indigo-600" />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug font-medium">
                    Strict rest fairness; rotates partners &amp; opponents equally.
                  </p>
                </div>
                {sessionType === 'social' && (
                  <span className="mt-2 text-[10px] font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                    <Check className="w-3 h-3 text-indigo-600" /> Selected
                  </span>
                )}
              </button>

              {/* Open Play Queue */}
              <button
                type="button"
                disabled={isLocked}
                onClick={() => setSessionType('open_play')}
                className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                  sessionType === 'open_play'
                    ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-xs text-emerald-950">Open Play (3-Queue)</span>
                    <Activity className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug font-medium">
                    Continuous court flow with Winners, Losers, &amp; Bench queues.
                  </p>
                </div>
                {sessionType === 'open_play' && (
                  <span className="mt-2 text-[10px] font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" /> Selected
                  </span>
                )}
              </button>

              {/* Tournament */}
              <button
                type="button"
                disabled={isLocked}
                onClick={() => setSessionType('tournament')}
                className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                  sessionType === 'tournament'
                    ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black text-xs text-amber-950">Tournament</span>
                    <Trophy className="w-4 h-4 text-amber-600" />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug font-medium">
                    Round Robin seeding into elimination playoff brackets.
                  </p>
                </div>
                {sessionType === 'tournament' && (
                  <span className="mt-2 text-[10px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1">
                    <Check className="w-3 h-3 text-amber-600" /> Selected
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Session Name */}
          <div>
            <label className="block font-black text-slate-800 mb-1.5 uppercase tracking-wider text-xs">
              Session Title
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. Wednesday Badminton Night"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all text-xs"
            />
          </div>

          {/* 2. Sport & Format Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-black text-slate-800 mb-1.5 uppercase tracking-wider text-xs">
                Sport
              </label>
              <select
                value={sport}
                disabled={isLocked}
                onChange={(e) => handleSportChange(e.target.value as SportType)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white text-xs disabled:opacity-60"
              >
                <option value="badminton">🏸 Badminton (21 pts)</option>
                <option value="pickleball">🏓 Pickleball (11 pts)</option>
                <option value="tennis">🎾 Tennis</option>
                <option value="table-tennis">🏓 Table Tennis (11 pts)</option>
                <option value="padel">🎾 Padel</option>
                <option value="volleyball">🏐 Volleyball (25 pts)</option>
                <option value="custom">⚙️ Custom Sport</option>
              </select>
            </div>

            <div>
              <label className="block font-black text-slate-800 mb-1.5 uppercase tracking-wider text-xs">
                Match Format
              </label>
              <select
                value={format}
                disabled={isLocked}
                onChange={(e) => handleFormatChange(e.target.value as MatchFormat)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 font-bold text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white text-xs disabled:opacity-60"
              >
                <option value="doubles">Doubles (2 vs 2)</option>
                <option value="singles">Singles (1 vs 1)</option>
                {sessionType === 'social' && <option value="triples">Triples (3 vs 3)</option>}
                {sessionType === 'social' && <option value="quads">Quads (4 vs 4)</option>}
              </select>
            </div>
          </div>

          {/* 3. Courts & Points */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-black text-slate-800 mb-1.5 uppercase tracking-wider text-xs">
                Active Courts
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={courtsCount}
                  onChange={(e) => setCourtsCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 font-black text-center text-indigo-950 focus:outline-none focus:border-indigo-600 focus:bg-white text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block font-black text-slate-800 mb-1.5 uppercase tracking-wider text-xs">
                Target Points
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={targetPoints}
                onChange={(e) => setTargetPoints(Math.max(1, parseInt(e.target.value) || 21))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 font-black text-center text-indigo-950 focus:outline-none focus:border-indigo-600 focus:bg-white text-sm"
              />
            </div>
          </div>

          {/* Win by Two Checkbox */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <input
              type="checkbox"
              id="win-by-two-toggle"
              checked={winByTwo}
              onChange={(e) => setWinByTwo(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
            />
            <label htmlFor="win-by-two-toggle" className="font-bold text-slate-800 cursor-pointer text-xs">
              Must Win by 2 Points (Deuce rule)
            </label>
          </div>

          {/* Action Button */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-2 py-3 px-4 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-indigo-950 font-black transition-all shadow-md hover:shadow-yellow-400/20 flex items-center justify-center gap-2 text-xs"
            >
              <Play className="w-4 h-4 fill-indigo-950 text-indigo-950" />
              <span>{isEditing ? 'Save & Apply Config' : 'Start Session'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
