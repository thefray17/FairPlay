import React, { useState } from 'react';
import { UserPlus, X, AlertCircle } from 'lucide-react';

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPlayer: (name: string) => void;
}

export const AddPlayerModal: React.FC<AddPlayerModalProps> = ({
  isOpen,
  onClose,
  onAddPlayer,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
          >
            <X className="w-4 h-4" />
          </button>
        </div>

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
      </div>
    </div>
  );
};
