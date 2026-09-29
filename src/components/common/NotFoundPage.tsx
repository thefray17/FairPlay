import React, { useState } from 'react';
import {
  Home,
  Flame,
  ArrowLeft,
  RotateCcw,
  Search,
  Compass,
  LayoutGrid,
  Sparkles,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import { sanitizeSessionCode } from '../../utils/sessionSync';
import { soundFx } from '../../utils/audio';

interface NotFoundPageProps {
  currentPath?: string;
  onNavigateHome: () => void;
  onNavigateOpenPlay: () => void;
  onNavigateSession?: (sessionId: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  currentPath = window.location.pathname,
  onNavigateHome,
  onNavigateOpenPlay,
  onNavigateSession,
}) => {
  const [sessionInput, setSessionInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeSessionCode(sessionInput);
    if (!clean) {
      setErrorMsg('Please enter a valid 4-digit session PIN (e.g., 4821)');
      return;
    }
    setErrorMsg(null);
    soundFx.playWhistle();
    if (onNavigateSession) {
      onNavigateSession(clean);
    } else {
      window.location.href = `/?session=${encodeURIComponent(clean)}`;
    }
  };

  const handleGoHome = () => {
    soundFx.playPointChime();
    onNavigateHome();
  };

  const handleGoOpenPlay = () => {
    soundFx.playPointChime();
    onNavigateOpenPlay();
  };

  const handleGoBack = () => {
    soundFx.playPointChime();
    if (window.history.length > 1) {
      window.history.back();
    } else {
      onNavigateHome();
    }
  };

  return (
    <div
      id="fairplay-404-page"
      className="min-h-screen bg-linear-to-b from-indigo-950 via-slate-900 to-indigo-900 text-white flex flex-col justify-between p-4 sm:p-6 select-none"
    >
      {/* Top Bar / Branding */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-2 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-yellow-400 rounded-xl flex items-center justify-center shadow-md text-indigo-950 font-black">
            <RotateCcw className="w-5 h-5 text-indigo-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-white">FairPlay</span>
              <span className="text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-800 text-yellow-300 border border-indigo-600">
                Rotations
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoHome}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all cursor-pointer backdrop-blur-xs"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Home</span>
        </button>
      </header>

      {/* Main 404 Card */}
      <main className="max-w-xl mx-auto w-full my-auto py-8">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl space-y-6 text-center">
          {/* Animated 404 Badge */}
          <div className="relative inline-flex items-center justify-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-linear-to-tr from-yellow-400 to-amber-300 text-indigo-950 rounded-3xl flex items-center justify-center shadow-xl shadow-yellow-500/20 transform -rotate-3 hover:rotate-0 transition-transform">
              <Compass className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-950 animate-pulse" />
            </div>
            <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 bg-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-full shadow-md border-2 border-indigo-950">
              404
            </span>
          </div>

          {/* Heading & Context */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Out of Bounds!
            </h1>
            <p className="text-sm sm:text-base text-indigo-200/90 max-w-md mx-auto leading-relaxed">
              We couldn’t find the court or session you’re looking for. The link may be expired, mistyped, or moved.
            </p>
            {currentPath && currentPath !== '/' && (
              <div className="inline-block mt-2 px-3 py-1 bg-black/30 rounded-lg text-xs font-mono text-yellow-300/90 border border-white/10 max-w-full truncate">
                {currentPath}
              </div>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              id="btn-404-return-home"
              onClick={handleGoHome}
              className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-indigo-950 font-black text-sm transition-all shadow-lg hover:shadow-yellow-400/30 active:scale-98 cursor-pointer"
            >
              <Home className="w-4.5 h-4.5 text-indigo-950" />
              <span>Return to Home Page</span>
            </button>

            <button
              type="button"
              id="btn-404-goto-openplay"
              onClick={handleGoOpenPlay}
              className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm transition-all shadow-lg hover:shadow-emerald-500/30 active:scale-98 cursor-pointer"
            >
              <Flame className="w-4.5 h-4.5 fill-white text-white" />
              <span>Open Play Mode</span>
            </button>
          </div>

          {/* Join Session Direct Input Form */}
          <div className="border-t border-white/10 pt-5 space-y-2.5 text-left">
            <label
              htmlFor="input-404-session-code"
              className="block text-xs font-black uppercase tracking-wider text-indigo-200 flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5 text-yellow-400" />
              Looking for a specific session PIN?
            </label>
            <form onSubmit={handleSessionSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="input-404-session-code"
                  type="text"
                  maxLength={10}
                  placeholder="e.g. 4821"
                  value={sessionInput}
                  onChange={(e) => {
                    setSessionInput(e.target.value.toUpperCase());
                    setErrorMsg(null);
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-white placeholder:text-white/40 focus:outline-hidden focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 uppercase tracking-widest"
                />
              </div>
              <button
                type="submit"
                id="btn-404-join-session"
                className="px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Join</span>
              </button>
            </form>
            {errorMsg && (
              <p className="text-xs font-semibold text-rose-300 flex items-center gap-1">
                <span>⚠️</span> {errorMsg}
              </p>
            )}
          </div>

          {/* Secondary Go Back link */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleGoBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-300 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Go back to previous page</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center py-3 text-xs text-indigo-300/60 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-yellow-400/80" />
        <span>FairPlay Social &amp; Open Play Tournament Manager</span>
      </footer>
    </div>
  );
};
