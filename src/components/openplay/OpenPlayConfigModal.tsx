import React, { useState, useEffect } from 'react';
import { OpenPlayConfig } from '../../types/openPlay';
import { SportType, MatchFormat } from '../../types';
import { SPORT_PRESETS } from '../../utils/sampleData';
import { Sliders, X, Check, RotateCcw, AlertTriangle } from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface OpenPlayConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: OpenPlayConfig;
  onSaveConfig: (newConfig: OpenPlayConfig) => void;
  onResetSession: () => void;
}

export const OpenPlayConfigModal: React.FC<OpenPlayConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onResetSession,
}) => {
  const [formData, setFormData] = useState<OpenPlayConfig>(config);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setFormData(config);
    setConfirmReset(false);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleSportChange = (sport: SportType) => {
    const preset = SPORT_PRESETS[sport];
    if (preset) {
      setFormData((prev) => ({
        ...prev,
        sport,
        targetPoints: preset.targetPoints,
        format: preset.defaultFormat === 'singles' ? 'singles' : 'doubles',
      }));
    } else {
      setFormData((prev) => ({ ...prev, sport }));
    }
  };

  const handleFormatChange = (format: 'doubles' | 'singles') => {
    setFormData((prev) => ({
      ...prev,
      format,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(formData);
    soundFx.playPointChime();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full my-6 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header - Uniform with Social Match */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-emerald-950 flex items-center justify-center font-black shadow-xs shrink-0">
              <Sliders className="w-5 h-5 text-emerald-950" />
            </div>
            <div>
              <h2 className="font-black text-white text-base sm:text-lg leading-tight">
                Session &amp; Court Settings
              </h2>
              <p className="text-xs font-semibold text-emerald-200">
                Configure courts, format, and target scores
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
          {/* Session / Club Name */}
          <div>
            <label className="block font-black text-slate-800 mb-1.5 text-xs uppercase tracking-wider">
              Session / Club Name
            </label>
            <input
              type="text"
              value={formData.sessionName || 'Open Play Session'}
              onChange={(e) => setFormData({ ...formData, sessionName: e.target.value })}
              placeholder="e.g. Wednesday Open Play"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              required
            />
          </div>

          {/* Sport Preset */}
          <div>
            <label className="block font-black text-slate-800 mb-1.5 text-xs uppercase tracking-wider">
              Sport
            </label>
            <select
              value={formData.sport || 'pickleball'}
              onChange={(e) => handleSportChange(e.target.value as SportType)}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white cursor-pointer"
            >
              <option value="pickleball">Pickleball (11 pts)</option>
              <option value="badminton">Badminton (21 pts)</option>
              <option value="tennis">Tennis (6 games)</option>
              <option value="table-tennis">Table Tennis (11 pts)</option>
              <option value="padel">Padel (6 games)</option>
              <option value="volleyball">Volleyball (25 pts)</option>
              <option value="custom">Custom Sport</option>
            </select>
          </div>

          {/* Format & Available Courts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-black text-slate-800 mb-1.5 text-xs uppercase tracking-wider">
                Match Format
              </label>
              <select
                value={formData.format}
                onChange={(e) => handleFormatChange(e.target.value as 'doubles' | 'singles')}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white cursor-pointer"
              >
                <option value="doubles">Doubles (2 vs 2)</option>
                <option value="singles">Singles (1 vs 1)</option>
              </select>
            </div>

            <div>
              <label className="block font-black text-slate-800 mb-1.5 text-xs uppercase tracking-wider">
                Available Courts
              </label>
              <input
                type="number"
                min="1"
                max="12"
                value={formData.courtsCount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    courtsCount: Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)),
                  })
                }
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
            </div>
          </div>

          {/* Target Points to Win */}
          <div>
            <label className="block font-black text-slate-800 mb-1.5 text-xs uppercase tracking-wider">
              Points to Win Match
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="99"
                value={formData.targetPoints}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    targetPoints: Math.max(1, parseInt(e.target.value, 10) || 11),
                  })
                }
                className="w-24 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white text-center font-mono font-black text-sm"
              />
              <div className="flex items-center gap-1.5 flex-1">
                {[11, 15, 21, 25].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setFormData({ ...formData, targetPoints: pts })}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      formData.targetPoints === pts
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    {pts}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Win by Two Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <p className="font-black text-slate-800 text-xs">Win by 2 Points</p>
              <p className="text-[11px] text-slate-500 font-semibold">
                Require 2-point margin to conclude match
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.winByTwo}
              onChange={(e) => setFormData({ ...formData, winByTwo: e.target.checked })}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
            />
          </div>

          {/* Auto Dispatch Next Game */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <p className="font-black text-slate-800 text-xs">Auto-Call Next Match</p>
              <p className="text-[11px] text-slate-500 font-semibold">
                Automatically dispatch waiting players when a court finishes
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.autoDispatchNext}
              onChange={(e) => setFormData({ ...formData, autoDispatchNext: e.target.checked })}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
            />
          </div>

          {/* Danger zone: Reset Session */}
          <div className="pt-3 border-t border-slate-100">
            {!confirmReset ? (
              <button
                type="button"
                id="btn-openplay-modal-reset-session"
                onClick={() => {
                  onClose();
                  onResetSession();
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" /> Start Fresh / Reset All Matches &amp; Scores
              </button>
            ) : (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2.5">
                <p className="text-xs text-rose-900 font-semibold">
                  Are you sure? This will clear all active court matches and history.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-openplay-modal-confirm-reset"
                    onClick={() => {
                      onResetSession();
                      setConfirmReset(false);
                      onClose();
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl text-slate-600 hover:bg-slate-100 font-black text-xs uppercase transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-openplay-save-settings"
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-sm hover:shadow-emerald-300 active:scale-95"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
