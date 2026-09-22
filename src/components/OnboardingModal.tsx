import React, { useState } from 'react';
import { MatchFormat, SessionConfig, SportType } from '../types';
import { SPORT_PRESETS } from '../utils/sampleData';
import {
  Sparkles,
  Users,
  Check,
  ArrowRight,
  Minus,
  Plus,
  Play,
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (config: SessionConfig) => void;
  initialConfig?: SessionConfig;
}

interface SportOption {
  id: SportType;
  name: string;
  tag: string;
  description: string;
  defaultPoints: number;
  iconSymbol: string;
}

const AVAILABLE_SPORTS: SportOption[] = [
  {
    id: 'pickleball',
    name: 'Pickleball',
    tag: 'Pickle',
    description: '11 points • Fast kitchen volleys',
    defaultPoints: 11,
    iconSymbol: '🥒',
  },
  {
    id: 'badminton',
    name: 'Badminton',
    tag: 'Badminton',
    description: '21 points • Fast shuttles & smashes',
    defaultPoints: 21,
    iconSymbol: '🏸',
  },
  {
    id: 'tennis',
    name: 'Tennis',
    tag: 'Tennis',
    description: '6 games/sets • Full baseline court',
    defaultPoints: 6,
    iconSymbol: '🎾',
  },
  {
    id: 'table-tennis',
    name: 'Table Tennis',
    tag: 'Table Tennis',
    description: '11 points • Ping pong table rallies',
    defaultPoints: 11,
    iconSymbol: '🏓',
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
  initialConfig,
}) => {
  const [sessionName, setSessionName] = useState(
    initialConfig?.sessionName || 'Club Session'
  );
  const [sport, setSport] = useState<SportType>(initialConfig?.sport || 'pickleball');
  const [format, setFormat] = useState<MatchFormat>(
    initialConfig?.format === 'singles' ? 'singles' : 'doubles'
  );
  const [courtsCount, setCourtsCount] = useState<number>(
    initialConfig?.courtsCount || 2
  );

  if (!isOpen) return null;

  const handleSportSelect = (selectedSport: SportType) => {
    setSport(selectedSport);
    const preset = SPORT_PRESETS[selectedSport];
    // Suggest a clean default name if user has the generic default
    if (!sessionName || sessionName === 'Club Session' || sessionName.includes('Club')) {
      const sportObj = AVAILABLE_SPORTS.find((s) => s.id === selectedSport);
      setSessionName(`${sportObj?.name || 'Club'} Session`);
    }
  };

  const playersPerTeam = format === 'singles' ? 1 : 2;
  const activePlayingCapacity = courtsCount * playersPerTeam * 2;

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    const preset = SPORT_PRESETS[sport];
    const targetPoints = preset ? preset.targetPoints : 11;

    const newConfig: SessionConfig = {
      sessionName: sessionName.trim() || 'Club Session',
      sport,
      format,
      playersPerTeam,
      courtsCount,
      targetPoints,
      winByTwo: true,
      allowDraw: false,
    };

    onComplete(newConfig);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full my-4 sm:my-8 p-5 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Welcome Header */}
        <div className="text-center space-y-1.5 pb-1 border-b border-slate-100">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-black uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Welcome to FairPlay</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Set Up Your Match Session
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 max-w-sm mx-auto">
            Choose your sport, game format, and courts to start generating mathematically fair rotations.
          </p>
        </div>

        <form onSubmit={handleFinish} className="space-y-4">
          {/* 1. Session Name */}
          <div>
            <label
              htmlFor="onboarding-session-name"
              className="block font-black text-slate-900 mb-1 text-xs uppercase tracking-wider"
            >
              Session Name
            </label>
            <input
              id="onboarding-session-name"
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g., Friday Night Pickleball"
              required
              className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-900 text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-all bg-slate-50/50 hover:bg-white focus:bg-white"
            />
          </div>

          {/* 2. Sports Available */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-black text-slate-900 text-xs uppercase tracking-wider">
                Select Sport
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                4 Racket &amp; Paddle Sports
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
              {AVAILABLE_SPORTS.map((s) => {
                const isSelected = sport === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    id={`onboarding-sport-${s.id}`}
                    onClick={() => handleSportSelect(s.id)}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 shadow-xs ring-2 ring-indigo-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl" role="img" aria-label={s.name}>
                        {s.iconSymbol}
                      </span>
                      {isSelected ? (
                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase text-slate-400">
                          {s.defaultPoints} pts
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <span
                        className={`block text-xs sm:text-sm font-black tracking-tight ${
                          isSelected ? 'text-indigo-950' : 'text-slate-900'
                        }`}
                      >
                        {s.name}
                      </span>
                      <span
                        className={`block text-[10px] sm:text-[11px] font-semibold truncate ${
                          isSelected ? 'text-indigo-700' : 'text-slate-500'
                        }`}
                      >
                        {s.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Match Format: 1v1 or 2v2 */}
          <div>
            <label className="block font-black text-slate-900 mb-1.5 text-xs uppercase tracking-wider">
              Match Format
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                id="onboarding-format-doubles"
                onClick={() => setFormat('doubles')}
                className={`py-3 px-3.5 rounded-2xl border-2 font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  format === 'doubles'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-600/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                <div className="text-left">
                  <span className="block font-black leading-tight">2 vs 2 (Doubles)</span>
                  <span className="block text-[10px] font-semibold text-slate-500">4 players per court</span>
                </div>
              </button>

              <button
                type="button"
                id="onboarding-format-singles"
                onClick={() => setFormat('singles')}
                className={`py-3 px-3.5 rounded-2xl border-2 font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  format === 'singles'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-600/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-black shrink-0">
                  1
                </div>
                <div className="text-left">
                  <span className="block font-black leading-tight">1 vs 1 (Singles)</span>
                  <span className="block text-[10px] font-semibold text-slate-500">2 players per court</span>
                </div>
              </button>
            </div>
          </div>

          {/* 4. Number of Courts */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-black text-slate-900 text-xs uppercase tracking-wider">
                Available Courts
              </label>
              <span className="text-[11px] font-bold text-indigo-900 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                {activePlayingCapacity} players on-court
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Quick Court Selection Pills */}
              <div className="grid grid-cols-4 gap-1.5 flex-1">
                {[1, 2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    id={`onboarding-court-pill-${num}`}
                    onClick={() => setCourtsCount(num)}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      courtsCount === num
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    {num} {num === 1 ? 'Court' : 'Courts'}
                  </button>
                ))}
              </div>

              {/* Stepper for 5+ courts */}
              <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-0.5">
                <button
                  type="button"
                  id="onboarding-court-decrease"
                  onClick={() => setCourtsCount((c) => Math.max(1, c - 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
                  title="Decrease court count"
                  aria-label="Decrease court count"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center text-xs font-black text-slate-900">
                  {courtsCount}
                </span>
                <button
                  type="button"
                  id="onboarding-court-increase"
                  onClick={() => setCourtsCount((c) => Math.min(12, c + 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
                  title="Increase court count"
                  aria-label="Increase court count"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-1.5">
              Players rotate automatically between matches so everyone gets balanced court time.
            </p>
          </div>

          {/* Submit / Get Started */}
          <div className="pt-2">
            <button
              type="submit"
              id="btn-onboarding-start"
              className="w-full py-3.5 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-wider transition-all shadow-md hover:shadow-lg shadow-indigo-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Get Started &amp; Build Squad</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
