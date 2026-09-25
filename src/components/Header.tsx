import React from 'react';

export const Header: React.FC = () => {
  return (
    <header id="app-header" className="w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div id="brand-logo-mark" className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            BR
          </div>
          <span id="brand-title" className="font-semibold text-slate-900 text-lg tracking-tight font-display">
            BetterRate
          </span>
        </div>
      </div>
    </header>
  );
};
