import React, { useState } from 'react';
import { User, Sparkles, Check, ArrowRight } from 'lucide-react';
import { AVATAR_COLORS } from '../utils/sampleData';
import { initDeviceIdentity } from '../utils/identitySync';
import { PlayerProfile } from '../types';

interface IdentitySetupModalProps {
  isOpen: boolean;
  onComplete: (profile: PlayerProfile) => void;
  onClose?: () => void;
}

export const IdentitySetupModal: React.FC<IdentitySetupModalProps> = ({
  isOpen,
  onComplete,
  onClose,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError('Please enter a display name to continue.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const res = await initDeviceIdentity(trimmed, {
      avatarColor: selectedColor,
    });

    setIsSubmitting(false);

    if (res.success && res.profile) {
      onComplete(res.profile);
    } else {
      setError(res.error || 'Failed to save identity. Please try again.');
    }
  };

  const handleQuickName = (suggested: string) => {
    setDisplayName(suggested);
    setError(null);
  };

  return (
    <div
      id="identity-setup-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900">
        {/* Header Badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Player Profile Setup
          </span>
        </div>

        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          What should we call you?
        </h2>
        <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
          Set your display name once. Your player profile, club memberships, and match statistics
          will be saved to this device.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Avatar Color Picker Preview */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
              Choose Avatar Color
            </label>
            <div className="flex items-center gap-2.5 overflow-x-auto py-1">
              {AVATAR_COLORS.map((c) => {
                const isSelected = selectedColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                      isSelected ? 'ring-3 ring-indigo-600 ring-offset-2 scale-110 shadow-md' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Select color ${c}`}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Player Display Name
            </label>
            <div className="relative">
              <div
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-black shadow-xs"
                style={{ backgroundColor: selectedColor }}
              >
                {displayName.trim() ? displayName.trim().charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
              </div>
              <input
                type="text"
                autoFocus
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (error) setError(null);
                }}
                maxLength={40}
                placeholder="e.g. Alex, Sam R., Jordan"
                className="w-full text-sm font-semibold text-slate-900 bg-slate-50 rounded-2xl pl-12 pr-4 py-3.5 min-h-[48px] border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
              {error}
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !displayName.trim()}
              className="w-full py-3.5 min-h-[48px] px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Save Player Profile</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
