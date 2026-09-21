import React, { useState } from 'react';
import { Player, Round, SessionConfig } from '../types';
import { getPlayerMatchCounts } from '../utils/fairRotation';
import { AVATAR_COLORS } from '../utils/sampleData';
import { HelpTip } from './HelpTip';
import {
  Users,
  UserPlus,
  PauseCircle,
  PlayCircle,
  Trash2,
  FileText,
  Check,
  AlertCircle,
  Sparkles,
  Edit2,
  X,
  ArrowRightLeft,
  Link2,
  Unlink,
  Lock,
  Trophy,
} from 'lucide-react';

interface PlayersViewProps {
  players: Player[];
  rounds: Round[];
  config: SessionConfig;
  onAddPlayer: (name: string) => void;
  onBulkAddPlayers: (names: string[]) => void;
  onTogglePlayerActive: (playerId: string) => void;
  onRemovePlayer: (playerId: string) => void;
  onEditPlayer?: (playerId: string, updatedFields: Partial<Player>) => void;
  onResetSession: () => void;
  onLinkDuo?: (player1Id: string, player2Id: string) => void;
  onUnlinkDuo?: (playerId: string) => void;
  onClearRoster?: () => void;
  onPullFromOpenPlay?: () => void;
  openPlayPlayersCount?: number;
}

export const PlayersView: React.FC<PlayersViewProps> = ({
  players,
  rounds,
  config,
  onAddPlayer,
  onBulkAddPlayers,
  onTogglePlayerActive,
  onRemovePlayer,
  onEditPlayer,
  onResetSession,
  onLinkDuo,
  onUnlinkDuo,
  onClearRoster,
  onPullFromOpenPlay,
  openPlayPlayersCount = 0,
}) => {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<{ id: string; name: string } | null>(null);

  // Tap-to-link state for duo locking
  const [selectedForDuoId, setSelectedForDuoId] = useState<string | null>(null);
  
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isTournamentLocked = Boolean(
    config.tournamentMode?.enabled &&
      config.tournamentMode.locked &&
      !config.tournamentMode.completedAt
  );

  const matchCounts = getPlayerMatchCounts(players, rounds);
  const activeCount = players.filter((p) => p.active).length;
  const pausedCount = players.filter((p) => !p.active).length;
  const lockedDuosCount = Math.floor(players.filter((p) => p.duoPartnerId).length / 2);
  const playersPerMatch = config.playersPerTeam * 2;
  const totalSlots = config.courtsCount * playersPerMatch;

  const handleSingleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    onAddPlayer(newPlayerName.trim());
    setNewPlayerName('');
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const names = bulkText
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (names.length > 0) {
      onBulkAddPlayers(names);
      setBulkText('');
      setShowBulkModal(false);
    }
  };

  return (
    <div id="players-view" className="space-y-6">
      {/* Top Banner Stats */}
      {isTournamentLocked && (
        <div className="p-3.5 sm:p-4 bg-amber-50 border border-amber-200 rounded-2xl sm:rounded-3xl flex items-center justify-between gap-3 text-amber-950">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider">
                Tournament Roster Locked ({config.tournamentMode?.totalRounds} Rounds)
              </div>
              <p className="text-[11px] text-amber-900/90 font-medium">
                Player list is locked for the current tournament to guarantee fair round-robin scheduling.
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-black uppercase tracking-wider bg-amber-100 px-3 py-1.5 rounded-xl text-amber-900">
            <Trophy className="w-3.5 h-3.5" />
            <span>Round Robin</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-yellow-400 p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-yellow-500/40 shadow-sm flex items-center gap-2.5 sm:gap-3 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-16 sm:w-20 h-16 sm:h-20 bg-yellow-300 rounded-full opacity-60 pointer-events-none" />
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-black text-yellow-300 flex items-center justify-center font-black shadow-xs shrink-0">
            <Users className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="relative z-10 min-w-0">
            <div className="text-lg sm:text-2xl font-black text-slate-950 truncate">{players.length}</div>
            <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-900 truncate">Total Roster</div>
          </div>
        </div>

        <div className="bg-indigo-900 p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-indigo-800 shadow-sm flex items-center gap-2.5 sm:gap-3 text-white relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-16 sm:w-20 h-16 sm:h-20 bg-indigo-800 rounded-full opacity-60 pointer-events-none" />
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-800 text-yellow-300 flex items-center justify-center font-black shadow-xs shrink-0 border border-indigo-700">
            <PlayCircle className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="relative z-10 min-w-0">
            <div className="text-lg sm:text-2xl font-black text-white truncate">{activeCount} Ready</div>
            <div className="text-[10px] sm:text-[11px] font-bold text-indigo-200 uppercase tracking-wider truncate">
              {config.courtsCount} Courts
            </div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm flex items-center gap-2.5 sm:gap-3 relative overflow-hidden">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-black shadow-xs shrink-0">
            <PauseCircle className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-black text-slate-900 truncate">{pausedCount} Break</div>
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Paused</div>
          </div>
        </div>

        <div className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between gap-2 relative overflow-hidden">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black shadow-xs shrink-0 border border-emerald-200">
              <Link2 className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-lg sm:text-2xl font-black text-slate-900 truncate">{lockedDuosCount} Pairs</div>
              <div className="text-[10px] sm:text-[11px] font-bold text-emerald-700 uppercase tracking-wider truncate">Locked Duos</div>
            </div>
          </div>
          <HelpTip title="Locked Duos">
            <p>
              Select <strong>Pair Duo</strong> on any player, then select <strong>Pair Here</strong> on their partner to lock them together. When paired, use <strong>Break Duo</strong> to separate them anytime.
            </p>
          </HelpTip>
        </div>
      </div>

      {/* Active Pairing Helper Prompt */}
      {selectedForDuoId && (
        <div className="p-3 sm:p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl sm:rounded-3xl flex items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-400 text-indigo-950 font-black flex items-center justify-center text-xs shrink-0">
              <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] sm:text-xs font-black text-amber-950 uppercase tracking-wider truncate">
                Pair Partner for {players.find((p) => p.id === selectedForDuoId)?.name}
              </div>
              <p className="text-[10px] sm:text-xs text-amber-800 truncate">
                Select &ldquo;Pair Here&rdquo; on any player below to lock them as a duo!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedForDuoId(null)}
            className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase cursor-pointer shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Add Player Bar */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm">
        {isTournamentLocked ? (
          <div className="flex items-center justify-between gap-3 text-xs bg-slate-50 border border-slate-200/80 rounded-xl sm:rounded-2xl p-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold">Player roster is locked for the current tournament.</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
              Roster changes disabled to maintain round-robin integrity
            </span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
            <form onSubmit={handleSingleAdd} className="flex-1 flex gap-2">
              <input
                id="input-new-player-name"
                type="text"
                placeholder="Player name..."
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <button
                type="submit"
                id="btn-add-player"
                disabled={!newPlayerName.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Add
              </button>
            </form>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                id="btn-open-bulk-add"
                onClick={() => setShowBulkModal(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase tracking-wider transition-colors cursor-pointer shrink-0"
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                <span>Bulk Paste Roster</span>
              </button>

              {onPullFromOpenPlay && (
                <button
                  type="button"
                  id="btn-sync-with-openplay"
                  onClick={() => setShowSyncConfirm(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs shrink-0"
                  title="Overwrite Social Matches roster with Open Play roster"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                  <span>Pull from Open Play{openPlayPlayersCount > 0 ? ` (${openPlayPlayersCount})` : ''}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Players List Grid */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-indigo-950 text-xs uppercase tracking-wider">
              Registered Squad Players ({players.length})
            </h3>
            <HelpTip title="Auto-Replacement Fairness">
              <p>
                If a player is benched (paused) or deleted during an active match, they are automatically replaced on court by the highest-priority player from the bench.
              </p>
            </HelpTip>
            {players.length > 0 && onClearRoster && !isTournamentLocked && (
              <button
                type="button"
                id="btn-clear-roster"
                onClick={() => setShowClearConfirm(true)}
                className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition-colors uppercase tracking-wider cursor-pointer ml-1"
                title="Clear all players"
              >
                Clear All
              </button>
            )}
          </div>
          <span className="text-[11px] font-semibold text-slate-500">
            {isTournamentLocked ? 'Roster locked for tournament' : 'Click status to pause/bench player'}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {players.length === 0 ? (
            <div className="p-8 sm:p-12 text-center text-slate-500">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm text-slate-800">Squad bench is empty</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Add your players using the input above or tap &ldquo;Bulk Paste Roster&rdquo; to paste your club member list.
              </p>
            </div>
          ) : (
            players.map((player) => {
            const played = matchCounts[player.id] || 0;
            const partner = player.duoPartnerId
              ? players.find((p) => p.id === player.duoPartnerId)
              : null;
            const isSelectedDuo = selectedForDuoId === player.id;

            return (
              <div
                key={player.id}
                id={`player-row-${player.id}`}
                className={`p-2.5 sm:p-4 flex items-center justify-between gap-2 sm:gap-3 transition-all relative ${
                  isSelectedDuo
                    ? 'bg-amber-50 border-l-4 border-l-amber-500'
                    : partner
                    ? 'bg-emerald-50/40 hover:bg-emerald-50/70 border-l-4 border-l-emerald-500'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  {/* Player Avatar */}
                  <span
                    className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-black text-[11px] sm:text-xs border border-white shadow-xs shrink-0 ${player.avatarColor}`}
                  >
                    {player.name.charAt(0)}
                  </span>

                  {editingPlayer?.id === player.id ? (
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-1 max-w-sm">
                      <input
                        type="text"
                        value={editingPlayer.name}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, name: e.target.value })
                        }
                        className="px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-bold text-slate-900 bg-white border border-indigo-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (editingPlayer.name.trim() && onEditPlayer) {
                            onEditPlayer(player.id, { name: editingPlayer.name.trim() });
                          }
                          setEditingPlayer(null);
                        }}
                        className="p-1 sm:p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer"
                        title="Save name"
                        aria-label="Save name"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPlayer(null)}
                        className="p-1 sm:p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 cursor-pointer"
                        title="Cancel"
                        aria-label="Cancel editing name"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-xs sm:text-sm truncate">
                          {player.name}
                        </span>

                        {/* Duo Badge if locked */}
                        {partner && (
                          <div
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[9px] sm:text-[10px] font-black uppercase tracking-wider shrink-0 max-w-[140px] sm:max-w-[200px]"
                            title={`Locked duo: ${partner.name}`}
                          >
                            <Link2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-700 shrink-0" />
                            <span className="truncate">{partner.name}</span>
                          </div>
                        )}

                        {onEditPlayer && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditingPlayer({ id: player.id, name: player.name })
                            }
                            className="p-0.5 sm:p-1 text-slate-400 hover:text-indigo-600 rounded-md transition-colors cursor-pointer shrink-0"
                            title="Edit player name"
                            aria-label="Edit player name"
                          >
                            <Edit2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 flex items-center gap-1.5 sm:gap-2 mt-0.5">
                        <span>GP: <strong className="text-indigo-900">{played}</strong></span>
                        <span>•</span>
                        <span>R{player.joinedAtRound}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {editingPlayer?.id !== player.id && (
                    <>
                      {/* Duo Action Button: If player is already duod, transforms into a prominent Break / Unpair button! */}
                  {partner ? (
                    onUnlinkDuo && (
                      <button
                        type="button"
                        id={`btn-break-duo-${player.id}`}
                        onClick={() => onUnlinkDuo(player.id)}
                        title={`Break / separate duo with ${partner.name}`}
                        className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                      >
                        <Unlink className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-600 shrink-0" />
                        <span>Break Duo</span>
                      </button>
                    )
                  ) : (
                    onLinkDuo && (
                      <button
                        type="button"
                        id={`btn-pair-duo-${player.id}`}
                        onClick={() => {
                          if (selectedForDuoId) {
                            if (selectedForDuoId !== player.id) {
                              onLinkDuo(selectedForDuoId, player.id);
                            }
                            setSelectedForDuoId(null);
                          } else {
                            setSelectedForDuoId(player.id);
                          }
                        }}
                        title={
                          selectedForDuoId
                            ? selectedForDuoId === player.id
                              ? 'Cancel duo pairing'
                              : `Pair with ${players.find((p) => p.id === selectedForDuoId)?.name}`
                            : 'Select to pair as Duo'
                        }
                        className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                          isSelectedDuo
                            ? 'bg-amber-400 text-indigo-950 ring-2 ring-amber-500'
                            : selectedForDuoId
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-300'
                            : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                        }`}
                      >
                        {isSelectedDuo ? (
                          <>
                            <X className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-950 shrink-0" />
                            <span>Cancel</span>
                          </>
                        ) : selectedForDuoId ? (
                          <>
                            <Link2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white shrink-0" />
                            <span>Pair Here</span>
                          </>
                        ) : (
                          <>
                            <Link2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 shrink-0" />
                            <span className="hidden sm:inline">Pair Duo</span>
                            <span className="sm:hidden">Pair</span>
                          </>
                        )}
                      </button>
                    )
                  )}

                  {/* Active / Paused Status Toggle */}
                  <button
                    type="button"
                    disabled={isTournamentLocked}
                    onClick={() => !isTournamentLocked && onTogglePlayerActive(player.id)}
                    title={
                      isTournamentLocked
                        ? 'Player status is locked for the current tournament'
                        : player.active
                        ? 'Pause/bench player (auto-replaced on court; breaks duo if linked)'
                        : 'Re-activate player into fair rotation pool'
                    }
                    className={`inline-flex items-center gap-1 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-colors ${
                      isTournamentLocked
                        ? 'bg-slate-100 text-slate-500 cursor-not-allowed opacity-80'
                        : player.active
                        ? 'bg-indigo-100 text-indigo-900 hover:bg-indigo-200 cursor-pointer'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'
                    }`}
                  >
                    {player.active ? (
                      <>
                        <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-700" />
                        <span>Active</span>
                      </>
                    ) : (
                      <>
                        <PauseCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>Paused</span>
                      </>
                    )}
                  </button>

                  {/* Delete Player Button with 2-step confirmation */}
                  {onRemovePlayer && !isTournamentLocked && (
                    confirmDeleteId === player.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onRemovePlayer(player.id);
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black rounded-lg transition-colors cursor-pointer shadow-2xs"
                          title="Confirm Delete"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                          title="Cancel"
                          aria-label="Cancel delete"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(player.id)}
                        className="p-1 sm:p-2 rounded-lg sm:rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Delete player (auto-replaced on court; breaks duo if linked)"
                        aria-label="Delete player"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    )
                  )}
                    </>
                  )}
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* Bulk Add Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-5 bg-yellow-400 rounded-full"></span>
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-indigo-950 text-base">Bulk Paste Player Names</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <p className="text-xs font-semibold text-slate-600">
              Paste player names from WhatsApp, Reclub, or a spreadsheet. You can separate names with commas or new lines.
            </p>

            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <textarea
                rows={6}
                placeholder="One player name per line..."
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full p-3.5 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-mono"
              />

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-2xl text-xs font-black uppercase text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!bulkText.trim()}
                  className="px-5 py-2 rounded-2xl text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white transition-colors cursor-pointer shadow-sm hover:shadow-indigo-300"
                >
                  Import Players
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sync Confirm Modal */}
      {showSyncConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-600">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                <ArrowRightLeft className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-xl font-black">Pull from Open Play?</h3>
            </div>
            
            <p className="text-slate-600 text-sm font-medium leading-relaxed">
              This will overwrite your current Social Matches roster with the Open Play roster. This action cannot be undone.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSyncConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onPullFromOpenPlay) {
                    onPullFromOpenPlay();
                  }
                  setShowSyncConfirm(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black transition-colors cursor-pointer shadow-md"
              >
                Confirm Pull
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Roster Confirm Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">Clear Squad Roster</h3>
                <p className="text-xs text-slate-500 font-medium">Remove all registered players</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to clear all {players.length} players from the squad roster? This will also reset matches for a fresh club session.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-clear-roster"
                onClick={() => {
                  setShowClearConfirm(false);
                  onClearRoster?.();
                }}
                className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-xs"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
