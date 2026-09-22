import React from 'react';
import { TabType } from './Navbar';
import { LayoutGrid, Trophy, Users, History, Settings, Sparkles } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface MobileBottomNavProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  roundsCount: number;
  playersCount: number;
  hasActiveRound: boolean;
  onOpenConfig: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onTabChange,
  roundsCount,
  playersCount,
  hasActiveRound,
  onOpenConfig,
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
      <div className="grid grid-cols-5 gap-1 items-center max-w-md mx-auto">
        {/* Tab 1: Live Courts */}
        <button
          type="button"
          id="mobile-nav-tab-active"
          onClick={() => handleTabClick('active')}
          aria-label={roundsCount > 0 ? `Matches (Round ${roundsCount})` : 'Matches'}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer relative min-h-[52px] ${
            currentTab === 'active'
              ? 'bg-indigo-600 text-white font-black shadow-sm'
              : 'text-slate-600 hover:text-indigo-900 hover:bg-slate-100/70 font-bold'
          }`}
        >
          <div className="relative">
            <LayoutGrid className="w-5 h-5" />
            {hasActiveRound && currentTab !== 'active' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 border-2 border-white rounded-full animate-ping" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1 leading-none">
            {roundsCount > 0 ? `Matches (R${roundsCount})` : 'Matches'}
          </span>
        </button>

        {/* Tab 2: Standings */}
        <button
          type="button"
          id="mobile-nav-tab-standings"
          onClick={() => handleTabClick('standings')}
          aria-label="Standings Leaderboard"
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer relative min-h-[52px] ${
            currentTab === 'standings'
              ? 'bg-indigo-600 text-white font-black shadow-sm'
              : 'text-slate-600 hover:text-indigo-900 hover:bg-slate-100/70 font-bold'
          }`}
        >
          <div className="relative">
            <Trophy className="w-5 h-5" />
            {currentTab !== 'standings' && (
              <span className="absolute -top-1 -right-1.5 px-1 bg-yellow-400 text-indigo-950 rounded-full text-[8px] font-black">
                Live
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1 leading-none">Standings</span>
        </button>

        {/* Tab 3: Squad & Bench */}
        <button
          type="button"
          id="mobile-nav-tab-players"
          onClick={() => handleTabClick('players')}
          aria-label={`Squad & Bench (${playersCount} players)`}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer relative min-h-[52px] ${
            currentTab === 'players'
              ? 'bg-indigo-600 text-white font-black shadow-sm'
              : 'text-slate-600 hover:text-indigo-900 hover:bg-slate-100/70 font-bold'
          }`}
        >
          <div className="relative">
            <Users className="w-5 h-5" />
            <span
              className={`absolute -top-1 -right-2 px-1 rounded-full text-[8px] font-black ${
                currentTab === 'players'
                  ? 'bg-yellow-400 text-indigo-950'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              {playersCount}
            </span>
          </div>
          <span className="text-[10px] tracking-tight mt-1 leading-none">Squad</span>
        </button>

        {/* Tab 4: Match History */}
        <button
          type="button"
          id="mobile-nav-tab-history"
          onClick={() => handleTabClick('history')}
          aria-label={`Match History (${roundsCount} rounds)`}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer relative min-h-[52px] ${
            currentTab === 'history'
              ? 'bg-indigo-600 text-white font-black shadow-sm'
              : 'text-slate-600 hover:text-indigo-900 hover:bg-slate-100/70 font-bold'
          }`}
        >
          <div className="relative">
            <History className="w-5 h-5" />
            {roundsCount > 0 && (
              <span
                className={`absolute -top-1 -right-2 px-1 rounded-full text-[8px] font-black ${
                  currentTab === 'history'
                    ? 'bg-yellow-400 text-indigo-950'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {roundsCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1 leading-none">History</span>
        </button>

        {/* Tab 5: Settings / Session Config */}
        <button
          type="button"
          id="mobile-nav-btn-settings"
          onClick={() => {
            soundFx.playPointChime();
            onOpenConfig();
          }}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer text-slate-600 hover:text-indigo-900 hover:bg-slate-100/70 font-bold min-h-[52px]"
          title="Court & Session Settings"
          aria-label="Court & Session Settings"
        >
          <Settings className="w-5 h-5 text-indigo-600" />
          <span className="text-[10px] tracking-tight mt-1 leading-none">Config</span>
        </button>
      </div>
    </nav>
  );
};
