import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header id="app-header" className="w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div id="brand-logo-mark" className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            BR
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span id="brand-title" className="font-semibold text-slate-900 text-lg tracking-tight font-display">
                BetterRate
              </span>
              <span id="data-status-badge" className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Simulated Data
              </span>
            </div>
            <p id="brand-tagline" className="text-xs text-slate-500 hidden sm:block">
              Know if today’s rate is better for you.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span id="positioning-pill" className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200/60">
            Decision Support
          </span>
        </div>
      </div>
    </header>
  );
};
