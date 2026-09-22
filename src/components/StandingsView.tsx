import React, { useState, useMemo } from 'react';
import { Player, Round, SessionConfig, StandingsRow } from '../types';
import { calculateStandings, formatStandingsForSharing } from '../utils/standings';
import { HeadToHeadTracker } from './HeadToHeadTracker';
import { TeamTracker } from './TeamTracker';
import {
  Trophy,
  Medal,
  Share2,
  Check,
  Search,
  ArrowUpDown,
  Filter,
  Download,
  Info,
  LayoutList,
  Table,
  Swords,
  Users,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface StandingsViewProps {
  players: Player[];
  rounds: Round[];
  config: SessionConfig;
}

type SortField = 'rank' | 'name' | 'mp' | 'won' | 'diff' | 'winRate' | 'pf';

export const StandingsView: React.FC<StandingsViewProps> = ({
  players,
  rounds,
  config,
}) => {
  const [viewTab, setViewTab] = useState<'leaderboard' | 'h2h' | 'teams'>('leaderboard');
  const [selectedRoundFilter, setSelectedRoundFilter] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [copied, setCopied] = useState(false);
  const [displayMode, setDisplayMode] = useState<'cards' | 'table'>('cards');

  // Compute standings
  const rawStandings = useMemo(() => {
    return calculateStandings(
      players,
      rounds,
      selectedRoundFilter === 'all' ? undefined : selectedRoundFilter
    );
  }, [players, rounds, selectedRoundFilter]);

  // Filter by search
  const filteredStandings = useMemo(() => {
    if (!searchQuery.trim()) return rawStandings;
    const q = searchQuery.toLowerCase();
    return rawStandings.filter((row) => row.playerName.toLowerCase().includes(q));
  }, [rawStandings, searchQuery]);

  // Sort
  const sortedStandings = useMemo(() => {
    const list = [...filteredStandings];
    list.sort((a, b) => {
      let result = 0;
      switch (sortField) {
        case 'rank':
          // default order in rawStandings
          return 0;
        case 'name':
          result = a.playerName.localeCompare(b.playerName);
          break;
        case 'mp':
          result = a.matchesPlayed - b.matchesPlayed;
          break;
        case 'won':
          result = a.won - b.won;
          break;
        case 'diff':
          result = a.pointDiff - b.pointDiff;
          break;
        case 'winRate':
          result = a.winRate - b.winRate;
          break;
        case 'pf':
          result = a.pointsFor - b.pointsFor;
          break;
      }
      return sortDirection === 'asc' ? result : -result;
    });
    return list;
  }, [filteredStandings, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // For numeric stats, default to descending
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  const handleCopyStandings = () => {
    const text = formatStandingsForSharing(
      config.sessionName,
      rawStandings,
      rounds.filter((r) => r.completed || r.matches.some((m) => m.completed)).length
    );
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch {
      // ignore
    }
  };

  const handleDownloadCsv = () => {
    const headers = ['Rank', 'Player', 'Matches Played', 'Wins', 'Losses', 'Ties', 'Points For', 'Points Against', 'Diff', 'Win %'];
    const rows = rawStandings.map((r, i) => [
      i + 1,
      `"${r.playerName}"`,
      r.matchesPlayed,
      r.won,
      r.lost,
      r.tied,
      r.pointsFor,
      r.pointsAgainst,
      r.pointDiff,
      `${r.winRate}%`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${config.sessionName.replace(/\s+/g, '_')}_standings.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const top3 = rawStandings.filter((r) => r.matchesPlayed > 0).slice(0, 3);
  const totalMatchesCompleted = rounds.reduce(
    (acc, r) => acc + r.matches.filter((m) => m.completed).length,
    0
  );

  return (
    <div id="standings-view" className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 sm:gap-2.5">
            <span className="w-1.5 h-5 sm:w-2 sm:h-6 bg-yellow-400 rounded-full"></span>
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
            <h2 className="text-base sm:text-xl font-black text-indigo-950">Session Standings</h2>
          </div>
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5 sm:mt-1">
            Real-time standings with equal rotation fairness tracking across all courts
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end">
          {/* Round Selector Filter */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-100 rounded-xl sm:rounded-2xl px-2.5 sm:px-3 py-1.5 border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-indigo-600" />
            <select
              id="select-standings-round-filter"
              value={selectedRoundFilter}
              onChange={(e) =>
                setSelectedRoundFilter(
                  e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10)
                )
              }
              className="bg-transparent text-[11px] sm:text-xs font-bold text-slate-800 outline-none cursor-pointer pr-1"
            >
              <option value="all">All Rounds (Cumulative)</option>
              {rounds.map((r) => (
                <option key={r.roundNumber} value={r.roundNumber}>
                  Round {r.roundNumber} Only
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            id="btn-copy-standings"
            onClick={handleCopyStandings}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer"
            title="Copy formatted standings to post in Reclub, WhatsApp, or Telegram"
            aria-label="Copy formatted standings"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-yellow-400" /> Copied!
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" /> <span>Copy</span>
              </>
            )}
          </button>

          <button
            type="button"
            id="btn-export-csv"
            onClick={handleDownloadCsv}
            className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Export CSV spreadsheet"
            aria-label="Export CSV spreadsheet"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub Tab Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-2xl w-fit max-w-full overflow-x-auto shadow-2xs">
        <button
          type="button"
          id="tab-standings-leaderboard"
          onClick={() => setViewTab('leaderboard')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${
            viewTab === 'leaderboard'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Individual Standings</span>
        </button>

        <button
          type="button"
          id="tab-standings-h2h"
          onClick={() => setViewTab('h2h')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${
            viewTab === 'h2h'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          <span>Head to Head</span>
        </button>

        <button
          type="button"
          id="tab-standings-teams"
          onClick={() => setViewTab('teams')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${
            viewTab === 'teams'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Team Matchups</span>
        </button>
      </div>

      {viewTab === 'leaderboard' ? (
        <>
          {/* Top 3 Podium Cards (when matches have been recorded) */}
          {top3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          {top3.map((player, idx) => {
            const isFirst = idx === 0;
            const isSecond = idx === 1;

            return (
              <div
                key={player.playerId}
                className={`rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm relative overflow-hidden transition-all ${
                  isFirst
                    ? 'bg-yellow-400 text-slate-950 border border-yellow-500/40 shadow-md'
                    : isSecond
                    ? 'bg-indigo-900 text-white border border-indigo-800 shadow-md'
                    : 'bg-white text-slate-950 border border-slate-200'
                }`}
              >
                {/* Decorative circle */}
                <div
                  className={`absolute -right-8 -top-8 w-24 sm:w-28 h-24 sm:h-28 rounded-full pointer-events-none opacity-50 ${
                    isFirst ? 'bg-yellow-300' : isSecond ? 'bg-indigo-800' : 'bg-slate-100'
                  }`}
                />

                <div className="relative z-10 flex items-center justify-between mb-2 sm:mb-3">
                  <span
                    className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full ${
                      isFirst
                        ? 'bg-black text-yellow-300'
                        : isSecond
                        ? 'bg-black text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {idx === 0 ? '🥇 1st Place' : idx === 1 ? '🥈 2nd Place' : '🥉 3rd Place'}
                  </span>
                  <span
                    className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                      isFirst
                        ? 'bg-black text-white'
                        : isSecond
                        ? 'bg-yellow-400 text-indigo-950 font-black'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {player.winRate}% Win
                  </span>
                </div>

                <div className="relative z-10 flex items-center gap-2.5 sm:gap-3">
                  <span
                    className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-black text-xs sm:text-sm border border-white shadow-xs shrink-0 ${player.avatarColor}`}
                  >
                    {player.playerName.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <h3
                      className={`font-black text-sm sm:text-base leading-snug truncate ${
                        isFirst ? 'text-slate-950' : isSecond ? 'text-white' : 'text-slate-950'
                      }`}
                    >
                      {player.playerName}
                    </h3>
                    <div
                      className={`text-[11px] sm:text-xs font-bold mt-0.5 ${
                        isFirst ? 'text-slate-800' : isSecond ? 'text-indigo-200' : 'text-slate-600'
                      }`}
                    >
                      Record: <strong>{player.won}W - {player.lost}L</strong> • Diff:{' '}
                      <strong
                        className={
                          isFirst || isSecond
                            ? 'font-black'
                            : player.pointDiff >= 0
                            ? 'text-indigo-700 font-black'
                            : 'text-rose-700 font-black'
                        }
                      >
                        {player.pointDiff > 0 ? `+${player.pointDiff}` : player.pointDiff}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Search bar, display mode toggle & count */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-search-standings"
                type="text"
                placeholder="Search player name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-200 text-xs font-semibold text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            {/* View Mode Toggle: Cards (default for mobile) vs Table */}
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-xl sm:rounded-2xl shrink-0">
              <button
                type="button"
                id="btn-standings-view-cards"
                onClick={() => setDisplayMode('cards')}
                className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-black transition-all cursor-pointer ${
                  displayMode === 'cards'
                    ? 'bg-white text-indigo-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
                title="Mobile Cards View"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                id="btn-standings-view-table"
                onClick={() => setDisplayMode('table')}
                className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs font-black transition-all cursor-pointer ${
                  displayMode === 'table'
                    ? 'bg-white text-indigo-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
                title="Full Grid Table View"
              >
                <Table className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] sm:text-xs text-slate-600 font-bold self-start sm:self-auto">
            Showing {sortedStandings.length} players • {totalMatchesCompleted} matches completed
          </div>
        </div>

        {/* Mobile Cards View */}
        {displayMode === 'cards' ? (
          <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3.5">
            {sortedStandings.map((row, index) => {
              const isLeader = index === 0 && row.won > 0;
              return (
                <div
                  key={`standings-card-${row.playerId}`}
                  id={`standings-card-${row.playerId}`}
                  className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${
                    isLeader
                      ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/30'
                      : index === 1 && row.won > 0
                      ? 'bg-slate-50 border-slate-300'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Top Row: Rank, Avatar, Name, Win % */}
                  <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-black text-xs flex items-center justify-center shrink-0">
                        {index === 0 && row.won > 0 ? '🥇' : index === 1 && row.won > 0 ? '🥈' : index === 2 && row.won > 0 ? '🥉' : `#${index + 1}`}
                      </span>
                      <span
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-black border border-white shadow-xs shrink-0 ${row.avatarColor}`}
                      >
                        {row.playerName.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 sm:gap-1.5">
                          <span className="font-black text-slate-900 text-xs sm:text-sm truncate">{row.playerName}</span>
                          {!row.active && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                              Break
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {row.matchesPlayed} {row.matchesPlayed === 1 ? 'match' : 'matches'} played
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-block px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl bg-indigo-100 text-indigo-900 font-black text-xs">
                        {row.winRate}% Win
                      </span>
                    </div>
                  </div>

                  {/* Middle Row: Primary Record & Diff */}
                  <div className="flex items-center justify-between bg-slate-50/90 rounded-lg sm:rounded-xl p-2 sm:p-2.5 border border-slate-100 mb-2">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider">Record:</span>
                      <span className="text-sm sm:text-base font-black text-indigo-950">
                        {row.won}W <span className="text-slate-300">-</span> {row.lost}L {row.tied > 0 && <span className="text-slate-500 text-xs">({row.tied}T)</span>}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <span className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider">Diff:</span>
                      <span
                        className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded-md sm:rounded-lg text-xs font-black ${
                          row.pointDiff > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.pointDiff < 0
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Row: Points details & Form */}
                  <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-600 font-semibold pt-1 border-t border-slate-100">
                    <div>
                      <span>PF: <strong className="text-slate-900">{row.pointsFor}</strong></span>
                      <span className="mx-1 text-slate-300">•</span>
                      <span>PA: <strong className="text-slate-900">{row.pointsAgainst}</strong></span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-black mr-0.5">Form:</span>
                      {(!row.recentFormDetails || row.recentFormDetails.length === 0) && (!row.recentForm || row.recentForm.length === 0) ? (
                        <span className="text-[10px] text-slate-400 italic">None</span>
                      ) : (
                        (row.recentFormDetails || row.recentForm.map((res, idx) => ({ matchId: `legacy-${idx}`, result: res })))
                          .slice(-4)
                          .map((item) => (
                            <span
                              key={`card-form-${row.playerId}-${item.matchId}`}
                              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-[9px] font-black text-white flex items-center justify-center ${
                                item.result === 'W' ? 'bg-indigo-600' : item.result === 'L' ? 'bg-rose-500' : 'bg-slate-400'
                              }`}
                            >
                              {item.result}
                            </span>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table */
          <div className="overflow-x-auto">
          <table id="standings-table" className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-indigo-950 font-black uppercase tracking-wider text-[11px]">
                <th
                  className="py-3.5 px-4 w-14 cursor-pointer hover:bg-slate-200/60"
                  onClick={() => handleSort('rank')}
                >
                  <div className="flex items-center gap-1">
                    # <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  className="py-3.5 px-4 cursor-pointer hover:bg-slate-200/60"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Player <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  className="py-3.5 px-3 text-center cursor-pointer hover:bg-slate-200/60"
                  onClick={() => handleSort('mp')}
                  title="Matches Played"
                >
                  <div className="flex items-center justify-center gap-1">
                    MP <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  className="py-3.5 px-3 text-center cursor-pointer hover:bg-slate-200/60"
                  onClick={() => handleSort('won')}
                  title="Won"
                >
                  <div className="flex items-center justify-center gap-1">
                    W <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-3 text-center" title="Lost">
                  L
                </th>
                <th className="py-3.5 px-3 text-center" title="Tied">
                  T
                </th>
                <th
                  className="py-3.5 px-3 text-center cursor-pointer hover:bg-slate-200/60"
                  onClick={() => handleSort('pf')}
                  title="Points For"
                >
                  <div className="flex items-center justify-center gap-1">
                    PF <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-3 text-center" title="Points Against">
                  PA
                </th>
                <th
                  className="py-3.5 px-3 text-center cursor-pointer hover:bg-slate-200/60"
                  onClick={() => handleSort('diff')}
                  title="Point Differential"
                >
                  <div className="flex items-center justify-center gap-1">
                    +/- <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  className="py-3.5 px-4 text-center cursor-pointer hover:bg-slate-200/60"
                  onClick={() => handleSort('winRate')}
                  title="Win Percentage"
                >
                  <div className="flex items-center justify-center gap-1">
                    Win % <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center" title="Recent Form">
                  Form
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {sortedStandings.map((row, index) => {
                const isLeader = index === 0 && row.won > 0;
                return (
                  <tr
                    key={row.playerId}
                    id={`standings-row-${row.playerId}`}
                    className={`hover:bg-slate-50 transition-colors ${
                      isLeader ? 'bg-yellow-50/50 font-semibold' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-black text-slate-600">
                      {index === 0 && row.won > 0 ? (
                        <span className="text-indigo-900 font-black">🥇 1</span>
                      ) : index === 1 && row.won > 0 ? (
                        <span className="text-slate-700 font-black">🥈 2</span>
                      ) : index === 2 && row.won > 0 ? (
                        <span className="text-slate-700 font-black">🥉 3</span>
                      ) : (
                        `#${index + 1}`
                      )}
                    </td>

                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 border-white shadow-xs ${row.avatarColor}`}
                        >
                          {row.playerName.charAt(0)}
                        </span>
                        <span className="truncate text-sm">{row.playerName}</span>
                        {!row.active && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                            Break
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center font-black text-slate-900">
                      <span className="px-2 py-0.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                        {row.matchesPlayed}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center font-black text-indigo-700 text-sm">
                      {row.won}
                    </td>

                    <td className="py-3 px-3 text-center text-rose-600 font-bold">
                      {row.lost}
                    </td>

                    <td className="py-3 px-3 text-center text-slate-400 font-bold">
                      {row.tied}
                    </td>

                    <td className="py-3 px-3 text-center text-slate-800 font-bold">
                      {row.pointsFor}
                    </td>

                    <td className="py-3 px-3 text-center text-slate-500 font-bold">
                      {row.pointsAgainst}
                    </td>

                    <td className="py-3 px-3 text-center font-black">
                      <span
                        className={`inline-block min-w-8 py-0.5 px-2 rounded-xl text-xs font-black ${
                          row.pointDiff > 0
                            ? 'bg-indigo-100 text-indigo-800'
                            : row.pointDiff < 0
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1 font-black text-slate-900">
                        {row.winRate}%
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {(!row.recentFormDetails || row.recentFormDetails.length === 0) && (!row.recentForm || row.recentForm.length === 0) ? (
                          <span className="text-slate-400 text-[10px]">-</span>
                        ) : (
                          (row.recentFormDetails || row.recentForm.map((res, idx) => ({ matchId: `legacy-${idx}`, result: res })))
                            .map((item) => (
                              <span
                                key={`table-form-${row.playerId}-${item.matchId}`}
                                className={`w-4 h-4 rounded-md text-[9px] font-black flex items-center justify-center text-white ${
                                  item.result === 'W'
                                    ? 'bg-indigo-600'
                                    : item.result === 'L'
                                    ? 'bg-rose-500'
                                    : 'bg-slate-400'
                                }`}
                              >
                                {item.result}
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
        )}

        {/* Footer info note */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs font-semibold text-slate-600 flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            Rankings order: <strong>1. Most Wins</strong> → <strong>2. Point Differential</strong> →{' '}
            <strong>3. Total Points For</strong>. Notice that because of equal rotation, match counts stay strictly balanced across all players!
          </span>
        </div>
      </div>
      </>
      ) : viewTab === 'h2h' ? (
        <HeadToHeadTracker players={players} rounds={rounds} />
      ) : (
        <TeamTracker players={players} rounds={rounds} />
      )}
    </div>
  );
};
