import React, { useState, useEffect } from 'react';
import { Club, SportType } from '../../types';
import {
  createClub,
  joinClubByCode,
  getSavedClubsLocally,
  setActiveClubId,
  emitClubUpdated,
} from '../../utils/clubSync';
import { getDevicePlayerProfile } from '../../utils/identitySync';
import { QRCameraScanner } from '../QRCameraScanner';
import {
  Users,
  PlusCircle,
  QrCode,
  ArrowRight,
  Shield,
  Sparkles,
  Trophy,
  History,
  CheckCircle2,
  AlertCircle,
  Activity,
  Layers,
} from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface ClubLandingProps {
  onClubSelected: (club: Club) => void;
}

export const ClubLanding: React.FC<ClubLandingProps> = ({ onClubSelected }) => {
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [joinCode, setJoinCode] = useState('');
  const [clubName, setClubName] = useState('');
  const [sport, setSport] = useState<SportType>('badminton');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [savedClubs, setSavedClubs] = useState<Club[]>([]);

  const deviceProfile = getDevicePlayerProfile();

  useEffect(() => {
    setSavedClubs(getSavedClubsLocally());
  }, []);

  const handleJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = joinCode.trim();
    if (!clean) {
      setError('Please enter a 4-digit squad code');
      return;
    }

    setIsLoading(true);
    setError(null);

    const res = await joinClubByCode(clean);
    setIsLoading(false);

    if (res.success && res.club) {
      soundFx.playPointChime();
      onClubSelected(res.club);
    } else {
      setError(res.error || 'Club not found with this code. Please check and try again.');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = clubName.trim();
    if (!clean) {
      setError('Please enter a club or squad name');
      return;
    }

    setIsLoading(true);
    setError(null);

    const res = await createClub(clean, {
      sport,
      description: description.trim() || undefined,
    });
    setIsLoading(false);

    if (res.success && res.club) {
      soundFx.playPointChime();
      onClubSelected(res.club);
    } else {
      setError(res.error || 'Failed to create club. Please try again.');
    }
  };

  const handleQRScan = async (scannedText: string) => {
    setShowQRScanner(false);
    // Extract code from QR URL or plain text
    let code = scannedText.trim();
    try {
      const url = new URL(scannedText);
      const paramCode = url.searchParams.get('club') || url.searchParams.get('c') || url.searchParams.get('join');
      if (paramCode) code = paramCode;
    } catch {}

    setJoinCode(code);
    setIsLoading(true);
    setError(null);

    const res = await joinClubByCode(code);
    setIsLoading(false);

    if (res.success && res.club) {
      soundFx.playPointChime();
      onClubSelected(res.club);
    } else {
      setError(res.error || `Could not find club for code "${code}".`);
    }
  };

  const handleSelectSavedClub = (club: Club) => {
    setActiveClubId(club.id);
    emitClubUpdated(club, 'switched');
    soundFx.playPointChime();
    onClubSelected(club);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between">
      {/* Background Graphic Accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 py-6 sm:px-8 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-indigo-950 flex items-center justify-center font-black shadow-lg">
              <Trophy className="w-5 h-5 text-indigo-950" />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tight text-white flex items-center gap-2">
                FairPlay <span className="text-yellow-400 text-sm px-2 py-0.5 rounded-md bg-yellow-400/10 border border-yellow-400/30">Squads</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Club &amp; Rotation Engine</p>
            </div>
          </div>

          {deviceProfile && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] ${
                  deviceProfile.avatarColor || 'bg-indigo-600 text-white'
                }`}
              >
                {deviceProfile.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-slate-200 max-w-[100px] truncate">
                {deviceProfile.name}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-lg w-full mx-auto px-4 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        {/* Welcome Pitch */}
        <div className="text-center mb-8 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Play Fair. Track Stats. Rotate Easily.
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto font-medium">
            Join your group's club with a 4-digit code or create a new squad for regular sessions.
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/80 flex items-center mb-6 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setMode('join');
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
              mode === 'join'
                ? 'bg-yellow-400 text-indigo-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-4 h-4" />
            Join a Club
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setError(null);
            }}
            className={`flex-1 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
              mode === 'create'
                ? 'bg-yellow-400 text-indigo-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Create Club
          </button>
        </div>

        {/* Action Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl">
          {error && (
            <div className="mb-5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2.5 text-rose-300 text-xs font-semibold animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'join' ? (
            <form onSubmit={handleJoin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">
                  Enter 4-Digit Club Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    value={joinCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                      setJoinCode(val);
                      if (val.length === 4) {
                        // Auto-submit when exactly 4 digits entered
                        joinClubByCode(val).then((res) => {
                          if (res.success && res.club) {
                            soundFx.playPointChime();
                            onClubSelected(res.club);
                          }
                        });
                      }
                    }}
                    placeholder="e.g. 4821"
                    className="flex-1 bg-slate-900/90 border border-slate-700 rounded-2xl px-4 py-3.5 text-center text-xl font-mono font-black text-yellow-400 placeholder:text-slate-600 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 tracking-widest uppercase"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowQRScanner(true)}
                    className="px-4 py-3.5 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-bold flex items-center justify-center transition-all border border-slate-600 shadow-sm"
                    title="Scan Club QR"
                  >
                    <QrCode className="w-5 h-5 text-yellow-400" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-1.5">
                  Ask your organizer for their club code or scan their QR badge.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || !joinCode.trim()}
                className="w-full py-3.5 px-4 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-indigo-950 font-black text-sm transition-all shadow-lg hover:shadow-yellow-400/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-indigo-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Enter Club</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Club / Squad Name
                </label>
                <input
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  placeholder="e.g. Tuesday Night Badminton"
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-semibold text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Primary Sport
                </label>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value as SportType)}
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20"
                >
                  <option value="badminton">Badminton (21 pts)</option>
                  <option value="pickleball">Pickleball (11 pts)</option>
                  <option value="tennis">Tennis</option>
                  <option value="table-tennis">Table Tennis (11 pts)</option>
                  <option value="padel">Padel</option>
                  <option value="volleyball">Volleyball (25 pts)</option>
                  <option value="custom">Custom Sport</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Description / Schedule (Optional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Weekly social matches at South Court"
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-yellow-400"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !clubName.trim()}
                className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-indigo-950 font-black text-sm transition-all shadow-lg hover:shadow-yellow-400/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-indigo-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Create Squad &amp; Start</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Previously Joined / Saved Clubs List */}
        {savedClubs.length > 0 && (
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-yellow-400" />
                Your Clubs ({savedClubs.length})
              </span>
            </div>
            <div className="space-y-2">
              {savedClubs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectSavedClub(c)}
                  className="w-full text-left p-3.5 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-yellow-400/50 transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-900/80 border border-indigo-700 flex items-center justify-center text-yellow-400 font-black text-xs shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-200 group-hover:text-white truncate">
                        {c.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Code: <span className="text-yellow-400 font-bold">{c.code}</span> •{' '}
                        {c.memberProfileIds?.length || 0} members
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-yellow-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRCameraScanner
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      )}

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-slate-500 border-t border-slate-800/60">
        FairPlay • Equal Court Time &amp; Open Play Rotation
      </footer>
    </div>
  );
};
