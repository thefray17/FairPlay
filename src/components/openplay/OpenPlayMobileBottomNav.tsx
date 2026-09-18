import React from 'react';
import { LayoutGrid, Trophy, Users, History, Settings } from 'lucide-react';
import { soundFx } from '../../utils/audio';

export type OpenPlayTabType = 'matches' | 'standings' | 'buckets' | 'history' | 'squad';

interface OpenPlayMobileBottomNavProps {
  currentTab: OpenPlayTabType;
  onTabChange: (tab: OpenPlayTabType) => void;
  activeMatchesCount: number;
  totalWaitingCount: number;
  historyCount: number;
  onOpenConfig: () => void;
}

export const OpenPlayMobileBottomNav: React.FC<OpenPlayMobileBottomNavProps> = ({
  currentTab,
  onTabChange,
  activeMatchesCount,
  totalWaitingCount,
  historyCount,
  onOpenConfig,
}) => {
  const isBucketsActive = currentTab === 'buckets' || currentTab === 'squad';

  const handleTabClick = (tab: OpenPlayTabType) => {
    soundFx.playPointChime();
    onTabChange(tab);
  };

  return (
    <nav
      id="openplay-mobile-bottom-navigation"
      aria-label="Open Play Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] md:hidden pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 px-2"
    >
      <div className="grid grid-cols-5 gap-1 items-center max-w-md mx-auto">
        {/* Tab 1: Matches */}
        <button
          type="button"
          id="openplay-mobile-nav-matches"
          onClick={() => handleTabClick('matches')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer relative min-h-[52px] ${
            currentTab === 'matches'
              ? 'bg-emerald-600 text-white font-black shadow-sm'
              : 'text-slate-600 hover:text-emerald-900 hover:bg-slate-100/70 font-bold'
          }`}
        >
          <div className="relative">
            <LayoutGrid className="w-5 h-5" />
            {activeMatchesCount > 0 && currentTab !== 'matches' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 border-2 border-white rounded-full animate-ping" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1 leading-none">
            {activeMatchesCount > 0 ? `Matches (${activeMatchesCount})` : 'Matches'}
          </span>
        </button>

        {/* Tab 2: Standings */}
        <button
          type="button"
          id="openplay-mobile-nav-standings"
          onClick={() => handleTabClick('standings')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer relative min-h-[52px] ${
            currentTab === 'standings'
              ? 'bg-emerald-600 text-white font-black shadow-sm'
              : 'text-slate-600 hover:text-emerald-900 hover:bg-slate-100/70 font-bold'
          }`}
        >
          <div className="relative">
            <Trophy className="w-5 h-5" />
            {currentTab !== 'standings' && (
              <span className="absolute -top-1 -right-1.5 px-1 bg-yellow-400 text-emerald-950 rounded-full text-[8px] font-black">
                Live
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1 leading-none">Standings</span>
        </button>

        {/* Tab 3: Buckets */}
        <button
          type="button"
          id="openplay-mobile-nav-buckets"
          onClick={() => handleTabClick('buckets')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer relative min-h-[52px] ${
            isBucketsActive
              ? 'bg-emerald-600 text-white font-black shadow-sm'
              : 'text-slate-600 hover:text-emerald-900 hover:bg-slate-100/70 font-bold'
          }`}
        >
          <div className="relative">
            <Users className="w-5 h-5" />
            {totalWaitingCount > 0 && (
              <span
                className={`absolute -top-1 -right-2 px-1 rounded-full text-[8px] font-black ${
                  isBucketsActive
                    ? 'bg-yellow-400 text-emerald-950'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {totalWaitingCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1 leading-none">Buckets</span>
        </button>

        {/* Tab 4: History */}
        <button
          type="button"
          id="openplay-mobile-nav-history"
          onClick={() => handleTabClick('history')}
          className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer relative min-h-[52px] ${
            currentTab === 'history'
              ? 'bg-emerald-600 text-white font-black shadow-sm'
              : 'text-slate-600 hover:text-emerald-900 hover:bg-slate-100/70 font-bold'
          }`}
        >
          <div className="relative">
            <History className="w-5 h-5" />
            {historyCount > 0 && (
              <span
                className={`absolute -top-1 -right-2 px-1 rounded-full text-[8px] font-black ${
                  currentTab === 'history'
                    ? 'bg-yellow-400 text-emerald-950'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {historyCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1 leading-none">History</span>
        </button>

        {/* Tab 5: Settings */}
        <button
          type="button"
          id="openplay-mobile-nav-settings"
          onClick={() => {
            soundFx.playPointChime();
            onOpenConfig();
          }}
          className="flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer text-slate-600 hover:text-emerald-900 hover:bg-slate-100/70 font-bold min-h-[52px]"
          title="Session & Court Settings"
        >
          <Settings className="w-5 h-5 text-emerald-600" />
          <span className="text-[10px] tracking-tight mt-1 leading-none">Settings</span>
        </button>
      </div>
    </nav>
  );
};
