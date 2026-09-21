import React, { useState } from 'react';
import { Player, UpcomingMatch } from '../types';
import { EditLineupModal } from './EditLineupModal';
import { getDevicePlayerProfile } from '../utils/identitySync';
import {
  CalendarClock,
  Edit3,
  Users,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Link2,
} from 'lucide-react';

interface UpcomingMatchesProps {
  upcomingMatches: UpcomingMatch[];
  playersMap: Record<string, Player>;
  allActivePlayers: Player[];
  playersPerTeam: number;
  onUpdateNextMatch: (matchNumber: 1 | 2, team1: string[], team2: string[]) => void;
  onResetNextMatch: (matchNumber: 1 | 2) => void;
  playerMatchCounts: Record<string, number>;
  partnerCounts?: Record<string, Record<string, number>>;
}

export const UpcomingMatches: React.FC<UpcomingMatchesProps> = ({
  upcomingMatches,
  playersMap,
  allActivePlayers,
  playersPerTeam,
  onUpdateNextMatch,
  onResetNextMatch,
  playerMatchCounts,
  partnerCounts,
}) => {
  const [editingMatch, setEditingMatch] = useState<UpcomingMatch | null>(null);

  if (!upcomingMatches || upcomingMatches.length === 0) {
    return null;
  }

  return (
    <div
      id="upcoming-matches-section"
      className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200 shadow-xs space-y-3 sm:space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-100 pb-2.5 sm:pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 sm:w-2 sm:h-5 bg-indigo-600 rounded-full"></span>
            <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-900" />
            <h3 className="font-black text-sm sm:text-base text-indigo-950 tracking-tight">
              On-Deck: Next 2 Matches
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-indigo-950 shadow-2xs">
              Live Queue
            </span>
          </div>
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5">
            Next up in the queue. You can edit or swap players anytime!
          </p>
        </div>
      </div>

      {/* Matches Grid */}
      {(() => {
        const deviceProfile = getDevicePlayerProfile();
        const maxGP = allActivePlayers.length > 0
          ? Math.max(0, ...allActivePlayers.map((p) => playerMatchCounts[p.id] || 0))
          : 0;

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingMatches.slice(0, 2).map((match) => {
              const isNext = match.matchNumber === 1;
              const team1 = match.team1PlayerIds.map((id) => playersMap[id]).filter(Boolean);
              const team2 = match.team2PlayerIds.map((id) => playersMap[id]).filter(Boolean);

              const userIsInMatch = !!(
                deviceProfile?.id &&
                [...team1, ...team2].some(
                  (p) => p.playerProfileId === deviceProfile.id || p.id === deviceProfile.id || p.name.toLowerCase() === deviceProfile.name.toLowerCase()
                )
              );

              return (
                <div
                  key={`upcoming-match-${match.matchNumber}`}
                  id={`upcoming-match-card-${match.matchNumber}`}
                  className={`rounded-2xl p-4.5 border transition-all relative ${
                    userIsInMatch
                      ? 'ring-2 ring-yellow-400 bg-indigo-900 text-white border-yellow-400/80 shadow-lg'
                      : isNext
                      ? 'bg-indigo-900 text-white border-indigo-800 shadow-md ring-2 ring-indigo-500/20'
                      : 'bg-slate-50 text-slate-900 border-slate-200 shadow-xs'
                  }`}
                >
                  {/* Card Top */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          userIsInMatch
                            ? 'bg-yellow-400 text-indigo-950 font-black animate-pulse'
                            : isNext
                            ? 'bg-yellow-400 text-indigo-950 font-black'
                            : 'bg-slate-200 text-slate-700 font-bold'
                        }`}
                      >
                        {userIsInMatch ? '👉 YOUR NEXT MATCH' : isNext ? '★ On-Deck (Next Match)' : 'In The Hole (Match 2)'}
                      </span>
                      {match.isOverridden && (
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/30">
                          Manual Lineup
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      id={`btn-edit-upcoming-match-${match.matchNumber}`}
                      onClick={() => setEditingMatch(match)}
                      className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all active:scale-95 cursor-pointer shrink-0 ${
                        isNext
                          ? 'bg-indigo-800 hover:bg-indigo-700 text-yellow-300 border border-indigo-700'
                          : 'bg-white hover:bg-slate-100 text-indigo-600 border border-slate-200 shadow-2xs'
                      }`}
                      title="Edit upcoming match lineup"
                      aria-label="Edit lineup"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Teams Display */}
                  {(() => {
                    const team1PairTimes =
                      partnerCounts && team1.length >= 2
                        ? partnerCounts[team1[0].id]?.[team1[1].id] ?? 0
                        : null;
                    const team2PairTimes =
                      partnerCounts && team2.length >= 2
                        ? partnerCounts[team2[0].id]?.[team2[1].id] ?? 0
                        : null;

                    const isTeam1Locked =
                      team1.length >= 2 && team1[0].duoPartnerId === team1[1].id;
                    const isTeam2Locked =
                      team2.length >= 2 && team2[0].duoPartnerId === team2[1].id;

                    return (
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        {/* Team 1 */}
                        <div
                          className={`p-3 rounded-xl ${
                            isNext
                              ? 'bg-indigo-950/70 border border-indigo-800'
                              : 'bg-white border border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-75">
                              Team 1
                            </span>
                            {isTeam1Locked ? (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                                  isNext
                                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}
                                title="Locked Duo: Will always play together"
                              >
                                <Link2 className={`w-2.5 h-2.5 shrink-0 ${isNext ? 'text-emerald-300' : 'text-emerald-700'}`} />
                                <span>Locked Duo</span>
                              </span>
                            ) : team1PairTimes !== null && (
                              team1PairTimes === 0 ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                                    isNext
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  }`}
                                  title="Never paired before - prioritized duo!"
                                >
                                  <Sparkles className={`w-2 h-2 ${isNext ? 'text-emerald-400' : 'text-emerald-600'}`} /> New Duo
                                </span>
                              ) : (
                                <span
                                  className={`text-[9px] font-semibold ${
                                    isNext ? 'text-indigo-300' : 'text-slate-500'
                                  }`}
                                >
                                  {team1PairTimes}x
                                </span>
                              )
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {team1.map((player, pIdx) => {
                              const gp = playerMatchCounts[player.id] || 0;
                              const isCatchUp = maxGP > 0 && gp < maxGP && ((player.joinedAtRound || 1) > 1 || gp <= maxGP - 1);
                              const isPlayerUser = !!(
                                deviceProfile?.id &&
                                (player.playerProfileId === deviceProfile.id || player.id === deviceProfile.id || player.name.toLowerCase() === deviceProfile.name.toLowerCase())
                              );
                              return (
                                <div key={`um-t1-${match.matchNumber}-${player.id}-${pIdx}`} className="flex items-center gap-2">
                                  <span
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border border-white/50 shrink-0 ${player.avatarColor}`}
                                  >
                                    {player.name.charAt(0)}
                                  </span>
                                  <div className="truncate min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-bold truncate">{player.name}</span>
                                      {isPlayerUser && (
                                        <span className="text-[8px] px-1 py-0.2 rounded-full bg-yellow-400 text-indigo-950 font-black shrink-0">
                                          YOU
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span
                                        className={`text-[9px] font-semibold ${
                                          isNext ? 'text-indigo-200' : 'text-slate-400'
                                        }`}
                                      >
                                        {gp} GP
                                      </span>
                                      {isCatchUp && (
                                        <span
                                          className={`px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider ${
                                            isNext
                                              ? 'bg-yellow-400 text-indigo-950'
                                              : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                          }`}
                                          title="Catch-Up Player: Prioritized to balance games played"
                                        >
                                          ⚡ Catch-Up
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Team 2 */}
                        <div
                          className={`p-3 rounded-xl ${
                            isNext
                              ? 'bg-indigo-950/70 border border-indigo-800'
                              : 'bg-white border border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-75">
                              Team 2
                            </span>
                            {isTeam2Locked ? (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                                  isNext
                                    ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/40'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}
                                title="Locked Duo: Will always play together"
                              >
                                <Link2 className={`w-2.5 h-2.5 shrink-0 ${isNext ? 'text-emerald-300' : 'text-emerald-700'}`} />
                                <span>Locked Duo</span>
                              </span>
                            ) : team2PairTimes !== null && (
                              team2PairTimes === 0 ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                                    isNext
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  }`}
                                  title="Never paired before - prioritized duo!"
                                >
                                  <Sparkles className={`w-2 h-2 ${isNext ? 'text-emerald-400' : 'text-emerald-600'}`} /> New Duo
                                </span>
                              ) : (
                                <span
                                  className={`text-[9px] font-semibold ${
                                    isNext ? 'text-indigo-300' : 'text-slate-500'
                                  }`}
                                >
                                  {team2PairTimes}x
                                </span>
                              )
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {team2.map((player, pIdx) => {
                              const gp = playerMatchCounts[player.id] || 0;
                              const isCatchUp = maxGP > 0 && gp < maxGP && ((player.joinedAtRound || 1) > 1 || gp <= maxGP - 1);
                              const isPlayerUser = !!(
                                deviceProfile?.id &&
                                (player.playerProfileId === deviceProfile.id || player.id === deviceProfile.id || player.name.toLowerCase() === deviceProfile.name.toLowerCase())
                              );
                              return (
                                <div key={`um-t2-${match.matchNumber}-${player.id}-${pIdx}`} className="flex items-center gap-2">
                                  <span
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border border-white/50 shrink-0 ${player.avatarColor}`}
                                  >
                                    {player.name.charAt(0)}
                                  </span>
                                  <div className="truncate min-w-0">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-bold truncate">{player.name}</span>
                                      {isPlayerUser && (
                                        <span className="text-[8px] px-1 py-0.2 rounded-full bg-yellow-400 text-indigo-950 font-black shrink-0">
                                          YOU
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span
                                        className={`text-[9px] font-semibold ${
                                          isNext ? 'text-indigo-200' : 'text-slate-400'
                                        }`}
                                      >
                                        {gp} GP
                                      </span>
                                      {isCatchUp && (
                                        <span
                                          className={`px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider ${
                                            isNext
                                              ? 'bg-yellow-400 text-indigo-950'
                                              : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                          }`}
                                          title="Catch-Up Player: Prioritized to balance games played"
                                        >
                                          ⚡ Catch-Up
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Edit Modal */}
      {editingMatch && (
        <EditLineupModal
          isOpen={true}
          onClose={() => setEditingMatch(null)}
          title={`Edit ${
            editingMatch.matchNumber === 1 ? 'On-Deck Next Match' : 'Match 2 In-The-Hole'
          }`}
          subtitle="Assign or substitute players for this upcoming match"
          playersPerTeam={playersPerTeam}
          allActivePlayers={allActivePlayers}
          initialTeam1={editingMatch.team1PlayerIds}
          initialTeam2={editingMatch.team2PlayerIds}
          isOverridden={editingMatch.isOverridden}
          partnerCounts={partnerCounts}
          playerMatchCounts={playerMatchCounts}
          onResetToAuto={() => onResetNextMatch(editingMatch.matchNumber)}
          onSave={(t1, t2) => {
            onUpdateNextMatch(editingMatch.matchNumber, t1, t2);
            setEditingMatch(null);
          }}
        />
      )}
    </div>
  );
};
