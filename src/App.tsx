import React, { useState, useMemo } from 'react';
import { ComparisonInput, ComparisonResult } from './types';
import { calculateComparison } from './utils/calculations';
import { Header } from './components/Header';
import { ScreenIndicator } from './components/ScreenIndicator';
import { Screen1CheckRate } from './components/Screen1CheckRate';
import { Screen2Comparison } from './components/Screen2Comparison';
import { Screen3Summary } from './components/Screen3Summary';
import { AnimatePresence, motion } from 'motion/react';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<1 | 2 | 3>(1);
  const [maxVisitedScreen, setMaxVisitedScreen] = useState<number>(1);

  const [input, setInput] = useState<ComparisonInput>({
    haveCurrency: 'VND',
    wantCurrency: 'SGD',
    benchmark: '7d',
    amount: 3000, // Pre-populated with the user prompt's MVP example S$3,000
  });

  const comparisonResult: ComparisonResult = useMemo(() => {
    return calculateComparison(input);
  }, [input]);

  const handleNavigateTo = (screen: 1 | 2 | 3) => {
    setCurrentScreen(screen);
    if (screen > maxVisitedScreen) {
      setMaxVisitedScreen(screen);
    }
  };

  const handleScreen1Submit = () => {
    handleNavigateTo(2);
  };

  const handleUpdateAmount = (newAmount: number | null) => {
    setInput((prev) => ({ ...prev, amount: newAmount }));
  };

  const handleReset = () => {
    // Return to Screen 1 for another check
    setCurrentScreen(1);
  };

  return (
    <div id="better-rate-app" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
      <Header />

      <main className="flex-1 w-full max-w-4xl mx-auto px-3.5 sm:px-6 py-4 sm:py-8 flex flex-col items-center">
        {/* Stepper Progress */}
        <ScreenIndicator
          currentScreen={currentScreen}
          onSelectScreen={handleNavigateTo}
          canNavigateTo={(step) => step <= maxVisitedScreen}
        />

        {/* Screen Container with Framer Motion Transition */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            {currentScreen === 1 && (
              <motion.div
                key="screen-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="w-full"
              >
                <Screen1CheckRate
                  input={input}
                  onChangeInput={setInput}
                  onSubmit={handleScreen1Submit}
                />
              </motion.div>
            )}

            {currentScreen === 2 && (
              <motion.div
                key="screen-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="w-full"
              >
                <Screen2Comparison
                  input={input}
                  result={comparisonResult}
                  onBack={() => handleNavigateTo(1)}
                  onNext={() => handleNavigateTo(3)}
                  onUpdateAmount={handleUpdateAmount}
                />
              </motion.div>
            )}

            {currentScreen === 3 && (
              <motion.div
                key="screen-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="w-full"
              >
                <Screen3Summary
                  input={input}
                  result={comparisonResult}
                  onReset={handleReset}
                  onBackToComparison={() => handleNavigateTo(2)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Subtle, Calm Footer */}
      <footer id="app-footer" className="w-full border-t border-slate-200/80 bg-white/70 py-4 px-4 text-center text-xs text-slate-400">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>BetterRate • Simulated Mock Exchange Rate Comparison</span>
          <span>Designed for non-trader consumers</span>
        </div>
      </footer>
    </div>
  );
}
