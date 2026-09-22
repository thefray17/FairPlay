import React, { useState } from 'react';
import { MatchFormat, SessionConfig, SportType } from '../types';
import { SPORT_PRESETS } from '../utils/sampleData';
import { Sliders, Shield, AlertTriangle, Sparkles } from 'lucide-react';

interface SessionConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SessionConfig;
  onSaveConfig: (newConfig: SessionConfig) => void;
  onResetSession: () => void;
  onOpenResetModal?: () => void;
  onOpenOnboarding?: () => void;
}

export const SessionConfigModal: React.FC<SessionConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onResetSession,
  onOpenResetModal,
  onOpenOnboarding,
}) => {
  const [form, setForm] = useState<SessionConfig>({ ...config });
  const [confirmReset, setConfirmReset] = useState(false);

  if (!isOpen) return null;

  const handleSportChange = (sport: SportType) => {
    const preset = SPORT_PRESETS[sport];
    if (preset) {
      setForm((prev) => ({
        ...prev,
        sport,
        targetPoints: preset.targetPoints,
        format: preset.defaultFormat,
        playersPerTeam: preset.defaultFormat === 'doubles' ? 2 : preset.defaultFormat === 'singles' ? 1 : 3,
      }));
    } else {
      setForm((prev) => ({ ...prev, sport }));
    }
  };

  const handleFormatChange = (format: MatchFormat) => {
    let perTeam = 2;
    if (format === 'singles') perTeam = 1;
    if (format === 'doubles') perTeam = 2;
    if (format === 'triples') perTeam = 3;
    if (format === 'quads') perTeam = 4;

    setForm((prev) => ({
      ...prev,
      format,
      playersPerTeam: perTeam,
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full my-8 p-6 sm:p-7 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-indigo-950 flex items-center justify-center font-black shadow-xs shrink-0">
              <Sliders className="w-5 h-5 text-indigo-950" />
            </div>
            <div>
              <h2 className="font-black text-indigo-950 text-base sm:text-lg">Session &amp; Court Settings</h2>
              <p className="text-xs font-semibold text-slate-500">Configure courts, format, and target scores</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Session Name */}
          <div>
            <label className="block font-black text-indigo-950 mb-1.5 text-xs uppercase tracking-wider">Session / Club Name</label>
            <input
              type="text"
              value={form.sessionName}
              onChange={(e) => setForm({ ...form, sessionName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600"
              required
            />
          </div>

          {/* Sport Preset */}
          <div>
            <label className="block font-black text-indigo-950 mb-1.5 text-xs uppercase tracking-wider">Sport</label>
            <select
              value={form.sport}
              onChange={(e) => handleSportChange(e.target.value as SportType)}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
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

          {/* Format & Courts count */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-black text-indigo-950 mb-1.5 text-xs uppercase tracking-wider">Match Format</label>
              <select
                value={form.format}
                onChange={(e) => handleFormatChange(e.target.value as MatchFormat)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
              >
                <option value="doubles">Doubles (2 vs 2)</option>
                <option value="singles">Singles (1 vs 1)</option>
                <option value="triples">Triples (3 vs 3)</option>
                <option value="quads">Quads (4 vs 4)</option>
              </select>
            </div>

            <div>
              <label className="block font-black text-indigo-950 mb-1.5 text-xs uppercase tracking-wider">Available Courts</label>
              <input
                type="number"
                min="1"
                max="12"
                value={form.courtsCount}
                onChange={(e) =>
                  setForm({ ...form, courtsCount: Math.max(1, parseInt(e.target.value, 10) || 1) })
                }
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          {/* Target points */}
          <div>
            <label className="block font-black text-indigo-950 mb-1.5 text-xs uppercase tracking-wider">Points to Win Match</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="99"
              value={form.targetPoints}
              onChange={(e) =>
                setForm({ ...form, targetPoints: Math.max(1, parseInt(e.target.value, 10) || 11) })
              }
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl text-slate-600 hover:bg-slate-100 font-black text-xs uppercase transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-sm hover:shadow-indigo-300"
            >
              Save Settings
            </button>
          </div>
        </form>

        {onOpenOnboarding && (
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              id="btn-relaunch-onboarding"
              onClick={() => {
                onClose();
                onOpenOnboarding();
              }}
              className="w-full py-2.5 px-3 rounded-2xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Launch Quick Setup Wizard (Sport, 1v1 / 2v2, Courts)</span>
            </button>
          </div>
        )}

        {/* Danger zone: Reset session */}
        <div className="pt-3 border-t border-slate-100">
          {!confirmReset ? (
            <button
              type="button"
              id="btn-social-modal-reset-session"
              onClick={() => {
                if (onOpenResetModal) {
                  onClose();
                  onOpenResetModal();
                } else {
                  setConfirmReset(true);
                }
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" /> Start Fresh / Reset All Rounds &amp; Scores
            </button>
          ) : (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2.5">
              <p className="text-xs text-rose-900 font-semibold">
                Are you sure? This will clear all generated rounds and standings. Player roster will be kept.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
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
      </div>
    </div>
  );
};
