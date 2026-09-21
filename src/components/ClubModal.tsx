import React, { useState, useEffect } from 'react';
import { Club, SportType, PlayerProfile } from '../types';
import {
  createClub,
  joinClubByCode,
  getActiveClub,
  getSavedClubsLocally,
  setActiveClubId,
  saveClubLocally,
  emitClubUpdated,
  fetchClubSessions,
  CLUB_UPDATED_EVENT,
} from '../utils/clubSync';
import { SessionData } from '../utils/sessionSync';
import { fetchPlayerProfilesByIds } from '../lib/firebase';
import {
  Users,
  Shield,
  Plus,
  LogIn,
  Copy,
  Check,
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink,
  Sparkles,
  X,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

interface ClubModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string;
  onSwitchSession?: (sessionId: string) => void;
  onNewSessionInClub?: () => void;
}

export const ClubModal: React.FC<ClubModalProps> = ({
  isOpen,
  onClose,
  currentSessionId,
  onSwitchSession,
  onNewSessionInClub,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'create' | 'join' | 'list'>('overview');
  const [currentClub, setCurrentClub] = useState<Club | null>(null);
  const [savedClubs, setSavedClubs] = useState<Club[]>([]);
  const [clubSessions, setClubSessions] = useState<SessionData[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, PlayerProfile>>({});
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Form states
  const [newClubName, setNewClubName] = useState('');
  const [newClubSport, setNewClubSport] = useState<SportType>('badminton');
  const [newClubDesc, setNewClubDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Load active club & saved clubs
  useEffect(() => {
    if (!isOpen) return;
    refreshClubState();

    const handleClubUpdate = () => {
      refreshClubState();
    };

    window.addEventListener(CLUB_UPDATED_EVENT, handleClubUpdate);
    return () => {
      window.removeEventListener(CLUB_UPDATED_EVENT, handleClubUpdate);
    };
  }, [isOpen]);

  const refreshClubState = async () => {
    const club = await getActiveClub();
    setCurrentClub(club);
    const list = getSavedClubsLocally();
    setSavedClubs(list);

    if (club) {
      setActiveTab('overview');
      loadSessionsForClub(club.id, club.memberProfileIds);
    } else if (list.length > 0) {
      setActiveTab('list');
    } else {
      setActiveTab('create');
    }
  };

  const loadSessionsForClub = async (clubId: string, memberProfileIds?: string[]) => {
    setIsLoadingSessions(true);
    try {
      const sessions = await fetchClubSessions(clubId);
      setClubSessions(sessions);
    } catch {
      setClubSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }

    if (memberProfileIds && memberProfileIds.length > 0) {
      setIsLoadingMembers(true);
      try {
        const map = await fetchPlayerProfilesByIds(memberProfileIds);
        setMemberProfiles(map);
      } catch {
      } finally {
        setIsLoadingMembers(false);
      }
    }
  };

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClubName.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await createClub(newClubName, {
      sport: newClubSport,
      description: newClubDesc,
      initialSessionId: currentSessionId,
    });

    setIsSubmitting(false);
    if (res.success && res.club) {
      setCurrentClub(res.club);
      setNewClubName('');
      setNewClubDesc('');
      setActiveTab('overview');
      loadSessionsForClub(res.club.id);
    } else {
      setErrorMessage(res.error || 'Failed to create squad');
    }
  };

  const handleJoinClub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await joinClubByCode(joinCode);
    setIsSubmitting(false);

    if (res.success && res.club) {
      setCurrentClub(res.club);
      setJoinCode('');
      setActiveTab('overview');
      loadSessionsForClub(res.club.id);
    } else {
      setErrorMessage(res.error || 'Failed to join squad');
    }
  };

  const handleCopyCode = () => {
    if (!currentClub?.code) return;
    navigator.clipboard.writeText(currentClub.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSelectClub = (club: Club) => {
    setActiveClubId(club.id);
    setCurrentClub(club);
    emitClubUpdated(club, 'switched');
    setActiveTab('overview');
    loadSessionsForClub(club.id);
  };

  const handleLeaveClub = () => {
    setActiveClubId(null);
    setCurrentClub(null);
    emitClubUpdated(null, 'cleared');
    setActiveTab('list');
  };

  if (!isOpen) return null;

  return (
    <div
      id="club-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="club-modal-container"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                Club & Squad Hub
              </h2>
              <p className="text-xs text-slate-400">
                Persistent squads owning sessions & player identity
              </p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-club-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-3 pt-2 shrink-0 gap-1 overflow-x-auto scrollbar-none">
          {currentClub && (
            <button
              type="button"
              id="tab-club-overview"
              onClick={() => {
                setActiveTab('overview');
                setErrorMessage(null);
              }}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'overview'
                  ? 'bg-white text-indigo-600 border-t-2 border-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Active Squad
            </button>
          )}

          <button
            type="button"
            id="tab-club-join"
            onClick={() => {
              setActiveTab('join');
              setErrorMessage(null);
            }}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'join'
                ? 'bg-white text-indigo-600 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Join with Code
          </button>

          <button
            type="button"
            id="tab-club-create"
            onClick={() => {
              setActiveTab('create');
              setErrorMessage(null);
            }}
            className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'create'
                ? 'bg-white text-indigo-600 border-t-2 border-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            New Squad
          </button>

          {savedClubs.length > 0 && (
            <button
              type="button"
              id="tab-club-list"
              onClick={() => {
                setActiveTab('list');
                setErrorMessage(null);
              }}
              className={`px-3 py-2 text-xs font-bold rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'list'
                  ? 'bg-white text-indigo-600 border-t-2 border-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              My Squads ({savedClubs.length})
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {errorMessage}
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && currentClub && (
            <div className="space-y-4 animate-in fade-in-50">
              {/* Squad Header Card */}
              <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-900 tracking-tight">
                        {currentClub.name}
                      </h3>
                      {currentClub.sport && (
                        <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                          {currentClub.sport}
                        </span>
                      )}
                    </div>
                    {currentClub.description && (
                      <p className="text-xs text-slate-600 mt-1">{currentClub.description}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Created {new Date(currentClub.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* 4-digit Join Code Pin */}
                  <div className="bg-white border-2 border-indigo-200 rounded-xl p-2.5 text-center shadow-xs shrink-0">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                      Join PIN
                    </span>
                    <span className="text-xl font-black font-mono tracking-widest text-indigo-600 block">
                      {currentClub.code}
                    </span>
                    <button
                      type="button"
                      id="btn-copy-club-code"
                      onClick={handleCopyCode}
                      className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:text-indigo-600 cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {copiedCode ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Squad Stats Bar */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-indigo-100/80">
                  <div className="bg-white/80 rounded-lg p-2 border border-slate-200/60">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Sessions</span>
                    <span className="text-base font-black text-slate-900">{currentClub.sessionIds?.length || 1}</span>
                  </div>
                  <div className="bg-white/80 rounded-lg p-2 border border-slate-200/60">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Member Profiles</span>
                    <span className="text-base font-black text-slate-900">{currentClub.memberProfileIds?.length || 0}</span>
                  </div>
                </div>
              </div>

              {/* Owned Sessions Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    Squad Sessions
                  </h4>
                  <div className="flex items-center gap-2">
                    {onNewSessionInClub && (
                      <button
                        type="button"
                        id="btn-new-session-in-club"
                        onClick={onNewSessionInClub}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        New Session
                      </button>
                    )}
                    <button
                      type="button"
                      id="btn-refresh-sessions"
                      onClick={() => loadSessionsForClub(currentClub.id)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
                      title="Refresh sessions list"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingSessions ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Sessions list */}
                <div className="space-y-1.5">
                  {currentClub.sessionIds && currentClub.sessionIds.length > 0 ? (
                    currentClub.sessionIds.map((sid) => {
                      const isActive = sid.toUpperCase() === currentSessionId.toUpperCase();
                      const sessionMeta = clubSessions.find((s) => s.id.toUpperCase() === sid.toUpperCase());

                      return (
                        <div
                          key={sid}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                            isActive
                              ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-xs text-slate-900">
                                PIN: {sid}
                              </span>
                              {isActive ? (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-indigo-600 text-white tracking-wider">
                                  Current Active
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {sessionMeta?.config?.sessionName || 'Tournament Session'}
                              {sessionMeta?.players?.length ? ` • ${sessionMeta.players.length} players` : ''}
                            </p>
                          </div>

                          {!isActive && onSwitchSession && (
                            <button
                              type="button"
                              id={`btn-switch-session-${sid}`}
                              onClick={() => onSwitchSession(sid)}
                              className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors shrink-0 cursor-pointer"
                            >
                              Open
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center border border-dashed border-slate-200 rounded-xl">
                      <p className="text-xs text-slate-500">
                        Current session ({currentSessionId}) is linked to this squad.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Squad Members & Cross-Session Stats Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    Squad Members & Career Stats
                  </h4>
                  {isLoadingMembers && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Loading stats...
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {currentClub.memberProfileIds && currentClub.memberProfileIds.length > 0 ? (
                    currentClub.memberProfileIds.map((pId) => {
                      const profile = memberProfiles[pId];
                      const name = profile?.name || pId;
                      const matches = profile?.matchesPlayed || 0;
                      const wins = profile?.wins || 0;
                      const losses = profile?.losses || 0;
                      const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
                      const avatarColor = profile?.avatarColor || 'bg-indigo-500 text-white';

                      return (
                        <div
                          key={pId}
                          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 flex items-center justify-between transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${avatarColor}`}
                            >
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">{name}</p>
                              <p className="text-[10px] text-slate-400">
                                {matches > 0 ? `${matches} cross-session matches` : 'New member'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className="text-xs font-black text-slate-800">
                                {wins}W - {losses}L
                              </span>
                              <span className="text-[10px] text-slate-400 block font-medium">
                                {winRate}% win rate
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-3.5 text-center border border-dashed border-slate-200 rounded-xl">
                      <p className="text-xs text-slate-500">
                        No members added to this squad yet. When players join court sessions in this squad, their profiles will link here automatically.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  id="btn-leave-club"
                  onClick={handleLeaveClub}
                  className="text-xs font-semibold text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                >
                  Switch / Leave Squad
                </button>
                <button
                  type="button"
                  id="btn-done-club"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CREATE CLUB */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateClub} className="space-y-4 animate-in fade-in-50">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Squad / Club Name
                </label>
                <input
                  type="text"
                  id="input-new-club-name"
                  value={newClubName}
                  onChange={(e) => setNewClubName(e.target.value)}
                  placeholder="e.g. Tuesday Night Badminton"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Sport
                </label>
                <select
                  id="select-new-club-sport"
                  value={newClubSport}
                  onChange={(e) => setNewClubSport(e.target.value as SportType)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                >
                  <option value="badminton">Badminton</option>
                  <option value="pickleball">Pickleball</option>
                  <option value="tennis">Tennis</option>
                  <option value="table-tennis">Table Tennis</option>
                  <option value="padel">Padel</option>
                  <option value="volleyball">Volleyball</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Schedule (Optional)
                </label>
                <input
                  type="text"
                  id="input-new-club-desc"
                  value={newClubDesc}
                  onChange={(e) => setNewClubDesc(e.target.value)}
                  placeholder="e.g. Weekly social session at Central Sports Hall"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900 leading-relaxed">
                <span className="font-bold">Automatic 4-Digit Join PIN:</span> Creating a squad creates a persistent club document in Firestore and assigns a memorable 4-digit code. Your current session will be owned by this squad.
              </div>

              <button
                type="submit"
                id="btn-submit-create-club"
                disabled={isSubmitting || !newClubName.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Creating Squad...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create Squad & Generate PIN
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: JOIN CLUB */}
          {activeTab === 'join' && (
            <form onSubmit={handleJoinClub} className="space-y-4 animate-in fade-in-50">
              <div className="text-center">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Enter 4-Digit Squad Code
                </label>
                <input
                  type="text"
                  id="input-join-club-code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 8))}
                  placeholder="e.g. 4821"
                  className="w-48 mx-auto text-center font-mono font-black text-3xl py-3 px-4 rounded-xl border-2 border-indigo-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 tracking-widest uppercase bg-slate-50"
                  required
                />
                <p className="text-xs text-slate-400 mt-2">
                  Ask your organizer for the 4-digit squad code.
                </p>
              </div>

              <button
                type="submit"
                id="btn-submit-join-club"
                disabled={isSubmitting || joinCode.trim().length < 4}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Joining Squad...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Join Squad
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 4: MY CLUBS LIST */}
          {activeTab === 'list' && (
            <div className="space-y-3 animate-in fade-in-50">
              <p className="text-xs text-slate-500 font-medium">
                Select a squad to switch your active group context:
              </p>

              <div className="space-y-2">
                {savedClubs.map((club) => {
                  const isSelected = currentClub?.id === club.id;
                  return (
                    <div
                      key={club.id}
                      onClick={() => handleSelectClub(club)}
                      className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-200'
                          : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{club.name}</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            PIN: {club.code}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {club.sessionIds?.length || 0} sessions • {club.sport || 'Sports'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 text-indigo-600 text-xs font-bold">
                        {isSelected ? 'Active' : 'Select'}
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  id="btn-list-create-new"
                  onClick={() => setActiveTab('create')}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Another Squad
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
