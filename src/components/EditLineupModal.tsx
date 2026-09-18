import React, { useState, useMemo } from 'react';
import { Player } from '../types';
import {
  Users,
  X,
  Check,
  ArrowRightLeft,
  AlertCircle,
  Sparkles,
  Search,
  UserPlus,
  RotateCcw,
  Link2,
  Trash2,
  Shuffle,
  Clock,
  ShieldCheck,
} from 'lucide-react';

export interface LineupPlayerItem {
  id: string;
  name: string;
  avatarColor: string;
  duoPartnerId?: string | null;
  active?: boolean;
  gamesPlayed?: number;
  joinedAtRound?: number;
  status?: string;
  currentStreak?: number;
}

interface EditLineupModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  playersPerTeam: number;
  allActivePlayers: (Player | LineupPlayerItem)[];
  initialTeam1: string[];
  initialTeam2: string[];
  onSave: (team1: string[], team2: string[]) => void;
  onResetToAuto?: () => void;
  isOverridden?: boolean;
  prioritizedBenchPlayerIds?: string[];
  playerMatchCounts?: Record<string, number>;
  partnerCounts?: Record<string, Record<string, number>>;
}

export const EditLineupModal: React.FC<EditLineupModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  playersPerTeam,
  allActivePlayers,
  initialTeam1,
  initialTeam2,
  onSave,
  onResetToAuto,
  isOverridden,
  prioritizedBenchPlayerIds = [],
  playerMatchCounts = {},
  partnerCounts,
}) => {
  // Normalize initial team arrays to match playersPerTeam length
  const [team1, setTeam1] = useState<string[]>(() => {
    const arr = [...initialTeam1];
    while (arr.length < playersPerTeam) arr.push('');
    return arr.slice(0, playersPerTeam);
  });

  const [team2, setTeam2] = useState<string[]>(() => {
    const arr = [...initialTeam2];
    while (arr.length < playersPerTeam) arr.push('');
    return arr.slice(0, playersPerTeam);
  });

  // Track which slot is currently selected for assignment
  const [selectedSlot, setSelectedSlot] = useState<{ team: 1 | 2; index: number }>(() => {
    // Default to the first empty slot if any, otherwise Team 1 Slot 0
    const emptyT1 = initialTeam1.findIndex((id) => !id);
    if (emptyT1 !== -1 && emptyT1 < playersPerTeam) return { team: 1, index: emptyT1 };
    const emptyT2 = initialTeam2.findIndex((id) => !id);
    if (emptyT2 !== -1 && emptyT2 < playersPerTeam) return { team: 2, index: emptyT2 };
    return { team: 1, index: 0 };
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'bench' | 'duo'>('all');
  const [error, setError] = useState<string | null>(null);

  const playersMap = useMemo(() => {
    const map = new Map<string, Player | LineupPlayerItem>();
    for (const p of allActivePlayers) {
      map.set(p.id, p);
    }
    return map;
  }, [allActivePlayers]);

  if (!isOpen) return null;

  const currentAssignedIds = new Set([...team1, ...team2].filter(Boolean));

  // Determine the partner player in the current team (for 2v2 partner synergy)
  const currentTeamTarget = selectedSlot.team === 1 ? team1 : team2;
  const currentTeammateId = currentTeamTarget.find((id, i) => i !== selectedSlot.index && Boolean(id));
  const teammatePlayer = currentTeammateId ? playersMap.get(currentTeammateId) : null;

  // Filter and sort players for the selection palette
  const filteredPlayers = allActivePlayers.filter((p) => {
    if (searchQuery.trim()) {
      const matchName = p.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      if (!matchName) return false;
    }
    if (filterTab === 'bench') {
      return prioritizedBenchPlayerIds.includes(p.id);
    }
    if (filterTab === 'duo') {
      return teammatePlayer?.duoPartnerId === p.id || Boolean(p.duoPartnerId);
    }
    return true;
  });

  // Sort players smartly:
  // 1. Locked partner of current teammate first
  // 2. Prioritized bench players next (lowest GP first)
  // 3. Other players sorted by GP ascending, then name
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    // Duo partner boost
    if (teammatePlayer && teammatePlayer.duoPartnerId === a.id) return -1;
    if (teammatePlayer && teammatePlayer.duoPartnerId === b.id) return 1;

    // Bench priority boost
    const aIsBench = prioritizedBenchPlayerIds.includes(a.id);
    const bIsBench = prioritizedBenchPlayerIds.includes(b.id);
    if (aIsBench && !bIsBench) return -1;
    if (!aIsBench && bIsBench) return 1;

    // GP comparison
    const gpA = playerMatchCounts[a.id] ?? ('gamesPlayed' in a ? a.gamesPlayed : undefined) ?? 0;
    const gpB = playerMatchCounts[b.id] ?? ('gamesPlayed' in b ? b.gamesPlayed : undefined) ?? 0;
    if (gpA !== gpB) return gpA - gpB;

    return a.name.localeCompare(b.name);
  });

  // Assign player to currently selected slot
  const handleSelectPlayerForSlot = (playerId: string) => {
    setError(null);
    const { team, index } = selectedSlot;

    // Check if player is already assigned in another slot
    let newT1 = [...team1];
    let newT2 = [...team2];

    // If already in this slot, unassign
    if ((team === 1 && newT1[index] === playerId) || (team === 2 && newT2[index] === playerId)) {
      if (team === 1) newT1[index] = '';
      else newT2[index] = '';
      setTeam1(newT1);
      setTeam2(newT2);
      return;
    }

    // If player is already in another slot in this match, swap or vacate that slot
    const existingT1Index = newT1.indexOf(playerId);
    const existingT2Index = newT2.indexOf(playerId);

    const currentPlayerInTarget = team === 1 ? newT1[index] : newT2[index];

    if (existingT1Index !== -1) {
      newT1[existingT1Index] = currentPlayerInTarget || '';
    } else if (existingT2Index !== -1) {
      newT2[existingT2Index] = currentPlayerInTarget || '';
    }

    if (team === 1) {
      newT1[index] = playerId;
    } else {
      newT2[index] = playerId;
    }

    setTeam1(newT1);
    setTeam2(newT2);

    // Auto-advance to the next empty slot if one exists
    const nextSlot = findNextEmptySlot(newT1, newT2, team, index);
    if (nextSlot) {
      setSelectedSlot(nextSlot);
    }
  };

  const findNextEmptySlot = (
    t1: string[],
    t2: string[],
    currentTeam: 1 | 2,
    currentIndex: number
  ): { team: 1 | 2; index: number } | null => {
    // Check next slot in same team
    for (let i = currentIndex + 1; i < playersPerTeam; i++) {
      if (!t1[i] && currentTeam === 1) return { team: 1, index: i };
      if (!t2[i] && currentTeam === 2) return { team: 2, index: i };
    }
    // Check other team
    const otherTeam = currentTeam === 1 ? 2 : 1;
    const otherArr = otherTeam === 1 ? t1 : t2;
    for (let i = 0; i < playersPerTeam; i++) {
      if (!otherArr[i]) return { team: otherTeam, index: i };
    }
    // Check earlier slots in same team
    const sameArr = currentTeam === 1 ? t1 : t2;
    for (let i = 0; i < currentIndex; i++) {
      if (!sameArr[i]) return { team: currentTeam, index: i };
    }
    return null;
  };

  const handleClearSlot = (team: 1 | 2, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    if (team === 1) {
      const updated = [...team1];
      updated[index] = '';
      setTeam1(updated);
    } else {
      const updated = [...team2];
      updated[index] = '';
      setTeam2(updated);
    }
    setSelectedSlot({ team, index });
  };

  const handleClearAll = () => {
    setTeam1(Array(playersPerTeam).fill(''));
    setTeam2(Array(playersPerTeam).fill(''));
    setSelectedSlot({ team: 1, index: 0 });
    setError(null);
  };

  const handleSwapTeams = () => {
    const temp = [...team1];
    setTeam1([...team2]);
    setTeam2(temp);
    setSelectedSlot((prev) => ({
      team: prev.team === 1 ? 2 : 1,
      index: prev.index,
    }));
  };

  const handleShufflePartners = () => {
    if (playersPerTeam >= 2 && team1[1] && team2[1]) {
      const newT1 = [...team1];
      const newT2 = [...team2];
      const temp = newT1[1];
      newT1[1] = newT2[1];
      newT2[1] = temp;
      setTeam1(newT1);
      setTeam2(newT2);
    }
  };

  const handleAutoFillWithPrioritized = () => {
    const assigned = new Set<string>();
    const fillSlot = (currentId: string) => {
      if (currentId && !assigned.has(currentId)) {
        assigned.add(currentId);
        return currentId;
      }
      for (const pid of prioritizedBenchPlayerIds) {
        if (!assigned.has(pid)) {
          assigned.add(pid);
          return pid;
        }
      }
      for (const p of allActivePlayers) {
        if (!assigned.has(p.id)) {
          assigned.add(p.id);
          return p.id;
        }
      }
      return currentId;
    };

    setTeam1(team1.map(fillSlot));
    setTeam2(team2.map(fillSlot));
    setError(null);
  };

  const handleSave = () => {
    const activeT1 = team1.filter(Boolean);
    const activeT2 = team2.filter(Boolean);

    if (activeT1.length < playersPerTeam || activeT2.length < playersPerTeam) {
      setError(`Please assign all ${playersPerTeam * 2} player positions before saving.`);
      return;
    }

    const combined = [...activeT1, ...activeT2];
    const unique = new Set(combined);
    if (unique.size !== combined.length) {
      setError('A player cannot be in multiple slots in the same match.');
      return;
    }

    onSave(activeT1, activeT2);
    onClose();
  };

  const totalFilled = currentAssignedIds.size;
  const totalRequired = playersPerTeam * 2;

  return (
    <div
      id="edit-lineup-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 text-slate-900 max-h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
          <div className="min-w-0 flex-1 mr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2 h-5 bg-indigo-600 rounded-full"></span>
              <Users className="w-5 h-5 text-indigo-900 shrink-0" />
              <h3 className="font-black text-base sm:text-lg text-indigo-950 truncate">{title}</h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-900 border border-indigo-200">
                {playersPerTeam === 1 ? '1v1 Singles' : '2v2 Doubles'}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                ({totalFilled}/{totalRequired} filled)
              </span>
            </div>
            {subtitle && <p className="text-xs font-semibold text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close lineup editor"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 shrink-0 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Scrollable Main Area */}
        <div className="py-3.5 space-y-4 overflow-y-auto flex-1 pr-1">
          {/* Quick Actions Toolbar */}
          <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              {prioritizedBenchPlayerIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleAutoFillWithPrioritized}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-yellow-300 font-bold text-[11px] uppercase tracking-wide transition-all cursor-pointer shadow-2xs"
                  title="Auto-fill empty slots with the highest-priority bench players"
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Auto-Fill Bench</span>
                </button>
              )}
              {playersPerTeam >= 2 && (
                <button
                  type="button"
                  onClick={handleShufflePartners}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200 transition-all cursor-pointer shadow-2xs"
                  title="Swap partners between teams"
                >
                  <Shuffle className="w-3.5 h-3.5 text-indigo-600" />
                </button>
              )}
              <button
                type="button"
                onClick={handleSwapTeams}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-200 transition-all cursor-pointer shadow-2xs"
                title="Swap Team 1 and Team 2 sides"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-600" />
                <span>Swap Sides</span>
              </button>
            </div>

            {totalFilled > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All</span>
              </button>
            )}
          </div>

          {/* Interactive Court Slots Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
            {/* Center VS Indicator on Desktop */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-slate-900 text-yellow-300 border-2 border-white items-center justify-center font-black text-[10px] shadow-sm">
              VS
            </div>

            {/* Team 1 Side (Indigo) */}
            <div className="bg-indigo-50/70 border-2 border-indigo-200/90 rounded-2xl p-3 sm:p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  <span className="text-xs font-black uppercase text-indigo-950 tracking-wider">
                    Team 1 (Left Side)
                  </span>
                </div>
                <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-md">
                  {team1.filter(Boolean).length}/{playersPerTeam} Picked
                </span>
              </div>

              <div className="space-y-2">
                {Array.from({ length: playersPerTeam }).map((_, idx) => {
                  const playerId = team1[idx];
                  const player = playerId ? playersMap.get(playerId) : null;
                  const isSlotActive = selectedSlot.team === 1 && selectedSlot.index === idx;

                  // Partner synergy
                  const otherId = team1.find((id, i) => i !== idx && Boolean(id));
                  let partnerText = '';
                  let isDuoLocked = false;
                  if (player && otherId) {
                    const times = partnerCounts?.[player.id]?.[otherId] ?? 0;
                    isDuoLocked = player.duoPartnerId === otherId;
                    partnerText = isDuoLocked
                      ? '🔗 Locked Duo'
                      : times === 0
                      ? '✨ New Duo Pair'
                      : `Paired ${times}x`;
                  }

                  const gp = player ? (playerMatchCounts[player.id] ?? (player as any).gamesPlayed ?? 0) : 0;

                  return (
                    <div
                      key={`t1-slot-${idx}`}
                      onClick={() => setSelectedSlot({ team: 1, index: idx })}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                        isSlotActive
                          ? 'bg-white border-indigo-600 ring-2 ring-indigo-600/30 shadow-sm'
                          : player
                          ? 'bg-white/90 border-indigo-200 hover:border-indigo-300'
                          : 'bg-indigo-100/40 border-dashed border-indigo-300 hover:bg-indigo-100/70'
                      }`}
                    >
                      {player ? (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-slate-900 border border-white shadow-2xs shrink-0 ${player.avatarColor}`}
                            >
                              {player.name.charAt(0)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black text-slate-900 truncate">
                                  {player.name}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                  {gp} GP
                                </span>
                                {partnerText && (
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                      isDuoLocked
                                        ? 'bg-emerald-100 text-emerald-900'
                                        : 'bg-indigo-100 text-indigo-900'
                                    }`}
                                  >
                                    {partnerText}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-semibold block">
                                Slot {idx + 1}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleClearSlot(1, idx, e)}
                            className="w-6 h-6 rounded-full hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                            title="Remove player from slot"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center justify-between w-full text-indigo-900/80 py-1">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full border border-dashed border-indigo-400 flex items-center justify-center text-indigo-600 bg-indigo-50">
                              <UserPlus className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="text-xs font-bold block">
                                Slot {idx + 1}: Select Player
                              </span>
                              <span className="text-[10px] text-indigo-700/70 font-medium">
                                Tap to pick from list below
                              </span>
                            </div>
                          </div>
                          {isSlotActive && (
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full animate-pulse">
                              Picking...
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Team 2 Side (Amber/Yellow) */}
            <div className="bg-amber-50/70 border-2 border-amber-200/90 rounded-2xl p-3 sm:p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span className="text-xs font-black uppercase text-amber-950 tracking-wider">
                    Team 2 (Right Side)
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                  {team2.filter(Boolean).length}/{playersPerTeam} Picked
                </span>
              </div>

              <div className="space-y-2">
                {Array.from({ length: playersPerTeam }).map((_, idx) => {
                  const playerId = team2[idx];
                  const player = playerId ? playersMap.get(playerId) : null;
                  const isSlotActive = selectedSlot.team === 2 && selectedSlot.index === idx;

                  // Partner synergy
                  const otherId = team2.find((id, i) => i !== idx && Boolean(id));
                  let partnerText = '';
                  let isDuoLocked = false;
                  if (player && otherId) {
                    const times = partnerCounts?.[player.id]?.[otherId] ?? 0;
                    isDuoLocked = player.duoPartnerId === otherId;
                    partnerText = isDuoLocked
                      ? '🔗 Locked Duo'
                      : times === 0
                      ? '✨ New Duo Pair'
                      : `Paired ${times}x`;
                  }

                  const gp = player ? (playerMatchCounts[player.id] ?? (player as any).gamesPlayed ?? 0) : 0;

                  return (
                    <div
                      key={`t2-slot-${idx}`}
                      onClick={() => setSelectedSlot({ team: 2, index: idx })}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                        isSlotActive
                          ? 'bg-white border-amber-500 ring-2 ring-amber-500/30 shadow-sm'
                          : player
                          ? 'bg-white/90 border-amber-200 hover:border-amber-300'
                          : 'bg-amber-100/40 border-dashed border-amber-300 hover:bg-amber-100/70'
                      }`}
                    >
                      {player ? (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-slate-900 border border-white shadow-2xs shrink-0 ${player.avatarColor}`}
                            >
                              {player.name.charAt(0)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black text-slate-900 truncate">
                                  {player.name}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                  {gp} GP
                                </span>
                                {partnerText && (
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                      isDuoLocked
                                        ? 'bg-emerald-100 text-emerald-900'
                                        : 'bg-amber-100 text-amber-900'
                                    }`}
                                  >
                                    {partnerText}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-semibold block">
                                Slot {idx + 1}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleClearSlot(2, idx, e)}
                            className="w-6 h-6 rounded-full hover:bg-rose-100 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                            title="Remove player from slot"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center justify-between w-full text-amber-950/80 py-1">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full border border-dashed border-amber-400 flex items-center justify-center text-amber-700 bg-amber-50">
                              <UserPlus className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="text-xs font-bold block">
                                Slot {idx + 1}: Select Player
                              </span>
                              <span className="text-[10px] text-amber-800/70 font-medium">
                                Tap to pick from list below
                              </span>
                            </div>
                          </div>
                          {isSlotActive && (
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full animate-pulse">
                              Picking...
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Player Selection Palette */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-3">
            {/* Palette Header & Filter */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Pick Player for:
                </span>
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-md ${
                    selectedSlot.team === 1
                      ? 'bg-indigo-600 text-white'
                      : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  Team {selectedSlot.team} • Slot {selectedSlot.index + 1}
                </span>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    filterTab === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({allActivePlayers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('bench')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    filterTab === 'bench'
                      ? 'bg-white text-indigo-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Bench ({prioritizedBenchPlayerIds.length})</span>
                </button>
                {teammatePlayer && teammatePlayer.duoPartnerId && (
                  <button
                    type="button"
                    onClick={() => setFilterTab('duo')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      filterTab === 'duo'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    <Link2 className="w-3 h-3" />
                    <span>Duo Partner</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search squad player by name..."
                className="w-full bg-white pl-9 pr-8 py-2 rounded-xl text-xs font-medium border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="w-5 h-5 rounded-full text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Players Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {sortedPlayers.length === 0 ? (
                <div className="col-span-full py-6 text-center text-xs text-slate-400">
                  No squad players found matching criteria.
                </div>
              ) : (
                sortedPlayers.map((player) => {
                  const isAssignedT1 = team1.includes(player.id);
                  const isAssignedT2 = team2.includes(player.id);
                  const isAssignedCurrentSlot =
                    (selectedSlot.team === 1 && team1[selectedSlot.index] === player.id) ||
                    (selectedSlot.team === 2 && team2[selectedSlot.index] === player.id);
                  const isPrioritized = prioritizedBenchPlayerIds.includes(player.id);
                  const isDuoOfTeammate =
                    teammatePlayer && teammatePlayer.duoPartnerId === player.id;
                  const gp = playerMatchCounts[player.id] ?? (player as any).gamesPlayed ?? 0;

                  return (
                    <button
                      key={`pick-${player.id}`}
                      type="button"
                      onClick={() => handleSelectPlayerForSlot(player.id)}
                      className={`p-2 rounded-xl text-left border transition-all flex items-center gap-2 cursor-pointer relative ${
                        isAssignedCurrentSlot
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : isAssignedT1
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-950'
                          : isAssignedT2
                          ? 'bg-amber-50 border-amber-200 text-amber-950'
                          : isDuoOfTeammate
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-emerald-100'
                          : isPrioritized
                          ? 'bg-purple-50/80 border-purple-200 text-purple-950 hover:bg-purple-100/80'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border border-white shrink-0 ${player.avatarColor}`}
                      >
                        {player.name.charAt(0)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate leading-tight flex items-center gap-1">
                          <span className="truncate">{player.name}</span>
                          {isDuoOfTeammate && (
                            <Link2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[9px] font-semibold opacity-80">
                          <span>{gp} GP</span>
                          {isPrioritized && !isAssignedT1 && !isAssignedT2 && (
                            <span className="text-purple-700 font-bold">★ Rested</span>
                          )}
                          {isAssignedCurrentSlot ? (
                            <span className="font-bold text-yellow-300">✓ In Slot</span>
                          ) : isAssignedT1 ? (
                            <span className="text-indigo-700 font-bold">(T1)</span>
                          ) : isAssignedT2 ? (
                            <span className="text-amber-800 font-bold">(T2)</span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3.5 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          {onResetToAuto && isOverridden ? (
            <button
              type="button"
              onClick={() => {
                onResetToAuto();
                onClose();
              }}
              className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-bold underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Fair Auto Rotation</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400 font-medium hidden sm:block">
              Click any slot to change player
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md hover:shadow-indigo-300 transition-all cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4 text-yellow-400" />
              <span>Save Lineup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
