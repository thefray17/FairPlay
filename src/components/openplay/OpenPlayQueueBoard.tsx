import React, { useState } from 'react';
import { OpenPlayPlayer, OpenPlayConfig } from '../../types/openPlay';
import { getDevicePlayerProfile } from '../../utils/identitySync';
import {
  Trophy,
  Users,
  Coffee,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Clock,
  Flame,
  Zap,
  ArrowRight,
  ArrowRightLeft,
  Pencil,
  Check,
  X,
  FileText,
  HelpCircle,
  Play,
  RotateCcw,
} from 'lucide-react';
import { soundFx } from '../../utils/audio';

interface OpenPlayQueueBoardProps {
  winnersQueue: string[];
  losersQueue: string[];
  restingBench: string[];
  playerRegistry: Record<string, OpenPlayPlayer>;
  config: OpenPlayConfig;
  nextQueueTurn?: 'winners' | 'losers';
  onToggleNextQueueTurn?: () => void;
  onAddPlayer: (name: string, targetBucket?: 'winners' | 'losers' | 'bench') => void;
  onBulkAddPlayers?: (names: string[]) => void;
  onEditPlayer?: (id: string, newName: string) => void;
  onRemovePlayer: (id: string) => void;
  onMovePlayerWithinBucket: (bucket: 'winners' | 'losers' | 'bench', index: number, direction: 'up' | 'down') => void;
  onTransferPlayerBucket: (playerId: string, fromBucket: 'winners' | 'losers' | 'bench', toBucket: 'winners' | 'losers' | 'bench') => void;
  onClearQueue: () => void;
  onDispatchAll?: () => void;
  canDispatchAny?: boolean;
  onPullFromSocial?: () => void;
}

export const OpenPlayQueueBoard: React.FC<OpenPlayQueueBoardProps> = ({
  winnersQueue,
  losersQueue,
  restingBench,
  playerRegistry,
  config,
  nextQueueTurn = 'winners',
  onToggleNextQueueTurn,
  onAddPlayer,
  onBulkAddPlayers,
  onEditPlayer,
  onRemovePlayer,
  onMovePlayerWithinBucket,
  onTransferPlayerBucket,
  onClearQueue,
  onDispatchAll,
  canDispatchAny = false,
  onPullFromSocial,
}) => {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [targetBucket, setTargetBucket] = useState<'winners' | 'losers' | 'bench'>('bench');
  const [activeMobileBucket, setActiveMobileBucket] = useState<'all' | 'winners' | 'losers' | 'bench'>('all');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showRuleInfo, setShowRuleInfo] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    onAddPlayer(newPlayerName.trim(), targetBucket);
    setNewPlayerName('');
    
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const names = bulkText
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length > 0 && onBulkAddPlayers) {
      onBulkAddPlayers(names);
      setBulkText('');
      setShowBulkModal(false);
    }
  };

  const handleSaveEdit = (id: string) => {
    if (editingPlayerName.trim() && onEditPlayer) {
      onEditPlayer(id, editingPlayerName.trim());
    }
    setEditingPlayerId(null);
  };

  const totalPlayersInBuckets = winnersQueue.length + losersQueue.length + restingBench.length;

  // Render individual player card in a bucket
  const renderBucketItem = (
    id: string,
    index: number,
    bucket: 'winners' | 'losers' | 'bench',
    queueLength: number
  ) => {
    const p = playerRegistry[id] || {
      id,
      name: 'Player',
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      joinedQueueAt: Date.now(),
    };

    const isEditing = editingPlayerId === id;
    const isTopWinner = bucket === 'winners' && index < 4;
    const isNextMoveUp = bucket === 'losers' && index < Math.max(0, 4 - winnersQueue.length) && winnersQueue.length > 0;
    const isNextBenchIn = bucket === 'bench' && index === 0;

    const deviceProfile = getDevicePlayerProfile();
    const isPlayerUser = !!(
      deviceProfile?.id &&
      (('playerProfileId' in p && p.playerProfileId === deviceProfile.id) || p.id === deviceProfile.id || p.name.toLowerCase() === deviceProfile.name.toLowerCase())
    );

    return (
      <div
        key={id}
        className={`p-2 sm:p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
          isPlayerUser
            ? 'bg-yellow-50/80 border-yellow-400 ring-2 ring-yellow-400/30 shadow-xs'
            : 'bg-white border-slate-200/90 shadow-2xs hover:border-slate-300'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Queue Position Badge */}
          <span
            className={`w-6 h-6 rounded-lg text-xs font-mono font-black flex items-center justify-center shrink-0 ${
              isPlayerUser
                ? 'bg-yellow-400 text-indigo-950 font-black'
                : bucket === 'winners'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : bucket === 'losers'
                ? 'bg-teal-100 text-teal-900 border border-teal-300'
                : 'bg-orange-100 text-orange-900 border border-orange-300'
            }`}
          >
            #{index + 1}
          </span>

          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editingPlayerName}
                  onChange={(e) => setEditingPlayerName(e.target.value)}
                  className="px-2 py-1 text-xs border rounded-lg w-full font-bold focus:outline-emerald-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => handleSaveEdit(id)}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPlayerId(null)}
                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-black text-slate-900 truncate">
                  {p.name}
                </span>

                {isPlayerUser && (
                  <span className="px-1.5 py-0.2 rounded-full bg-yellow-400 text-indigo-950 font-black text-[9px]">
                    YOU
                  </span>
                )}

                {/* Move-Up / Next In Badges */}
                {isNextMoveUp && (
                  <span className="px-1.5 py-0.2 rounded bg-yellow-300 text-emerald-950 font-black text-[9px] uppercase tracking-tight flex items-center gap-0.5">
                    <Zap className="w-2.5 h-2.5 fill-emerald-950" />
                    Move-Up
                  </span>
                )}
                {isNextBenchIn && (
                  <span className="px-1.5 py-0.2 rounded bg-orange-200 text-orange-900 font-black text-[9px] uppercase tracking-tight">
                    Next In
                  </span>
                )}
                {p.currentStreak > 1 && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-black text-[9px] flex items-center gap-0.5">
                    <Flame className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                    {p.currentStreak}W
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold mt-0.5">
              <span>{p.gamesPlayed} GP</span>
              <span>•</span>
              <span>{p.wins}W - {p.losses}L</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Move Up/Down within bucket */}
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMovePlayerWithinBucket(bucket, index, 'up')}
            className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
            title="Move Up"
            aria-label="Move Up"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={index === queueLength - 1}
            onClick={() => onMovePlayerWithinBucket(bucket, index, 'down')}
            className="p-1 text-slate-400 hover:text-slate-800 disabled:opacity-20 cursor-pointer"
            title="Move Down"
            aria-label="Move Down"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          {/* Quick Bucket Transfer Dropdown / Buttons */}
          {bucket !== 'bench' ? (
            <button
              type="button"
              onClick={() => onTransferPlayerBucket(id, bucket, 'bench')}
              className="p-1 text-slate-400 hover:text-orange-600 rounded transition-colors cursor-pointer"
              title="Move to Resting Bench"
              aria-label="Move to Resting Bench"
            >
              <Coffee className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onTransferPlayerBucket(id, 'bench', 'losers')}
              className="p-1 text-slate-400 hover:text-teal-600 rounded transition-colors cursor-pointer"
              title="Move to Losers Queue"
              aria-label="Move to Losers Queue"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {bucket === 'losers' && (
            <button
              type="button"
              onClick={() => onTransferPlayerBucket(id, 'losers', 'winners')}
              className="p-1 text-slate-400 hover:text-amber-600 rounded transition-colors cursor-pointer"
              title="Promote to Winners Queue"
              aria-label="Promote to Winners Queue"
            >
              <Trophy className="w-3.5 h-3.5" />
            </button>
          )}
          {bucket === 'winners' && (
            <button
              type="button"
              onClick={() => onTransferPlayerBucket(id, 'winners', 'losers')}
              className="p-1 text-slate-400 hover:text-teal-600 rounded transition-colors cursor-pointer"
              title="Move to Losers Queue"
              aria-label="Move to Losers Queue"
            >
              <Users className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Edit */}
          <button
            type="button"
            onClick={() => {
              setEditingPlayerId(id);
              setEditingPlayerName(p.name);
            }}
            
            className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            title="Rename"
            aria-label="Rename"
          >
            <Pencil className="w-3 h-3" />
          </button>

          {/* Remove / Confirm Delete */}
          {confirmDeleteId === id ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onRemovePlayer(id);
                  setConfirmDeleteId(null);
                }}
                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black rounded-lg transition-colors cursor-pointer shadow-2xs"
                title="Confirm Delete"
                aria-label="Confirm Delete"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                title="Cancel"
                aria-label="Cancel delete"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteId(id)}
              className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
              title="Remove from session"
              aria-label="Remove from session"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col h-full">
      {/* Top Header & Actions */}
      <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                Buckets
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-200">
                {totalPlayersInBuckets} in queue
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowRuleInfo(!showRuleInfo)}
              className="p-1 text-slate-400 hover:text-emerald-700 rounded transition-colors cursor-pointer"
              title="Universal Match Cycle Rules"
              aria-label="Universal Match Cycle Rules"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onPullFromSocial && (
              <button
                type="button"
                id="btn-sync-from-social"
                onClick={() => setShowOverwriteConfirm(true)}
                  
                  
                
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 font-black text-xs transition-all cursor-pointer active:scale-95 shadow-xs"
                title="Overwrite Open Play roster with Social Matches roster"
                aria-label="Overwrite Open Play roster with Social Matches roster"
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                <span>Pull from Social</span>
              </button>
            )}

            {onDispatchAll && canDispatchAny && (
              <button
                type="button"
                id="btn-dispatch-all-courts"
                onClick={onDispatchAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Fill Open Courts</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowBulkModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Bulk Add</span>
            </button>
          </div>
        </div>

        {/* Rotation Status Bar */}
        <div className="mt-2.5 p-2.5 rounded-xl border flex items-center justify-between gap-2 flex-wrap text-xs bg-emerald-950 text-white border-emerald-800 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
            {restingBench.length > 0 ? (
              <span className="text-yellow-300 font-bold truncate">
                Starting Bench Active: Courts fill from Bench Queue first until all {restingBench.length} resting player(s) have played!
              </span>
            ) : (
              <span className="font-semibold truncate">
                Alternating Queue Mode: Next match dispatches from{' '}
                <strong className={nextQueueTurn === 'winners' ? 'text-yellow-300 font-black' : 'text-teal-300 font-black'}>
                  {nextQueueTurn === 'winners' ? '🏆 Winners Queue' : '🥈 Losers Queue'}
                </strong>
              </span>
            )}
          </div>

          {restingBench.length === 0 && onToggleNextQueueTurn && (
            <button
              type="button"
              id="btn-switch-queue-turn"
              onClick={onToggleNextQueueTurn}
              className="text-[10px] px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-yellow-300 font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              title="Manually alternate next queue turn"
              aria-label="Manually alternate next queue turn"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Switch to {nextQueueTurn === 'winners' ? 'Losers' : 'Winners'}</span>
            </button>
          )}
        </div>

        {/* Rule Info Dropdown */}
        {showRuleInfo && (
          <div className="mt-2.5 p-3 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-950 text-xs space-y-1.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between font-black text-emerald-900 pb-1 border-b border-emerald-200">
              <span>Universal Match Cycle &amp; Fair Rotation Rules</span>
              <button
                type="button"
                onClick={() => setShowRuleInfo(false)}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                aria-label="Close rule info"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p><strong>1. Starting Bench Fill:</strong> All players start at the bench. When remaining bench players need teammates to play on court: <strong>4 bench</strong> play together; <strong>3 bench</strong> get 1 top Winner; <strong>2 bench</strong> get 2 top Winners; <strong>1 bench</strong> gets 2 top Winners + 1 top Loser.</p>
            <p><strong>2. No Bench Swaps:</strong> When matches finish, winners always line up at the back of the Winners Queue and losers at the back of the Losers Queue. Nobody is rotated out to take a bench spot.</p>
            <p><strong>3. Alternating Play (Once Bench Drained):</strong> Winners Queue plays first, then alternates to Losers Queue, then Winners Queue again, and so on.</p>
            <p><strong>4. Universal Queueing (FIFO):</strong> After every game finishes, players line up at the back of their respective queues.</p>
            <p><strong>5. Partner Splitting:</strong> Court arrivals 1, 2, 3, 4 are split 1+4 vs 2+3 to guarantee previous teammates play on opposite sides.</p>
          </div>
        )}

        {/* Quick Add Player Bar */}
        <form onSubmit={handleAddSubmit} className="mt-2.5 flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Add player name..."
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-emerald-500 font-semibold text-slate-900"
          />

          <select
            value={targetBucket}
            onChange={(e) => setTargetBucket(e.target.value as any)}
            className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-xl font-bold text-slate-700 focus:outline-emerald-500"
          >
            <option value="losers">🥈 Losers Queue</option>
            <option value="winners">🏆 Winners Queue</option>
            <option value="bench">🪑 Resting Bench</option>
          </select>

          <button
            type="submit"
            disabled={!newPlayerName.trim()}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>

        {/* Mobile Bucket Tabs (visible on mobile screens) */}
        <div className="flex md:hidden items-center gap-1 mt-2.5 border-t border-slate-200/80 pt-2">
          <button
            type="button"
            onClick={() => setActiveMobileBucket('all')}
            className={`flex-1 py-1 text-center rounded-lg text-xs font-black transition-colors cursor-pointer ${
              activeMobileBucket === 'all'
                ? 'bg-emerald-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Buckets
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileBucket('winners')}
            className={`flex-1 py-1 text-center rounded-lg text-xs font-black transition-colors cursor-pointer ${
              activeMobileBucket === 'winners'
                ? 'bg-amber-400 text-amber-950 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            🏆 Winners ({winnersQueue.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileBucket('losers')}
            className={`flex-1 py-1 text-center rounded-lg text-xs font-black transition-colors cursor-pointer ${
              activeMobileBucket === 'losers'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            🥈 Losers ({losersQueue.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileBucket('bench')}
            className={`flex-1 py-1 text-center rounded-lg text-xs font-black transition-colors cursor-pointer ${
              activeMobileBucket === 'bench'
                ? 'bg-orange-500 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            🪑 Bench ({restingBench.length})
          </button>
        </div>
      </div>

      {/* 3 Core Buckets Body */}
      <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 flex-1 overflow-y-auto">
        {/* Bucket 1: Winners Queue */}
        <div
          className={`rounded-2xl border flex flex-col bg-slate-50/60 p-3 ${
            activeMobileBucket !== 'all' && activeMobileBucket !== 'winners'
              ? 'hidden md:flex'
              : 'flex'
          } ${restingBench.length === 0 && nextQueueTurn === 'winners' ? 'border-amber-400 ring-2 ring-amber-300/40 bg-amber-50/20' : 'border-amber-200'}`}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-amber-200/80">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-yellow-400 text-emerald-950 flex items-center justify-center font-black text-xs">
                🏆
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    Winners Queue
                  </h3>
                  {restingBench.length === 0 && nextQueueTurn === 'winners' && (
                    <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-400 text-amber-950 animate-pulse">
                      Up Next
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 font-semibold leading-none">
                  {restingBench.length === 0 && nextQueueTurn === 'winners' ? '⚡ Active Turn (Plays First)' : 'Alternating Queue'}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
              {winnersQueue.length}
            </span>
          </div>

          <div className="space-y-1.5 flex-1 overflow-y-auto min-h-[120px]">
            {winnersQueue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <Trophy className="w-6 h-6 mb-1 text-slate-300" />
                <p className="text-xs font-bold text-slate-500">Winners Queue is Empty</p>
                <p className="text-[10px] text-slate-400">
                  Winners from completed matches will arrive here first.
                </p>
              </div>
            ) : (
              winnersQueue.map((id, index) =>
                renderBucketItem(id, index, 'winners', winnersQueue.length)
              )
            )}
          </div>
        </div>

        {/* Bucket 2: Losers Queue */}
        <div
          className={`rounded-2xl border flex flex-col bg-slate-50/60 p-3 ${
            activeMobileBucket !== 'all' && activeMobileBucket !== 'losers'
              ? 'hidden md:flex'
              : 'flex'
          } ${restingBench.length === 0 && nextQueueTurn === 'losers' ? 'border-teal-400 ring-2 ring-teal-300/40 bg-teal-50/20' : 'border-teal-200'}`}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-teal-200/80">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-black text-xs">
                🥈
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    Losers Queue
                  </h3>
                  {restingBench.length === 0 && nextQueueTurn === 'losers' && (
                    <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider bg-teal-600 text-white animate-pulse">
                      Up Next
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 font-semibold leading-none">
                  {restingBench.length === 0 && nextQueueTurn === 'losers' ? '⚡ Active Turn (Plays Next)' : 'Alternating Queue'}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-teal-100 text-teal-900 border border-teal-300">
              {losersQueue.length}
            </span>
          </div>

          <div className="space-y-1.5 flex-1 overflow-y-auto min-h-[120px]">
            {losersQueue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <Users className="w-6 h-6 mb-1 text-slate-300" />
                <p className="text-xs font-bold text-slate-500">Losers Queue is Empty</p>
                <p className="text-[10px] text-slate-400">
                  Losers from completed matches queue up here.
                </p>
              </div>
            ) : (
              losersQueue.map((id, index) =>
                renderBucketItem(id, index, 'losers', losersQueue.length)
              )
            )}
          </div>
        </div>

        {/* Bucket 3: Resting Bench */}
        <div
          className={`rounded-2xl border flex flex-col bg-slate-50/60 p-3 ${
            activeMobileBucket !== 'all' && activeMobileBucket !== 'bench'
              ? 'hidden md:flex'
              : 'flex'
          } ${restingBench.length > 0 ? 'border-orange-400 ring-2 ring-orange-300/40 bg-orange-50/20' : 'border-orange-200'}`}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-orange-200/80">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center font-black text-xs">
                🪑
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    Bench Queue
                  </h3>
                  {restingBench.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider bg-orange-600 text-white animate-pulse">
                      Plays First
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 font-semibold leading-none">
                  {restingBench.length > 0 ? 'Starting Queue: fills courts until empty' : 'Resting Bench (Empty)'}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-orange-100 text-orange-900 border border-orange-300">
              {restingBench.length}
            </span>
          </div>

          <div className="space-y-1.5 flex-1 overflow-y-auto min-h-[120px]">
            {restingBench.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <Coffee className="w-6 h-6 mb-1 text-slate-300" />
                <p className="text-xs font-bold text-slate-500">Bench is Empty</p>
                <p className="text-[10px] text-slate-400">
                  All bench players have rotated into games. Winners &amp; Losers queues are active.
                </p>
              </div>
            ) : (
              restingBench.map((id, index) =>
                renderBucketItem(id, index, 'bench', restingBench.length)
              )
            )}
          </div>
        </div>
      </div>

      {/* Bulk Add Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900">Bulk Add Players</h3>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                aria-label="Close bulk add modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkSubmit} className="space-y-3">
              <p className="text-xs text-slate-500 font-semibold">
                Paste names separated by commas or new lines. They will be added to the queue.
              </p>
              <textarea
                rows={5}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Alex, Jordan&#10;Taylor&#10;Chris, Sam"
                className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:outline-emerald-500 text-slate-900 font-semibold"
                autoFocus
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!bulkText.trim()}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black shadow-xs"
                >
                  Add Players
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Overwrite Social Confirm Modal */}
      {showOverwriteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-indigo-600">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-xl font-black">Pull from Social?</h3>
            </div>
            
            <p className="text-slate-600 text-sm font-medium leading-relaxed">
              This will overwrite your current Open Play roster with the Social Matches roster. New players will be placed on the Open Play bench.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowOverwriteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFx.playPointChime();
                  if (onPullFromSocial) {
                    onPullFromSocial();
                  }
                  setShowOverwriteConfirm(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black transition-colors cursor-pointer shadow-md"
              >
                Confirm Pull
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
