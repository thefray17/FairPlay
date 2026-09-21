import React, { useState, useEffect, useMemo } from 'react';
import { Club, PlayerProfile } from '../../types';
import {
  fetchClubFromFirestore,
  fetchSessionFromFirestore,
  fetchAllPlayerProfilesFromFirestore,
  saveClubToFirestore,
} from '../../lib/firebase';
import {
  calculateClubLeaderboard,
  extractPersonalMatches,
  ClubLeaderboardRow,
  PersonalMatchRecord,
} from '../../utils/clubStats';
import { getDevicePlayerProfile } from '../../utils/identitySync';
import { SessionData, getSavedSessionsLocally } from '../../utils/sessionSync';
import {
  Trophy,
  Users,
  Play,
  QrCode,
  Copy,
  Check,
  Calendar,
  Layers,
  Activity,
  History,
  TrendingUp,
  Search,
  ArrowUpDown,
  PlusCircle,
  Share2,
  ExternalLink,
  ChevronRight,
  Shield,
  ArrowLeft,
} from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface ClubHomeProps {
  club: Club;
  onStartNewSession: () => void;
  onOpenSession: (sessionId: string) => void;
  onSwitchClub: () => void;
}

export const ClubHome: React.FC<ClubHomeProps> = ({
  club: initialClub,
  onStartNewSession,
  onOpenSession,
  onSwitchClub,
}) => {
  const [club, setClub] = useState<Club>(initialClub);
  const [activeTab, setActiveTab] = useState<'sessions' | 'leaderboard' | 'my_matches' | 'members'>('sessions');
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [sessionsData, setSessionsData] = useState<SessionData[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, PlayerProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'rank' | 'name' | 'mp' | 'won' | 'diff' | 'winRate'>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const currentProfile = getDevicePlayerProfile();

  // Refresh club and load session details
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        // 1. Fetch fresh club doc
        const clubRes = await fetchClubFromFirestore(initialClub.id);
        const activeClubDoc = (clubRes.success && clubRes.club) ? clubRes.club : initialClub;
        if (isMounted) setClub(activeClubDoc);

        // 2. Fetch player profiles
        const pMap = await fetchAllPlayerProfilesFromFirestore();
        if (isMounted) setProfilesMap(pMap);

        // 3. Load sessions
        const loadedSessions: SessionData[] = [];
        const sessionIds = activeClubDoc.sessionIds || [];
        const localSaved = getSavedSessionsLocally();

        for (const sId of sessionIds) {
          // Check local first
          const localMatch = localSaved[sId];
          if (localMatch) {
            loadedSessions.push(localMatch);
          } else {
            // Fetch from Firestore
            const sRes = await fetchSessionFromFirestore(sId);
            if (sRes.success && sRes.session) {
              loadedSessions.push(sRes.session);
            }
          }
        }

        if (isMounted) {
          // Sort latest session first
          loadedSessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setSessionsData(loadedSessions);
        }
      } catch (err) {
        console.warn('Error loading club home data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [initialClub.id]);

  // Compute club-wide leaderboard across all sessions
  const clubLeaderboard = useMemo(() => {
    return calculateClubLeaderboard(sessionsData, profilesMap);
  }, [sessionsData, profilesMap]);

  // Compute personal matches for the signed-in user profile
  const personalMatches = useMemo(() => {
    if (!currentProfile?.id) return [];
    return extractPersonalMatches(sessionsData, currentProfile.id);
  }, [sessionsData, currentProfile?.id]);

  // Filter and sort leaderboard
  const sortedLeaderboard = useMemo(() => {
    let list = [...clubLeaderboard];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => r.playerName.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let res = 0;
      switch (sortField) {
        case 'rank':
          return 0;
        case 'name':
          res = a.playerName.localeCompare(b.playerName);
          break;
        case 'mp':
          res = a.matchesPlayed - b.matchesPlayed;
          break;
        case 'won':
          res = a.won - b.won;
          break;
        case 'diff':
          res = a.pointDiff - b.pointDiff;
          break;
        case 'winRate':
          res = a.winRate - b.winRate;
          break;
      }
      return sortDirection === 'asc' ? res : -res;
    });

    return list;
  }, [clubLeaderboard, searchQuery, sortField, sortDirection]);

  const handleCopyCode = () => {
    try {
      navigator.clipboard.writeText(club.code);
      setCopiedCode(true);
      soundFx.playPointChime();
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {}
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Club Top Banner / Navigation */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Club Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onSwitchClub}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all shrink-0"
              title="Switch Squad"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base sm:text-xl text-white truncate">
                  {club.name}
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-yellow-400/10 border border-yellow-400/30 text-yellow-400 font-bold text-[10px] uppercase tracking-wider shrink-0">
                  {club.sport || 'Badminton'}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                {club.description || 'FairPlay Squad & Session Manager'}
              </p>
            </div>
          </div>

          {/* Code & Start CTA */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Join Code Badge */}
            <button
              type="button"
              onClick={handleCopyCode}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-bold text-yellow-400 transition-all"
              title="Click to copy squad code"
            >
              <span className="text-slate-400 text-[10px]">CODE:</span>
              <span className="tracking-widest">{club.code}</span>
              {copiedCode ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {/* QR Code Button */}
            <button
              type="button"
              onClick={() => setShowQRModal(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all"
              title="Show Squad QR Code"
            >
              <QrCode className="w-4 h-4 text-yellow-400" />
            </button>

            {/* Start New Session CTA */}
            <button
              type="button"
              onClick={onStartNewSession}
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-indigo-950 font-black text-xs sm:text-sm transition-all shadow-md flex items-center gap-1.5 shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-indigo-950 text-indigo-950" />
              <span>Start Session</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 space-y-6">
        {/* Navigation Tabs */}
        <div className="bg-slate-800/80 p-1 rounded-2xl border border-slate-700/80 flex items-center gap-1 overflow-x-auto shadow-inner text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'sessions'
                ? 'bg-yellow-400 text-indigo-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Sessions ({sessionsData.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'leaderboard'
                ? 'bg-yellow-400 text-indigo-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Club Leaderboard</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('my_matches')}
            className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'my_matches'
                ? 'bg-yellow-400 text-indigo-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>My Matches ({personalMatches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${
              activeTab === 'members'
                ? 'bg-yellow-400 text-indigo-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Squad ({club.memberProfileIds?.length || 0})</span>
          </button>
        </div>

        {/* TAB 1: SESSIONS LIST */}
        {activeTab === 'sessions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-yellow-400" />
                Squad Sessions &amp; History
              </h2>
              <button
                type="button"
                onClick={onStartNewSession}
                className="text-xs font-bold text-yellow-400 hover:text-yellow-300 flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                New Session
              </button>
            </div>

            {sessionsData.length === 0 ? (
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-10 text-center space-y-4 max-w-md mx-auto my-6">
                <div className="w-14 h-14 rounded-2xl bg-yellow-400/20 border border-yellow-400/40 text-yellow-400 flex items-center justify-center mx-auto shadow-md">
                  <Play className="w-6 h-6 fill-yellow-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">No Sessions Yet</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Start your first session for {club.name} to rotate players and log match scores.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onStartNewSession}
                  className="py-3 px-6 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-indigo-950 font-black text-xs transition-all shadow-md inline-flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-indigo-950 text-indigo-950" />
                  <span>Start First Session</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {sessionsData.map((s) => {
                  const name = s.config?.sessionName || s.openPlay?.config?.sessionName || `Session #${s.id}`;
                  const sport = s.config?.sport || s.openPlay?.config?.sport || 'badminton';
                  const isOp = !!s.openPlay;
                  const isTourney = !!s.config?.tournamentMode?.enabled;
                  const roundsCount = s.rounds?.length || s.openPlay?.history?.length || 0;
                  const playerCount = s.players?.length || s.openPlay?.players?.length || 0;
                  const courtsCount = s.config?.courtsCount || s.openPlay?.config?.courtsCount || 2;
                  const dateStr = s.createdAt
                    ? new Date(s.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Recent';

                  return (
                    <div
                      key={s.id}
                      className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-yellow-400/50 rounded-3xl p-5 transition-all flex flex-col justify-between group shadow-sm"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-900 text-yellow-400 border border-slate-700">
                            #{s.id}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            {dateStr}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-black text-sm sm:text-base text-white group-hover:text-yellow-400 transition-colors truncate">
                            {name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800">
                              {isOp ? 'Open Play' : isTourney ? 'Tournament' : 'Social Rotation'}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-700 text-slate-300">
                              {courtsCount} Courts
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-700 text-slate-300">
                              {playerCount} Players
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-700 text-slate-300">
                              {roundsCount} {isOp ? 'Matches' : 'Rounds'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-slate-700/60 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-medium">
                          {s.updatedAt ? `Updated ${new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Ready'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenSession(s.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-indigo-950 font-black text-xs transition-all flex items-center gap-1 shadow-sm"
                        >
                          <span>Open Session</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CLUB LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-800/80 p-4 rounded-3xl border border-slate-700/80">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  Club-Wide All-Time Standings
                </h2>
                <p className="text-xs text-slate-400">
                  Aggregated stats across all {sessionsData.length} sessions in this squad.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search player..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400"
                />
              </div>
            </div>

            {sortedLeaderboard.length === 0 ? (
              <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-8 text-center text-slate-400 text-xs font-semibold">
                No match stats recorded in this squad yet. Completed matches will show here automatically!
              </div>
            ) : (
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl overflow-hidden shadow-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/80 border-b border-slate-700 text-slate-400 uppercase tracking-wider text-[10px] font-black">
                        <th className="py-3 px-4 text-center w-12">#</th>
                        <th className="py-3 px-4">Player</th>
                        <th
                          className="py-3 px-3 text-center cursor-pointer hover:text-white"
                          onClick={() => handleSort('mp')}
                        >
                          <span className="flex items-center justify-center gap-1">
                            MP <ArrowUpDown className="w-3 h-3 text-slate-500" />
                          </span>
                        </th>
                        <th
                          className="py-3 px-3 text-center cursor-pointer hover:text-white"
                          onClick={() => handleSort('won')}
                        >
                          <span className="flex items-center justify-center gap-1">
                            W-L <ArrowUpDown className="w-3 h-3 text-slate-500" />
                          </span>
                        </th>
                        <th
                          className="py-3 px-3 text-center cursor-pointer hover:text-white"
                          onClick={() => handleSort('diff')}
                        >
                          <span className="flex items-center justify-center gap-1">
                            Diff <ArrowUpDown className="w-3 h-3 text-slate-500" />
                          </span>
                        </th>
                        <th
                          className="py-3 px-3 text-center cursor-pointer hover:text-white"
                          onClick={() => handleSort('winRate')}
                        >
                          <span className="flex items-center justify-center gap-1">
                            Win % <ArrowUpDown className="w-3 h-3 text-slate-500" />
                          </span>
                        </th>
                        <th className="py-3 px-4 text-center">Form</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60 font-medium">
                      {sortedLeaderboard.map((row, idx) => {
                        const isUser = row.playerProfileId === currentProfile?.id;
                        return (
                          <tr
                            key={row.playerProfileId}
                            className={`hover:bg-slate-700/50 transition-colors ${
                              isUser ? 'bg-yellow-400/10 font-bold' : ''
                            }`}
                          >
                            <td className="py-3.5 px-4 text-center font-black">
                              {idx === 0 ? (
                                <span className="text-yellow-400">🥇 1</span>
                              ) : idx === 1 ? (
                                <span className="text-slate-300">🥈 2</span>
                              ) : idx === 2 ? (
                                <span className="text-amber-600">🥉 3</span>
                              ) : (
                                <span className="text-slate-400">{idx + 1}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${
                                    row.avatarColor || 'bg-indigo-600 text-white'
                                  }`}
                                >
                                  {row.playerName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="text-slate-100 font-bold flex items-center gap-1.5">
                                    {row.playerName}
                                    {isUser && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-yellow-400 text-indigo-950 font-black">
                                        YOU
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {row.totalSessionsPlayed} {row.totalSessionsPlayed === 1 ? 'session' : 'sessions'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-center text-slate-300 font-bold">
                              {row.matchesPlayed}
                            </td>
                            <td className="py-3.5 px-3 text-center font-bold">
                              <span className="text-emerald-400">{row.won}</span> -{' '}
                              <span className="text-rose-400">{row.lost}</span>
                            </td>
                            <td className="py-3.5 px-3 text-center font-bold">
                              <span
                                className={
                                  row.pointDiff > 0
                                    ? 'text-emerald-400'
                                    : row.pointDiff < 0
                                    ? 'text-rose-400'
                                    : 'text-slate-400'
                                }
                              >
                                {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center font-black text-yellow-400">
                              {row.winRate}%
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {row.recentForm.length === 0 ? (
                                  <span className="text-slate-500 text-[10px]">-</span>
                                ) : (
                                  row.recentForm.map((f, i) => (
                                    <span
                                      key={i}
                                      className={`w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-black ${
                                        f === 'W'
                                          ? 'bg-emerald-500 text-white'
                                          : f === 'L'
                                          ? 'bg-rose-500 text-white'
                                          : 'bg-amber-500 text-white'
                                      }`}
                                    >
                                      {f}
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY MATCHES */}
        {activeTab === 'my_matches' && (
          <div className="space-y-4">
            <div className="bg-slate-800/80 p-4 rounded-3xl border border-slate-700/80 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-yellow-400" />
                  My Match History ({currentProfile?.name || 'Player'})
                </h2>
                <p className="text-xs text-slate-400">
                  Every match you played across all sessions in {club.name}.
                </p>
              </div>
            </div>

            {personalMatches.length === 0 ? (
              <div className="bg-slate-800/60 border border-slate-700 rounded-3xl p-10 text-center space-y-2 max-w-md mx-auto my-6">
                <History className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <h3 className="font-bold text-white text-sm">No matches logged yet</h3>
                <p className="text-xs text-slate-400">
                  When you play in a session under this squad, your match scores and partner stats will appear here automatically!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {personalMatches.map((m) => {
                  const isWin = m.result === 'W';
                  const isLoss = m.result === 'L';
                  const isDraw = m.result === 'D';

                  return (
                    <div
                      key={m.matchId}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isWin
                          ? 'bg-emerald-950/20 border-emerald-800/60'
                          : isLoss
                          ? 'bg-rose-950/20 border-rose-800/60'
                          : 'bg-slate-800/80 border-slate-700'
                      }`}
                    >
                      {/* Left Side: Session & Team breakdown */}
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                              isWin
                                ? 'bg-emerald-500 text-white'
                                : isLoss
                                ? 'bg-rose-500 text-white'
                                : isDraw
                                ? 'bg-amber-500 text-white'
                                : 'bg-indigo-500 text-white'
                            }`}
                          >
                            {isWin ? 'WON' : isLoss ? 'LOST' : isDraw ? 'DRAW' : 'IN PLAY'}
                          </span>
                          <span className="text-xs font-bold text-slate-300 truncate">
                            {m.sessionName}
                          </span>
                          {m.courtNumber && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              • Court {m.courtNumber}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-200 flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-yellow-400">You</span>
                          {m.partnerNames.length > 0 && (
                            <>
                              <span className="text-slate-400">&amp;</span>
                              <span className="font-semibold text-slate-200">
                                {m.partnerNames.join(', ')}
                              </span>
                            </>
                          )}
                          <span className="text-slate-500 px-1 font-bold">vs</span>
                          <span className="font-semibold text-slate-300">
                            {m.opponentNames.join(', ') || 'Opponents'}
                          </span>
                        </div>
                      </div>

                      {/* Right Side: Score */}
                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <div className="flex items-center gap-1.5 font-mono text-base font-black">
                          <span
                            className={
                              isWin
                                ? 'text-emerald-400 text-lg'
                                : 'text-slate-300'
                            }
                          >
                            {m.userTeamScore}
                          </span>
                          <span className="text-slate-600">-</span>
                          <span
                            className={
                              isLoss
                                ? 'text-rose-400 text-lg'
                                : 'text-slate-300'
                            }
                          >
                            {m.opponentTeamScore}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SQUAD MEMBERS */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-800/80 p-4 rounded-3xl border border-slate-700/80">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-yellow-400" />
                  Squad Roster ({club.memberProfileIds?.length || 0} Members)
                </h2>
                <p className="text-xs text-slate-400">
                  All player profiles linked to {club.name}.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowQRModal(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-yellow-400 font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <Share2 className="w-3.5 h-3.5" />
                Invite Member
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(club.memberProfileIds || []).map((profId) => {
                const profile = profilesMap[profId];
                const name = profile?.name || 'Member';
                const avatar = profile?.avatarColor || 'bg-indigo-600 text-white';
                const isUser = profId === currentProfile?.id;
                const matchesPlayed = profile?.matchesPlayed || 0;
                const matchesWon = profile?.wins || 0;
                const matchesLost = profile?.losses || 0;
                const winRate =
                  matchesPlayed > 0
                    ? Math.round((matchesWon / matchesPlayed) * 100)
                    : 0;

                return (
                  <div
                    key={profId}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isUser
                        ? 'bg-yellow-400/10 border-yellow-400/40'
                        : 'bg-slate-800/80 border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${avatar}`}
                      >
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                          {name}
                          {isUser && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-yellow-400 text-indigo-950 font-black">
                              YOU
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {matchesPlayed} Matches • {winRate}% Win
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-emerald-400">
                        {matchesWon}W
                      </span>{' '}
                      <span className="text-xs text-slate-500 font-bold">/</span>{' '}
                      <span className="text-xs font-black text-rose-400">
                        {matchesLost}L
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* QR Code Share Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white text-base">Squad Join Code &amp; QR</h3>
              <button
                type="button"
                onClick={() => setShowQRModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl inline-block shadow-lg mx-auto">
              {/* QR Code generated using public QR API */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  `${window.location.origin}${window.location.pathname}?club=${club.code}`
                )}`}
                alt={`QR code for club ${club.name}`}
                className="w-48 h-48 rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-1">Squad Code</p>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-2xl font-black text-yellow-400 tracking-widest">
                  {club.code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  title="Copy Code"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Other players can scan this QR or type code <strong className="text-white">{club.code}</strong> on their device to join {club.name}.
            </p>

            <button
              type="button"
              onClick={() => setShowQRModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
