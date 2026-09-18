import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpTipProps {
  title?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
}

export const HelpTip: React.FC<HelpTipProps> = ({
  title,
  children,
  ariaLabel = 'Show instructions',
  className = '',
  buttonClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={ariaLabel}
        className={`p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer inline-flex items-center justify-center ${
          isOpen ? 'text-indigo-600 bg-indigo-50' : ''
        } ${buttonClassName}`}
        title={title || ariaLabel}
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 top-full mt-1.5 w-72 sm:w-80 p-3.5 bg-white rounded-2xl shadow-xl border border-slate-200 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-100">
            {title && <span className="font-black text-slate-900 text-xs">{title}</span>}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 ml-auto cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="leading-relaxed space-y-1.5 text-slate-600">{children}</div>
        </div>
      )}
    </div>
  );
};
