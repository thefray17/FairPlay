import React from 'react';
import { TabType } from './Navbar';
import { LayoutGrid, Trophy, Users, History, Settings, Sparkles, Swords, Layers } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface MobileBottomNavProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  roundsCount: number;
  playersCount: number;
  hasActiveRound: boolean;
  onOpenConfig: () => void;
  hasActiveBracket?: boolean;
  hasActiveGroupStage?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onTabChange,
  roundsCount,
  playersCount,
  hasActiveRound,
  onOpenConfig,
  hasActiveBracket,
  hasActiveGroupStage,
}) => {
  const handleTabClick = (tab: TabType) => {
    soundFx.playPointChime();
    onTabChange(tab);
  };

  return (
    <nav
      id="mobile-bottom-navigation"
      aria-label="Mobile Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] md:hidden pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 px-2"
    >
      <div className="grid grid-cols-6 gap-0.5 items-center max-w-lg mx-auto">
        {/* Tab 1: Live Courts */}
        <button
          type="button"
          id="mobile-nav-tab-active"
          onClick={() => handleTabClick('active')}
          aria-label={roundsCount > 0 ? `Matches (Round ${roundsCount})` : 'Matches'}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl transition-all cursor-pointer relative min-h-[52px] ${
            currentTab === 'active'
              ? 'bg-indigo-600 text-white font-black shadow-sm'
              : 'text-slate-600 hover:text-indigo-900 hover:bg-slate-100/70 font-bold'
          }`}
        >
          <div className="relative">
            <LayoutGrid className="w-4.5 h-4.5" />
            {hasActiveRound && currentTab !== 'active' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 border-2 border-white rounded-full animate-ping" />
            )}
          </div>
          <span className="text-[9px] tracking-tight mt-1 leading-none">
            {roundsCount > 0 ? `R${roundsCount}` : 'Play'}
          </span>
        </button>

        {/* Tab 2: Standings */}
        <button
          type="button"
          id="mobile-nav-tab-standings"
          onClick={() => handleTabClick('standings')}
          aria-label="Standings Leaderboard"
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl transition-all cursor-pointer relative min-h-[52px] ${
            currentTab === 'standings'
              ? 'bg-indigo-600 text-white font-black shadow-sm'
              : 'text-slate-600 hover:text-indigo-900 hover:bg-slate-100/70 font-bold'
          }`}
        >
          <div className="relative">
            <Trophy className="w-4.5 h-4.5" />
            {currentTab !== 'standings' && (
              <span className="absolute -top-1 -right-1.5 px-1 bg-yellow-400 text-indigo-950 rounded-full text-[7px] font-black">
                Live
              </span>
            )}
          </div>
          <span className="text-[9px] tracking-tight mt-1 leading-none">Rankings</span>
        </button>

        {/* Tab 3: Group Stage */}
        <button
          type="button"
          id="mobile-nav-tab-groups"
          onClick={() => handleTabClick('groups')}
          aria-label="Group Stage Pools"
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl transition-all cursor-pointer relative min-h-[52px] ${
            currentTab === 'groups'
              ? 'bg-indigo-600 text-white font-black shadow-sm'
              : 'text-slate-600 hover:text-indigo-900 hover:bg-slate-100/70 font-bold'
          }`}
        >
          <div className="relative">
            <Layers className="w-4.5 h-4.5" />
            {hasActiveGroupStage && currentTab !== 'groups' && (
              <span className="absolute -top-1 -right-1.5 px-1 bg-amber-400 text-indigo-950 rounded-full text-[7px] font-black">
                Pools
              </span>
            )}
          </div>
          <span className="text-[9px] tracking-tight mt-1 leading-none">Groups</span>
        </button>

        {/* Tab 4: Bracket Playoff */}
        <button
          type="button"
          id="mobile-nav-tab-bracket"
          onClick={() => handleTabClick('bracket')}
          aria-label="Playoff Bracket"
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl transition-all cursor-pointer relative min-h-[52px] ${
            currentTab === 'bracket'
              ? 'bg-indigo-600 text-white font-black shadow-sm'
              : 'text-slate-600 hover:text-indigo-900 hover:bg-slate-100/70 font-bold'
          }`}
        >
          <div className="relative">
            <Swords className="w-4.5 h-4.5" />
            {hasActiveBracket && currentTab !== 'bracket' && (
              <span className="absolute -top-1 -right-1.5 px-1 bg-emerald-400 text-emerald-950 rounded-full text-[7px] font-black">
                Play
              </span>
            )}
          </div>
          <span className="text-[9px] tracking-tight mt-1 leading-none">Bracket</span>
        </button>

        {/* Tab 5: Squad & Bench */}
        <button
          type="button"
          id="mobile-nav-tab-players"
          onClick={() => handleTabClick('players')}
          aria-label={`Squad & Bench (${playersCount} players)`}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl transition-all cursor-pointer relative min-h-[52px] ${
            currentTab === 'players'
              ? 'bg-indigo-600 text-white font-black shadow-sm'
              : 'text-slate-600 hover:text-indigo-900 hover:bg-slate-100/70 font-bold'
          }`}
        >
          <div className="relative">
            <Users className="w-4.5 h-4.5" />
            <span
              className={`absolute -top-1 -right-2 px-1 rounded-full text-[7px] font-black ${
                currentTab === 'players'
                  ? 'bg-yellow-400 text-indigo-950'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              {playersCount}
            </span>
          </div>
          <span className="text-[9px] tracking-tight mt-1 leading-none">Squad</span>
        </button>

        {/* Tab 6: Match History */}
        <button
          type="button"
          id="mobile-nav-tab-history"
          onClick={() => handleTabClick('history')}
          aria-label={`Match History (${roundsCount} rounds)`}
          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl transition-all cursor-pointer relative min-h-[52px] ${
            currentTab === 'history'
              ? 'bg-indigo-600 text-white font-black shadow-sm'
              : 'text-slate-600 hover:text-indigo-900 hover:bg-slate-100/70 font-bold'
          }`}
        >
          <div className="relative">
            <History className="w-4.5 h-4.5" />
            {roundsCount > 0 && (
              <span
                className={`absolute -top-1 -right-2 px-1 rounded-full text-[7px] font-black ${
                  currentTab === 'history'
                    ? 'bg-yellow-400 text-indigo-950'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {roundsCount}
              </span>
            )}
          </div>
          <span className="text-[9px] tracking-tight mt-1 leading-none">History</span>
        </button>
      </div>
    </nav>
  );
};

