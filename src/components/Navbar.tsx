import React from 'react';
import { FairnessMetric, SessionConfig, Club } from '../types';
import {
  Trophy,
  LayoutGrid,
  History,
  Users,
  Settings,
  ShieldCheck,
  Shield,
  RotateCcw,
  Sparkles,
  Smartphone,
  Share2,
  Flame,
  Swords,
  Layers,
} from 'lucide-react';
import { PWAInstallButton } from './common/PWAInstallButton';

export type TabType = 'active' | 'standings' | 'groups' | 'bracket' | 'history' | 'players';

interface NavbarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  config: SessionConfig;
  fairness: FairnessMetric;
  playersCount: number;
  roundsCount: number;
  onOpenConfig: () => void;
  onOpenFairness: () => void;
  sessionId: string;
  onOpenTransfer: () => void;
  isSyncing?: boolean;
  onNavigateToOpenPlay?: () => void;
  hasActiveBracket?: boolean;
  hasActiveGroupStage?: boolean;
  activeClub?: Club | null;
  onOpenClubModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  config,
  fairness,
  playersCount,
  roundsCount,
  onOpenConfig,
  onOpenFairness,
  sessionId,
  onOpenTransfer,
  isSyncing,
  onNavigateToOpenPlay,
  hasActiveBracket,
  hasActiveGroupStage,
  activeClub,
  onOpenClubModal,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-indigo-600 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-13 sm:h-16 gap-2 sm:gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-yellow-400 rounded-lg sm:rounded-xl flex items-center justify-center shadow-inner text-indigo-900 font-black shrink-0">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-900 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-xl font-black tracking-tight text-white leading-tight">
                  FairPlay
                </h1>
                <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500/90 text-yellow-300 border border-indigo-400/60 inline-block shrink-0">
                  {config.sport.replace('-', ' ')}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-indigo-200 truncate max-w-[100px] xs:max-w-[140px] sm:max-w-xs font-semibold leading-tight">
                {config.sessionName}
              </p>
            </div>
          </div>

          {/* Right Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Open Play Navigation Button */}
            {onNavigateToOpenPlay && (
              <button
                type="button"
                id="btn-navbar-openplay"
                onClick={onNavigateToOpenPlay}
                className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black text-xs transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                title="Switch to Open Play FIFO Queue Mode"
                aria-label="Switch to Open Play FIFO Queue Mode"
              >
                <Flame className="w-3.5 h-3.5 fill-emerald-950 text-emerald-950 shrink-0" />
                <span className="hidden sm:inline">Open Play</span>
              </button>
            )}

            {/* PWA Install Button (auto-hides when standalone or unpromptable) */}
            <PWAInstallButton variant="navbar" />

            {/* Club / Squad Button */}
            {onOpenClubModal && (
              <button
                type="button"
                id="btn-navbar-club"
                onClick={onOpenClubModal}
                className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-xs active:scale-95 cursor-pointer shrink-0 border ${
                  activeClub
                    ? 'bg-indigo-500/90 hover:bg-indigo-400 text-white border-indigo-300/40'
                    : 'bg-indigo-700/60 hover:bg-indigo-700 text-indigo-200 border-indigo-500/40'
                }`}
                title={
                  activeClub
                    ? `Active Squad: ${activeClub.name} (PIN: ${activeClub.code})`
                    : 'Join or Create a Club / Squad'
                }
                aria-label={
                  activeClub
                    ? `Active Squad: ${activeClub.name}`
                    : 'Join or Create a Club / Squad'
                }
              >
                <Shield className={`w-3.5 h-3.5 shrink-0 ${activeClub ? 'text-yellow-300' : 'text-indigo-300'}`} />
                {activeClub ? (
                  <>
                    <span className="hidden md:inline max-w-[100px] truncate font-bold">{activeClub.name}</span>
                    <span className="font-mono text-[10px] bg-indigo-900/50 px-1 py-0.5 rounded text-yellow-300 font-bold">
                      {activeClub.code}
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] sm:text-xs">Squad</span>
                )}
              </button>
            )}

            {/* Session ID & Transfer Handover Button */}
            <button
              type="button"
              id="btn-navbar-session-transfer"
              onClick={onOpenTransfer}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-indigo-950 font-black text-xs transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
              title="Transfer Session to another phone or sync matches"
              aria-label="Transfer Session to another phone or sync matches"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-950 shrink-0" />
              <span className="font-mono font-black text-[11px] sm:text-xs tracking-wider">{sessionId}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation (Desktop / Tablet - Hidden on Mobile in favor of dedicated MobileBottomNav) */}
        <nav className="hidden md:flex items-center gap-5 overflow-x-auto border-t border-indigo-500/60 py-1.5 scrollbar-none font-bold text-xs uppercase tracking-wider">
          <button
            type="button"
            id="tab-active-courts"
            onClick={() => onTabChange('active')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'active'
                ? 'border-b-2 border-yellow-400 pb-1 text-white font-black'
                : 'text-indigo-200 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Live Matches</span>
            {roundsCount > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  currentTab === 'active' ? 'bg-yellow-400 text-indigo-950' : 'bg-indigo-800 text-indigo-200'
                }`}
              >
                R{roundsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            id="tab-standings"
            onClick={() => onTabChange('standings')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'standings'
                ? 'border-b-2 border-yellow-400 pb-1 text-white font-black'
                : 'text-indigo-200 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span>Standings</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400 text-indigo-950 font-black">
              Live
            </span>
          </button>

          <button
            type="button"
            id="tab-groups"
            onClick={() => onTabChange('groups')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'groups'
                ? 'border-b-2 border-yellow-400 pb-1 text-white font-black'
                : 'text-indigo-200 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4 text-yellow-400" />
            <span>Group Stage</span>
            {hasActiveGroupStage && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-indigo-950 font-black">
                Pools
              </span>
            )}
          </button>

          <button
            type="button"
            id="tab-bracket"
            onClick={() => onTabChange('bracket')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'bracket'
                ? 'border-b-2 border-yellow-400 pb-1 text-white font-black'
                : 'text-indigo-200 hover:text-white'
            }`}
          >
            <Swords className="w-4 h-4 text-yellow-400" />
            <span>Playoff Bracket</span>
            {hasActiveBracket && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-950 font-black">
                Active
              </span>
            )}
          </button>

          <button
            type="button"
            id="tab-history"
            onClick={() => onTabChange('history')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'history'
                ? 'border-b-2 border-yellow-400 pb-1 text-white font-black'
                : 'text-indigo-200 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Match History</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-800 text-indigo-200 font-bold">
              {roundsCount}
            </span>
          </button>

          <button
            type="button"
            id="tab-players"
            onClick={() => onTabChange('players')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'players'
                ? 'border-b-2 border-yellow-400 pb-1 text-white font-black'
                : 'text-indigo-200 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Squad &amp; Bench</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-800 text-indigo-200 font-bold">
              {playersCount}
            </span>
          </button>

          {/* Desktop Nav Settings Button */}
          <button
            type="button"
            id="tab-settings-nav"
            onClick={onOpenConfig}
            className="flex items-center gap-1.5 py-1.5 ml-auto text-indigo-200 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
            title="Session & Court Settings"
            aria-label="Session & Court Settings"
          >
            <Settings className="w-4 h-4 text-yellow-400" />
            <span>Settings</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
