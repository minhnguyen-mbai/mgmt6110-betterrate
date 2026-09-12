import React from 'react';
import { Check, ArrowRight } from 'lucide-react';

interface ScreenIndicatorProps {
  currentScreen: 1 | 2 | 3;
  onSelectScreen: (screen: 1 | 2 | 3) => void;
  canNavigateTo: (screen: 1 | 2 | 3) => boolean;
}

export const ScreenIndicator: React.FC<ScreenIndicatorProps> = ({
  currentScreen,
  onSelectScreen,
  canNavigateTo,
}) => {
  const steps = [
    { num: 1 as const, label: 'Check Rate' },
    { num: 2 as const, label: 'Rate Comparison' },
    { num: 3 as const, label: 'Summary' },
  ];

  return (
    <nav id="stepper-navigation" aria-label="Progress steps" className="w-full max-w-md mx-auto mb-5 px-1 sm:px-2">
      <ol className="flex items-center justify-between relative">
        <div className="absolute left-8 right-8 top-5 -translate-y-1/2 h-0.5 bg-slate-200 z-0 pointer-events-none" />
        
        {steps.map((step) => {
          const isActive = currentScreen === step.num;
          const isCompleted = currentScreen > step.num;
          const isNavigable = canNavigateTo(step.num);

          return (
            <li key={step.num} className="relative z-10 flex flex-col items-center flex-1">
              <button
                id={`step-button-${step.num}`}
                type="button"
                disabled={!isNavigable}
                onClick={() => isNavigable && onSelectScreen(step.num)}
                aria-label={`Step ${step.num}: ${step.label}`}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center p-1.5 transition-all duration-150 ${
                  isNavigable ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm ring-4 ring-slate-100 scale-105'
                      : isCompleted
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-white border-2 border-slate-300 text-slate-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4 stroke-[2.5]" /> : step.num}
                </span>
              </button>
              <span
                id={`step-label-${step.num}`}
                className={`text-[11px] sm:text-xs font-medium text-center leading-tight transition-colors px-1 ${
                  isActive ? 'text-slate-900 font-bold' : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
