import React, { useState } from 'react';
import { UserPlus, X, AlertCircle, Lock, User } from 'lucide-react';
import { getDevicePlayerProfile } from '../utils/identitySync';

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlayer: (name: string) => void;
  isLocked?: boolean;
  existingPlayerNames?: string[];
}

export const AddPlayerModal: React.FC<AddPlayerModalProps> = ({
  isOpen,
  onClose,
  onAddPlayer,
  isLocked = false,
  existingPlayerNames = [],
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const deviceProfile = getDevicePlayerProfile();
  const isDevicePlayerAlreadyInRoster =
    deviceProfile &&
    existingPlayerNames.some(
      (n) => n.trim().toLowerCase() === deviceProfile.name.trim().toLowerCase()
    );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      setError('Player list is locked for the current tournament.');
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Player name cannot be empty.');
      return;
    }
    onAddPlayer(trimmed);
    setName('');
    setError(null);
    onClose();
  };

  return (
    <div
      id="add-player-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-5 bg-yellow-400 rounded-full"></span>
            <UserPlus className="w-5 h-5 text-indigo-900" />
            <h3 className="font-black text-lg text-indigo-950">Add Player</h3>
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

        {isLocked ? (
          <div className="pt-4 space-y-4">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-black block text-sm">Player Roster Locked</span>
                <p className="mt-1 text-amber-900/90 font-medium">
                  Player list is locked for the current tournament to guarantee complete round-robin fairness across all scheduled rounds.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="pt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Player Full Name / Nickname
              </label>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                enterKeyHint="done"
                placeholder="Player name"
                className="w-full text-sm font-semibold text-slate-900 bg-slate-50 rounded-2xl px-4 py-3 min-h-[46px] border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              {deviceProfile && !isDevicePlayerAlreadyInRoster && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setName(deviceProfile.name);
                      if (error) setError(null);
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold border border-indigo-200 transition-colors cursor-pointer"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: deviceProfile.avatarColor || '#6366f1' }}
                    />
                    <span>Add Myself ({deviceProfile.name})</span>
                  </button>
                </div>
              )}
              <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                New players are automatically slotted into the equal rotation queue!
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 min-h-[42px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md hover:shadow-indigo-300 transition-all cursor-pointer active:scale-95"
              >
                Add to Roster
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
