import React from 'react';
import { OpenPlayConfig } from '../../types/openPlay';
import { OpenPlayTabType } from './OpenPlayMobileBottomNav';
import { sanitizeSessionCode } from '../../utils/sessionSync';
import {
  Flame,
  RotateCcw,
  Smartphone,
  Trophy,
  History,
  LayoutGrid,
  Users,
  Settings,
} from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface OpenPlayNavbarProps {
  config: OpenPlayConfig;
  winnersCount?: number;
  losersCount?: number;
  benchCount?: number;
  waitingCount?: number;
  playingCount?: number;
  activeMatchesCount: number;
  historyCount?: number;
  currentTab: OpenPlayTabType;
  onTabChange: (tab: OpenPlayTabType) => void;
  onOpenConfig: () => void;
  onNavigateToSocial: () => void;
  sessionId?: string;
  onOpenTransfer?: () => void;
  isSyncing?: boolean;
  lastSyncedAt?: number | null;
  onManualSync?: () => Promise<boolean>;
}

export const OpenPlayNavbar: React.FC<OpenPlayNavbarProps> = ({
  config,
  winnersCount = 0,
  losersCount = 0,
  benchCount = 0,
  waitingCount = 0,
  activeMatchesCount,
  historyCount = 0,
  currentTab,
  onTabChange,
  onOpenConfig,
  onNavigateToSocial,
  sessionId,
  onOpenTransfer,
  isSyncing = false,
  lastSyncedAt = null,
  onManualSync,
}) => {
  const displaySessionId = sessionId ? sanitizeSessionCode(sessionId) : '';

  const handleTransferClick = () => {
    if (onOpenTransfer) {
      onOpenTransfer();
    } else {
      window.dispatchEvent(new CustomEvent('open-transfer-modal'));
    }
  };

  const totalWaiting = (winnersCount + losersCount + benchCount) || waitingCount;

  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-13 sm:h-16 gap-2 sm:gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-yellow-400 rounded-lg sm:rounded-xl flex items-center justify-center shadow-inner text-emerald-950 font-black shrink-0">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-950 fill-emerald-950 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-xl font-black tracking-tight text-white leading-tight">
                  FairPlay
                </h1>
                <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-700/90 text-yellow-300 border border-emerald-600/60 inline-block shrink-0">
                  Open Play
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-emerald-200/90 truncate max-w-[120px] xs:max-w-[160px] sm:max-w-xs font-semibold leading-tight">
                {config.courtsCount} {config.courtsCount === 1 ? 'Court' : 'Courts'} • {config.format}
              </p>
            </div>
          </div>

          {/* Right Tools - Clean & Uncrowded */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Switch to Social Tournament */}
            <button
              type="button"
              id="btn-nav-switch-to-social"
              onClick={onNavigateToSocial}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
              title="Switch to FairPlay Social Matches"
              aria-label="Switch to FairPlay Social Matches"
            >
              <RotateCcw className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
              <span className="hidden sm:inline">Social</span>
            </button>

            {/* PWA Install Button */}
            <PWAInstallButton variant="openplay" />

            {/* Session ID & Transfer Handover Button */}
            <button
              type="button"
              id="btn-openplay-session-transfer"
              onClick={handleTransferClick}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-emerald-950 font-black text-xs transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
              title="Transfer Session to another phone or sync matches"
              aria-label="Transfer Session to another phone or sync matches"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-950 shrink-0" />
              <span className="font-mono font-black text-[11px] sm:text-xs tracking-wider">{displaySessionId || 'Session'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation (Desktop / Tablet - Hidden on Mobile in favor of dedicated OpenPlayMobileBottomNav) */}
        <nav className="hidden md:flex items-center gap-5 overflow-x-auto border-t border-emerald-700/60 py-1.5 scrollbar-none font-bold text-xs uppercase tracking-wider">
          {/* Matches */}
          <button
            type="button"
            id="tab-openplay-matches"
            onClick={() => onTabChange('matches')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'matches'
                ? 'border-b-2 border-yellow-400 pb-1 text-white font-black'
                : 'text-emerald-200 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Live Matches</span>
            {activeMatchesCount > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  currentTab === 'matches' ? 'bg-yellow-400 text-emerald-950' : 'bg-emerald-800 text-emerald-200'
                }`}
              >
                {activeMatchesCount}
              </span>
            )}
          </button>

          {/* Standings */}
          <button
            type="button"
            id="tab-openplay-standings"
            onClick={() => onTabChange('standings')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'standings'
                ? 'border-b-2 border-yellow-400 pb-1 text-white font-black'
                : 'text-emerald-200 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span>Standings</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400 text-emerald-950 font-black">
              Live
            </span>
          </button>

          {/* Buckets */}
          <button
            type="button"
            id="tab-openplay-buckets"
            onClick={() => onTabChange('buckets')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'buckets' || currentTab === 'squad'
                ? 'border-b-2 border-yellow-400 pb-1 text-white font-black'
                : 'text-emerald-200 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Buckets</span>
            {totalWaiting > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-200 font-bold">
                {totalWaiting}
              </span>
            )}
          </button>

          {/* History */}
          <button
            type="button"
            id="tab-openplay-history"
            onClick={() => onTabChange('history')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap cursor-pointer ${
              currentTab === 'history'
                ? 'border-b-2 border-yellow-400 pb-1 text-white font-black'
                : 'text-emerald-200 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Match History</span>
            {historyCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-200 font-bold">
                {historyCount}
              </span>
            )}
          </button>

          {/* Desktop Nav Settings Button */}
          <button
            type="button"
            id="tab-openplay-settings-nav"
            onClick={onOpenConfig}
            className="flex items-center gap-1.5 py-1.5 ml-auto text-emerald-200 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
            title="Open Play Settings"
            aria-label="Open Play Settings"
          >
            <Settings className="w-4 h-4 text-yellow-400" />
            <span>Settings</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
