import React, { useState } from 'react';
import { Download, Share, X, Check } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'navbar' | 'openplay' | 'pill';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'navbar',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running in standalone PWA mode, don't show the install button
  if (isInstalled) {
    return null;
  }

  const handleInstall = async () => {
    if (isInstallable) {
      setInstalling(true);
      await install();
      setInstalling(false);
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  // If not installable on Chromium and not iOS, suppress
  if (!isInstallable && !isIOS) {
    return null;
  }

  const buttonContent = (
    <>
      <Download className="w-3.5 h-3.5 shrink-0" />
      <span className="font-semibold text-xs tracking-wide">
        {isIOS ? 'Install' : installing ? 'Installing...' : 'Install'}
      </span>
    </>
  );

  let btnClasses = '';
  if (variant === 'openplay') {
    btnClasses =
      'inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 text-white font-black text-xs transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 border border-emerald-500/40';
  } else if (variant === 'navbar') {
    btnClasses =
      'inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer shrink-0 border border-indigo-400/30';
  } else {
    btnClasses =
      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white font-medium text-xs hover:bg-slate-800 transition-all shadow-sm active:scale-95 cursor-pointer shrink-0';
  }

  return (
    <>
      <button
        type="button"
        id="btn-pwa-install"
        onClick={handleInstall}
        className={`${btnClasses} ${className}`}
        title="Install FairPlay app to Home Screen for fast courtside access"
        aria-label="Install FairPlay as a home screen app"
      >
        {buttonContent}
      </button>

      {/* iOS Add to Home Screen Instructions Modal */}
      {showIOSModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-slate-200 text-slate-900 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">Install FairPlay</h3>
                  <p className="text-xs text-slate-500 font-medium">Add to your iPhone / iPad Home Screen</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-slate-700 font-medium bg-slate-50 p-4 rounded-xl border border-slate-100 mb-5">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Tap the <strong className="text-slate-900 inline-flex items-center gap-1 font-bold">Share <Share className="w-3.5 h-3.5 inline" /></strong> button in the Safari bottom bar.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Scroll down the menu and tap <strong className="text-slate-900 font-bold">Add to Home Screen</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Tap <strong className="text-indigo-600 font-bold">Add</strong> in the top-right corner to finish.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
