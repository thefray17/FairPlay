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
  AlertCircle,
  Zap,
  Camera,
  Keyboard,
  Eye,
  KeyRound,
  Users,
  Lock,
} from 'lucide-react';
import {
  extractSessionId,
  sanitizeSessionCode,
  buildSessionShareUrl,
  getOrganizerToken,
  isSessionOrganizer,
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
  const [copiedJoinCode, setCopiedJoinCode] = useState(false);
  const [copiedViewLink, setCopiedViewLink] = useState(false);
  const [copiedEditLink, setCopiedEditLink] = useState(false);
  const [inputSession, setInputSession] = useState('');
  const [loadLoading, setLoadLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadSuccess, setLoadSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'share' | 'load'>('share');
  const [shareAccessMode, setShareAccessMode] = useState<'join_code' | 'edit_access'>('join_code');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [confirmNewSession, setConfirmNewSession] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  const cleanSessionId = sanitizeSessionCode(currentSessionId) || currentSessionId || '';
  const hasOrganizerAccess = isSessionOrganizer(cleanSessionId);
  const isEditMode = shareAccessMode === 'edit_access';

  const joinUrl = buildSessionShareUrl(cleanSessionId);
  const editUrl = buildSessionShareUrl(cleanSessionId, { editAccess: true });
  const activeShareUrl = isEditMode && hasOrganizerAccess ? editUrl : joinUrl;

  // Reset camera scanner and temporary alerts when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setShowCameraScanner(false);
      setLoadError(null);
      setLoadSuccess(null);
      setConfirmNewSession(false);
    }
  }, [isOpen]);

  // Generate QR code for the active share link
  useEffect(() => {
    if (!isOpen || !activeShareUrl) return;
    const isEditQr = isEditMode && hasOrganizerAccess;
    QRCode.toDataURL(activeShareUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: isEditQr ? '#7c2d12' : '#1e1b4b', // Amber/rust for admin, deep indigo for spectator
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code generation error:', err));
  }, [isOpen, activeShareUrl, isEditMode, hasOrganizerAccess]);

  if (!isOpen) return null;

  const handleCopyJoinCode = async () => {
    try {
      await navigator.clipboard.writeText(cleanSessionId);
      setCopiedJoinCode(true);
      soundFx.playPointChime();
      setTimeout(() => setCopiedJoinCode(false), 2500);
    } catch {
      setCopiedJoinCode(true);
      setTimeout(() => setCopiedJoinCode(false), 2500);
    }
  };

  const handleCopyViewLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedViewLink(true);
      soundFx.playPointChime();
      setTimeout(() => setCopiedViewLink(false), 2500);
    } catch {
      setCopiedViewLink(true);
      setTimeout(() => setCopiedViewLink(false), 2500);
    }
  };

  const handleCopyEditLink = async () => {
    try {
      await navigator.clipboard.writeText(editUrl);
      setCopiedEditLink(true);
      soundFx.playPointChime();
      setTimeout(() => setCopiedEditLink(false), 2500);
    } catch {
      setCopiedEditLink(true);
      setTimeout(() => setCopiedEditLink(false), 2500);
    }
  };

  const handleShareJoinCode = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `FairPlay Join Code: ${cleanSessionId}`,
          text: `Join session ${cleanSessionId} on FairPlay to view live courts and match scores:`,
          url: joinUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyViewLink();
        }
      }
    } else {
      handleCopyViewLink();
    }
  };

  const handleShareEditAccess = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `FairPlay Organizer Edit Access (${cleanSessionId})`,
          text: `Administrative organizer edit access link for FairPlay session ${cleanSessionId}:`,
          url: editUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyEditLink();
        }
      }
    } else {
      handleCopyEditLink();
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
                        This 4-digit code identifies the tournament session across all devices.
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
                      aria-label="Force cloud sync"
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
                    onClick={handleCopyJoinCode}
                    aria-label="Copy 4-digit join code"
                    className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
                  >
                    {copiedJoinCode ? (
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
                  <span className={`font-bold flex items-center gap-1 ${hasOrganizerAccess ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {hasOrganizerAccess ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Edit Privileges Active</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Read-Only Viewer</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Two Distinct Sharing Options: Share join code vs Share edit access */}
              <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 text-xs">
                <button
                  type="button"
                  id="btn-share-mode-join-code"
                  onClick={() => setShareAccessMode('join_code')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    !isEditMode
                      ? 'bg-white text-indigo-950 shadow-sm border border-slate-200/80 font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Share join code</span>
                  <span className="text-[10px] font-semibold text-slate-500 hidden sm:inline">(View Only)</span>
                </button>
                <button
                  type="button"
                  id="btn-share-mode-edit-access"
                  onClick={() => setShareAccessMode('edit_access')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isEditMode
                      ? 'bg-white text-amber-950 shadow-sm border border-amber-200 font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Share edit access</span>
                  <span className="text-[10px] font-semibold text-amber-700 hidden sm:inline">(Organizer Key)</span>
                </button>
              </div>

              {/* OPTION 1: Share Join Code (Public / View-Only) */}
              {!isEditMode && (
                <>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 flex items-start gap-2.5">
                    <Eye className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-slate-900">Public Join Code &amp; Spectator Link</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Anyone with the 4-digit code <span className="font-mono font-bold text-indigo-900">{cleanSessionId}</span> or this spectator link can follow live scores, court assignments, and queue standings in real-time. Spectators cannot edit matches or change settings.
                      </p>
                    </div>
                  </div>

                  {/* Public Viewer Link & Mobile Share */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                        Spectator View Link
                      </label>
                      <HelpTip title="Spectator View Link">
                        <p>
                          Share this read-only link with players and fans so they can watch courts live from their phones.
                        </p>
                      </HelpTip>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <input
                        type="text"
                        readOnly
                        value={joinUrl}
                        className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-xs text-slate-700 font-mono select-all focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        type="button"
                        id="btn-copy-join-code-link"
                        onClick={handleCopyViewLink}
                        aria-label="Copy spectator view link"
                        className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                        title="Copy view link"
                      >
                        {copiedViewLink ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">{copiedViewLink ? 'Copied' : 'Copy Link'}</span>
                      </button>
                      <button
                        type="button"
                        id="btn-share-join-code"
                        onClick={handleShareJoinCode}
                        aria-label="Share join code via mobile"
                        className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                        title="Share join code"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>

                  {/* Spectator QR Code Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt={`QR Code for Session ${cleanSessionId}`}
                          className="w-32 h-32 sm:w-36 sm:h-36 block"
                        />
                      ) : (
                        <div className="w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center bg-slate-100 rounded-xl">
                          <QrCode className="w-8 h-8 text-slate-400 animate-pulse" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-900">
                        <Eye className="w-3 h-3 text-indigo-700" />
                        <span>Public Spectator QR (Read-Only)</span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                        <h4 className="text-sm font-black text-slate-900">
                          Scan to View Live Scoreboard
                        </h4>
                        <HelpTip title="How Spectator QR Works">
                          <ol className="list-decimal list-inside space-y-1 pl-1">
                            <li>Players point their phone camera at this QR code.</li>
                            <li>Tap the banner to open FairPlay in view-only mode.</li>
                            <li>Live court rotations and match results appear instantly.</li>
                          </ol>
                        </HelpTip>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Players and viewers scan this code to follow live court assignments and scores without risking accidental edits.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* OPTION 2: Share Edit Access (Organizer / Administrative Write Key) */}
              {isEditMode && (
                <>
                  {hasOrganizerAccess ? (
                    <>
                      {/* Organizer Notice */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                        <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-bold text-amber-950">Administrative Organizer Edit Access</p>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            This link embeds your private organizer passkey. Anyone who scans or opens this link gains full permissions to record scores, pause court timers, adjust lineups, and modify session rules. Only share with your trusted court director.
                          </p>
                        </div>
                      </div>

                      {/* Edit Access Link & Mobile Share */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black uppercase tracking-wider text-amber-900 block">
                            Organizer Edit Link (Passkey Embedded)
                          </label>
                          <HelpTip title="Edit Link Passkey">
                            <p>
                              Contains the secret organizer token in the URL. Devices that load this link automatically receive full edit permissions.
                            </p>
                          </HelpTip>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <input
                            type="text"
                            readOnly
                            value={editUrl}
                            className="flex-1 min-w-0 bg-amber-50/70 border border-amber-300 rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-xs text-amber-950 font-mono select-all focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                          />
                          <button
                            type="button"
                            id="btn-copy-edit-link"
                            onClick={handleCopyEditLink}
                            aria-label="Copy organizer edit link"
                            className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                            title="Copy edit link"
                          >
                            {copiedEditLink ? (
                              <Check className="w-4 h-4 text-emerald-300" />
                            ) : (
                              <KeyRound className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline">{copiedEditLink ? 'Copied' : 'Copy Edit Link'}</span>
                          </button>
                          <button
                            type="button"
                            id="btn-share-edit-access"
                            onClick={handleShareEditAccess}
                            aria-label="Share edit access via mobile"
                            className="px-3.5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-black text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                            title="Share edit access"
                          >
                            <Share2 className="w-4 h-4" />
                            <span>Share</span>
                          </button>
                        </div>
                      </div>

                      {/* Organizer QR Code Card */}
                      <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                        <div className="bg-white p-2.5 rounded-2xl border border-amber-300 shadow-sm shrink-0">
                          {qrDataUrl ? (
                            <img
                              src={qrDataUrl}
                              alt={`Organizer QR Code for Session ${cleanSessionId}`}
                              className="w-32 h-32 sm:w-36 sm:h-36 block"
                            />
                          ) : (
                            <div className="w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center bg-amber-50 rounded-xl">
                              <QrCode className="w-8 h-8 text-amber-500 animate-pulse" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200">
                            <KeyRound className="w-3 h-3 text-amber-700" />
                            <span>Organizer Edit Access QR</span>
                          </div>
                          <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                            <h4 className="text-sm font-black text-slate-900">
                              Scan to Transfer Full Edit Controls
                            </h4>
                            <HelpTip title="Co-Organizer QR Handover">
                              <ol className="list-decimal list-inside space-y-1 pl-1">
                                <li>Open camera on the co-organizer's phone.</li>
                                <li>Scan this QR code and tap the link banner.</li>
                                <li>The other phone is instantly authorized to edit scores and court lineups.</li>
                              </ol>
                            </HelpTip>
                          </div>
                          <p className="text-xs text-amber-900/80 leading-relaxed">
                            Point co-organizer camera at this code to transfer full match controls and editing permissions to their device.
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Device is currently in read-only mode */
                    <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-5 text-center sm:text-left space-y-3">
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                          <Lock className="w-5 h-5" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-sm font-black text-slate-900">
                            Read-Only Session on this Device
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            You joined session <span className="font-mono font-bold text-slate-900">{cleanSessionId}</span> using a public join code or spectator link. Because this device does not possess an organizer passkey, you cannot record match results or share edit access with others.
                          </p>
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                        <p className="font-bold text-slate-800">Need to make edits on this device?</p>
                        <p className="text-[11px] text-slate-600">
                          Ask the session organizer to open <span className="font-semibold text-slate-800">Transfer &gt; Share edit access</span> on their phone and share their Edit Link or let you scan their Organizer QR code.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

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
                          Enter the 4-digit code (e.g. <span className="font-mono font-bold">4821</span>) or paste the full session link.
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
                      placeholder="e.g. 4821 or paste full session link"
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


