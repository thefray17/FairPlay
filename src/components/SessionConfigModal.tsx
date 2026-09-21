import React, { useState } from 'react';
import { MatchFormat, SessionConfig, SportType } from '../types';
import { SPORT_PRESETS } from '../utils/sampleData';
import { Sliders, Shield, AlertTriangle, Sparkles, Trophy, Swords, Lock, Unlock } from 'lucide-react';

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

  const isTournamentLocked = Boolean(
    form.tournamentMode?.enabled &&
      form.tournamentMode.locked &&
      !form.tournamentMode.completedAt
  );

  const handleSportChange = (sport: SportType) => {
    if (isTournamentLocked) return;
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
    if (isTournamentLocked) return;
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

  const handleUnlockTournament = () => {
    setForm((prev) => ({
      ...prev,
      tournamentMode: prev.tournamentMode
        ? {
            ...prev.tournamentMode,
            enabled: false,
          }
        : undefined,
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

        {/* Tournament Locked Alert */}
        {isTournamentLocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-amber-900" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-black text-amber-950 block">
                  Tournament Mode Active ({form.tournamentMode?.totalRounds} Rounds)
                </span>
                <p className="text-[11px] text-amber-900/90 font-medium mt-0.5">
                  Sport, courts, match format, and scoring are locked during the tournament to preserve round-robin schedule integrity.
                </p>
              </div>
            </div>
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={handleUnlockTournament}
                className="text-[11px] font-black text-amber-900 hover:text-amber-950 flex items-center gap-1 cursor-pointer bg-amber-100/80 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors"
              >
                <Unlock className="w-3 h-3" />
                <span>Switch to Casual Mode (Unlock)</span>
              </button>
            </div>
          </div>
        )}

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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-black text-indigo-950 text-xs uppercase tracking-wider">Sport</label>
              {isTournamentLocked && (
                <span className="text-[10px] font-bold text-amber-800 flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              )}
            </div>
            <select
              value={form.sport}
              disabled={isTournamentLocked}
              onChange={(e) => handleSportChange(e.target.value as SportType)}
              className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 ${
                isTournamentLocked
                  ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-black text-indigo-950 text-xs uppercase tracking-wider">Match Format</label>
                {isTournamentLocked && <Lock className="w-2.5 h-2.5 text-amber-800" />}
              </div>
              <select
                value={form.format}
                disabled={isTournamentLocked}
                onChange={(e) => handleFormatChange(e.target.value as MatchFormat)}
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 ${
                  isTournamentLocked
                    ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <option value="doubles">Doubles (2 vs 2)</option>
                <option value="singles">Singles (1 vs 1)</option>
                <option value="triples">Triples (3 vs 3)</option>
                <option value="quads">Quads (4 vs 4)</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-black text-indigo-950 text-xs uppercase tracking-wider">Available Courts</label>
                {isTournamentLocked && <Lock className="w-2.5 h-2.5 text-amber-800" />}
              </div>
              <input
                type="number"
                min="1"
                max="12"
                disabled={isTournamentLocked}
                value={form.courtsCount}
                onChange={(e) =>
                  setForm({ ...form, courtsCount: Math.max(1, parseInt(e.target.value, 10) || 1) })
                }
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 ${
                  isTournamentLocked
                    ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </div>
          </div>

          {/* Target points */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-black text-indigo-950 text-xs uppercase tracking-wider">Points to Win Match</label>
              {isTournamentLocked && <Lock className="w-2.5 h-2.5 text-amber-800" />}
            </div>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="99"
              disabled={isTournamentLocked}
              value={form.targetPoints}
              onChange={(e) =>
                setForm({ ...form, targetPoints: Math.max(1, parseInt(e.target.value, 10) || 11) })
              }
              className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 ${
                isTournamentLocked
                  ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}
            />
          </div>

          {/* Tournament & Playoff Options */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-600" />
                <div>
                  <span className="block font-black text-slate-900 text-xs uppercase tracking-wider">
                    Tournament Mode
                  </span>
                  <span className="block text-[11px] font-semibold text-slate-500">
                    {form.tournamentMode?.enabled
                      ? `${form.tournamentMode.totalRounds} Pool Rounds`
                      : 'Casual open rotation'}
                  </span>
                </div>
              </div>

              {!isTournamentLocked && (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(form.tournamentMode?.enabled)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm({
                          ...form,
                          tournamentMode: {
                            enabled: true,
                            totalRounds: form.tournamentMode?.totalRounds || 6,
                            locked: false,
                            bracketCutoff: form.tournamentMode?.bracketCutoff,
                          },
                        });
                      } else {
                        setForm({
                          ...form,
                          tournamentMode: undefined,
                        });
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              )}
            </div>

            {form.tournamentMode?.enabled && (
              <div className="pt-2 border-t border-slate-200/80 space-y-3">
                {/* Tournament Format Choice */}
                <div>
                  <label className="block font-black text-indigo-950 text-xs uppercase tracking-wider mb-1.5">
                    Tournament Format
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      disabled={isTournamentLocked}
                      onClick={() =>
                        setForm({
                          ...form,
                          tournamentMode: {
                            ...form.tournamentMode!,
                            tournamentFormat: 'round_robin',
                            bracketCutoff: undefined,
                          },
                        })
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        (!form.tournamentMode.tournamentFormat || form.tournamentMode.tournamentFormat === 'round_robin')
                          ? 'bg-amber-50 border-amber-400 text-amber-950 ring-1 ring-amber-400'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      } ${isTournamentLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs">Round Robin</span>
                        {(!form.tournamentMode.tournamentFormat || form.tournamentMode.tournamentFormat === 'round_robin') && (
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Fixed rounds with all active players rotating fairly across courts.
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={isTournamentLocked}
                      onClick={() =>
                        setForm({
                          ...form,
                          tournamentMode: {
                            ...form.tournamentMode!,
                            tournamentFormat: 'round_robin_to_bracket',
                            bracketCutoff: form.tournamentMode.bracketCutoff || 4,
                          },
                        })
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        form.tournamentMode.tournamentFormat === 'round_robin_to_bracket'
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-950 ring-1 ring-indigo-400'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      } ${isTournamentLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs">Round Robin → Bracket</span>
                        {form.tournamentMode.tournamentFormat === 'round_robin_to_bracket' && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Pool rounds first, then top seeds advance to single-elimination bracket.
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={isTournamentLocked}
                      onClick={() =>
                        setForm({
                          ...form,
                          tournamentMode: {
                            ...form.tournamentMode!,
                            tournamentFormat: 'group_double_bracket',
                            finalsFormat: form.tournamentMode.finalsFormat || 'single_final',
                          },
                        })
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        form.tournamentMode.tournamentFormat === 'group_double_bracket'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-950 ring-1 ring-emerald-400'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      } ${isTournamentLocked ? 'cursor-not-allowed opacity-80' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-xs">Groups → Winners/Losers Bracket</span>
                        {form.tournamentMode.tournamentFormat === 'group_double_bracket' && (
                          <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Balanced group pools. 1st seeds to Winners Bracket, 2nd seeds to Losers Bracket, meeting in Grand Final.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Pool Rounds Count */}
                {(!form.tournamentMode.tournamentFormat || form.tournamentMode.tournamentFormat !== 'group_double_bracket') && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold text-slate-700">Total Pool Rounds:</span>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      disabled={isTournamentLocked}
                      value={form.tournamentMode.totalRounds}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          tournamentMode: {
                            ...form.tournamentMode!,
                            totalRounds: Math.max(1, parseInt(e.target.value, 10) || 1),
                          },
                        })
                      }
                      className={`w-14 px-2 py-1 text-center rounded-xl border text-xs font-black ${
                        isTournamentLocked
                          ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-white border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                )}

                {/* Specific options for Round Robin to Bracket */}
                {form.tournamentMode.tournamentFormat === 'round_robin_to_bracket' && (
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Swords className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-xs font-black text-slate-900">Playoff Bracket Cutoff:</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[2, 4, 8, 16].map((num) => (
                          <button
                            key={`config-cutoff-${num}`}
                            type="button"
                            disabled={isTournamentLocked}
                            onClick={() =>
                              setForm({
                                ...form,
                                tournamentMode: {
                                  ...form.tournamentMode!,
                                  bracketCutoff: num,
                                },
                              })
                            }
                            className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                              (form.tournamentMode?.bracketCutoff || 4) === num
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            Top {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Specific options for Group Double Bracket */}
                {form.tournamentMode.tournamentFormat === 'group_double_bracket' && (
                  <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">Grand Finals Format:</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={isTournamentLocked}
                        onClick={() =>
                          setForm({
                            ...form,
                            tournamentMode: {
                              ...form.tournamentMode!,
                              finalsFormat: 'single_final',
                            },
                          })
                        }
                        className={`p-2 rounded-lg text-left text-xs transition-all border cursor-pointer ${
                          (form.tournamentMode.finalsFormat || 'single_final') === 'single_final'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-black'
                            : 'bg-slate-50 border-slate-200 text-slate-700 font-semibold'
                        }`}
                      >
                        <span className="block font-bold">Single Final</span>
                        <span className="text-[10px] text-slate-500 font-medium block">1 championship match</span>
                      </button>

                      <button
                        type="button"
                        disabled={isTournamentLocked}
                        onClick={() =>
                          setForm({
                            ...form,
                            tournamentMode: {
                              ...form.tournamentMode!,
                              finalsFormat: 'true_double_elim',
                            },
                          })
                        }
                        className={`p-2 rounded-lg text-left text-xs transition-all border cursor-pointer ${
                          form.tournamentMode.finalsFormat === 'true_double_elim'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-black'
                            : 'bg-slate-50 border-slate-200 text-slate-700 font-semibold'
                        }`}
                      >
                        <span className="block font-bold">True Double-Elim</span>
                        <span className="text-[10px] text-slate-500 font-medium block">Reset match if losers champ wins</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
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
