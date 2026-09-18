import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  Share2,
  Copy,
  Check,
  QrCode,
  Smartphone,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Zap,
  Camera,
  Keyboard,
} from 'lucide-react';
import {
  extractSessionId,
  sanitizeSessionCode,
  buildSessionShareUrl,
} from '../utils/sessionSync';
import { soundFx } from '../utils/audio';
import { QRCameraScanner } from './QRCameraScanner';
import { HelpTip } from './HelpTip';

interface TransferSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  onManualSync: () => Promise<boolean>;
  onLoadSession: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
  onGenerateNewSession: () => void;
  playersCount: number;
  roundsCount: number;
}

export const TransferSessionModal: React.FC<TransferSessionModalProps> = ({
  isOpen,
  onClose,
  currentSessionId,
  lastSyncedAt,
  isSyncing,
  onManualSync,
  onLoadSession,
  onGenerateNewSession,
  playersCount,
  roundsCount,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inputSession, setInputSession] = useState('');
  const [loadLoading, setLoadLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadSuccess, setLoadSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'share' | 'load'>('share');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [confirmNewSession, setConfirmNewSession] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  const cleanSessionId = sanitizeSessionCode(currentSessionId) || currentSessionId || '7429';
  const shareUrl = buildSessionShareUrl(cleanSessionId);

  // Reset camera scanner and temporary alerts when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setShowCameraScanner(false);
      setLoadError(null);
      setLoadSuccess(null);
      setConfirmNewSession(false);
    }
  }, [isOpen]);

  // Generate QR code for the share link
  useEffect(() => {
    if (!isOpen || !shareUrl) return;
    QRCode.toDataURL(shareUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: '#1e1b4b', // Deep indigo
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code generation error:', err));
  }, [isOpen, shareUrl]);

  if (!isOpen) return null;

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(cleanSessionId);
      setCopiedId(true);
      soundFx.playPointChime();
      setTimeout(() => setCopiedId(false), 2500);
    } catch {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      soundFx.playPointChime();
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `FairPlay Match Session (${currentSessionId})`,
          text: `Join and continue our badminton match session on your phone: ${currentSessionId}`,
          url: shareUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const executeLoad = async (rawInput: string) => {
    const clean = extractSessionId(rawInput);
    if (!clean) {
      setLoadError('Please enter a valid session ID or paste a session link');
      return;
    }

    setLoadLoading(true);
    setLoadError(null);
    setLoadSuccess(null);

    const res = await onLoadSession(clean);
    setLoadLoading(false);

    if (res.success) {
      setLoadSuccess(`Session ${clean} successfully transferred!`);
      soundFx.playVictoryFanfare();
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setLoadError(res.error || 'Failed to load session');
    }
  };

  const handleLoadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSession.trim()) return;
    executeLoad(inputSession);
  };

  const handleCameraScan = (scannedData: string) => {
    setShowCameraScanner(false);
    setInputSession(scannedData);
    executeLoad(scannedData);
  };

  const formatLastSync = () => {
    if (!lastSyncedAt) return 'Never synced';
    const diffSec = Math.floor((Date.now() - lastSyncedAt) / 1000);
    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin}m ago`;
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Cleaned title & Question Mark Help Tip */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 text-white p-5 sm:p-6 shrink-0 relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-indigo-950 flex items-center justify-center font-black shadow-md shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-lg sm:text-xl font-black text-white leading-tight truncate">
                  Transfer Match Session
                </h2>
                <HelpTip
                  title="Session Transfer"
                  buttonClassName="text-indigo-200 hover:text-yellow-300 hover:bg-indigo-800/60"
                >
                  <p>
                    Transfer tournament matches, active courts, open play queues, and player rosters to another phone seamlessly via QR code, direct link, or Session ID.
                  </p>
                </HelpTip>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Multi-device synchronization &amp; handoff
              </p>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-indigo-500/50">
            <button
              type="button"
              onClick={() => {
                setActiveTab('share');
                setShowCameraScanner(false);
              }}
              className={`flex-1 min-w-0 py-2 px-1 sm:px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center ${
                activeTab === 'share'
                  ? 'bg-yellow-400 text-indigo-950 shadow-md'
                  : 'bg-indigo-800/60 text-indigo-200 hover:bg-indigo-800'
              }`}
            >
              <span className="truncate block">Share Session</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('load')}
              className={`flex-1 min-w-0 py-2 px-1 sm:px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center ${
                activeTab === 'load'
                  ? 'bg-yellow-400 text-indigo-950 shadow-md'
                  : 'bg-indigo-800/60 text-indigo-200 hover:bg-indigo-800'
              }`}
            >
              <span className="truncate block">Paste &amp; Load Session</span>
            </button>
          </div>
        </div>

        {/* Modal Body - Scrollable */}
        <div className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto min-h-0">
          {activeTab === 'share' ? (
            <>
              {/* Session ID High-Visibility Card */}
              <div className="bg-indigo-50/70 border-2 border-indigo-100 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900">
                      Active Session ID
                    </span>
                    <HelpTip title="Session Data Scope">
                      <p>
                        This session code synchronizes all active courts, matches, scores, and Open Play bucket queues in real-time.
                      </p>
                    </HelpTip>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      <span className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-ping' : 'bg-emerald-500'}`} />
                      {isSyncing ? 'Syncing...' : `Cloud: ${formatLastSync()}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => onManualSync()}
                      disabled={isSyncing}
                      className="p-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-800 transition-colors cursor-pointer"
                      title="Force cloud sync"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 sm:gap-3 bg-white p-2.5 sm:p-3 rounded-xl border border-indigo-200 shadow-inner">
                  <div className="font-mono text-2xl sm:text-3xl md:text-4xl font-black text-indigo-950 tracking-widest truncate min-w-0">
                    {cleanSessionId}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                  >
                    {copiedId ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mt-2.5 text-[11px] text-slate-500">
                  <span>Includes: {playersCount} Players • {roundsCount} Social Rounds • Open Play Data</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Ready to transfer
                  </span>
                </div>
              </div>

              {/* Direct Link & Mobile Share */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                    Session Link
                  </label>
                  <HelpTip title="Direct Session Link">
                    <p>
                      Share this link with another phone. Opening it loads all active matches, standings, and players automatically.
                    </p>
                  </HelpTip>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-xs text-slate-700 font-mono select-all focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                    title="Copy full link"
                  >
                    {copiedLink ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{copiedLink ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                    title="Share via WhatsApp or Apps"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                </div>
              </div>

              {/* QR Code Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR Code for Session ${currentSessionId}`}
                      className="w-32 h-32 sm:w-36 sm:h-36 block"
                    />
                  ) : (
                    <div className="w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center bg-slate-100 rounded-xl">
                      <QrCode className="w-8 h-8 text-slate-400 animate-pulse" />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow-100 text-yellow-900 text-[10px] font-black uppercase tracking-wider">
                    <Zap className="w-3 h-3 text-yellow-700" />
                    Instant Camera Scan
                  </div>
                  <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                    <h4 className="text-sm font-black text-slate-900">
                      Scan with Phone Camera
                    </h4>
                    <HelpTip title="How Transfer Works">
                      <ol className="list-decimal list-inside space-y-1 pl-1">
                        <li>Point another phone camera at this QR code.</li>
                        <li>Tap the link banner that opens FairPlay.</li>
                        <li>All players and matches load immediately without losing progress.</li>
                      </ol>
                    </HelpTip>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Have someone scan this QR code with their camera to transfer the session immediately.
                  </p>
                </div>
              </div>

              {/* New Session Button */}
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-500">
                {!confirmNewSession ? (
                  <div className="flex items-center justify-between">
                    <span>Starting a brand new tournament day?</span>
                    <button
                      type="button"
                      id="btn-transfer-generate-new-session"
                      onClick={() => setConfirmNewSession(true)}
                      className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      Generate New Session ID
                    </button>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 space-y-1.5 animate-in fade-in duration-150">
                    <p className="text-[11px] font-bold text-amber-950">
                      Generate brand new Session ID? (Current session will remain locally saved)
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id="btn-transfer-confirm-new-session"
                        onClick={() => {
                          setConfirmNewSession(false);
                          onGenerateNewSession();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase cursor-pointer"
                      >
                        Confirm New ID
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmNewSession(false)}
                        className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Load Existing Session Tab (With Camera QR Scanner) */
            <div className="space-y-4">
              {showCameraScanner ? (
                /* Live Camera Scanner View */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-indigo-600" />
                      Live Camera Scanner
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCameraScanner(false)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Keyboard className="w-3.5 h-3.5" />
                      <span>Manual Input</span>
                    </button>
                  </div>

                  <QRCameraScanner
                    onScan={handleCameraScan}
                    onClose={() => setShowCameraScanner(false)}
                  />
                </div>
              ) : (
                /* Standard Form with Camera Scanner Launcher */
                <form onSubmit={handleLoadSubmit} className="space-y-4">
                  {/* Camera Launcher Card */}
                  <div className="bg-indigo-50/80 border border-indigo-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                        <h4 className="text-sm font-black text-indigo-950">
                          Scan Session QR Code
                        </h4>
                        <HelpTip title="Camera QR Scan">
                          <p>
                            Point this phone's camera at the QR code on the main phone to transfer the match session instantly.
                          </p>
                        </HelpTip>
                      </div>
                      <p className="text-xs text-indigo-800/80">
                        Scan the QR code displayed on the other device.
                      </p>
                    </div>
                    <button
                      type="button"
                      id="btn-start-qr-camera"
                      onClick={() => setShowCameraScanner(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Scan QR Code</span>
                    </button>
                  </div>

                  <div className="relative flex items-center justify-center my-1">
                    <div className="border-t border-slate-200 w-full" />
                    <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider absolute">
                      or paste session code
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                        4-Digit Session Code or Link
                      </label>
                      <HelpTip title="Session Code Format">
                        <p>
                          Enter the 4-digit code (e.g. <span className="font-mono font-bold">7429</span>) or paste the full session link.
                        </p>
                      </HelpTip>
                    </div>
                    <input
                      type="text"
                      value={inputSession}
                      onChange={(e) => {
                        setInputSession(e.target.value);
                        setLoadError(null);
                        setLoadSuccess(null);
                      }}
                      placeholder="e.g. 7429 or paste full session link"
                      className="w-full min-w-0 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-base sm:text-lg text-slate-900 font-mono tracking-wider placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                      autoFocus
                    />
                  </div>

                  {loadError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                      <span>{loadError}</span>
                    </div>
                  )}

                  {loadSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700 font-bold">
                      <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span>{loadSuccess}</span>
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={loadLoading || !inputSession.trim()}
                      className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {loadLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Transferring Matches &amp; Open Play...</span>
                        </>
                      ) : (
                        <>
                          <span>Load &amp; Continue Matches</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer - Always visible and clear */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 min-w-0">
            <Smartphone className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="truncate">FairPlay Multi-Device Sync</span>
          </div>
          <button
            type="button"
            id="btn-transfer-exit-modal"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};


