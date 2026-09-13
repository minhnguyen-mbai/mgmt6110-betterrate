import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ComparisonInput, ComparisonResult, FxCurrentData, FxHistoryData, FxDataStatus } from './types';
import { calculateComparison } from './utils/calculations';
import { fetchCurrentFx, fetchHistoryFx, FxApiError } from './services/fxApi';
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
    amount: 3000,
  });

  // API State
  const [status, setStatus] = useState<FxDataStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentFx, setCurrentFx] = useState<FxCurrentData | null>(null);
  const [historyFx, setHistoryFx] = useState<FxHistoryData | null>(null);

  const loadFxData = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);

    try {
      // Parallel fetch to both endpoints
      const [currentData, historyData] = await Promise.all([
        fetchCurrentFx(),
        fetchHistoryFx(),
      ]);

      setCurrentFx(currentData);
      setHistoryFx(historyData);
      setStatus('success');
    } catch (err: unknown) {
      if (err instanceof FxApiError) {
        if (err.code === 'EMPTY_DATA') {
          setStatus('empty_data');
        } else if (err.code === 'PROVIDER_UNREACHABLE') {
          setStatus('provider_unreachable');
        } else {
          setStatus('provider_error');
        }
        setErrorMessage(err.userMessage);
      } else {
        setStatus('provider_error');
        setErrorMessage('The exchange-rate provider could not complete this request.');
      }
    }
  }, []);

  useEffect(() => {
    loadFxData();
  }, [loadFxData]);

  // Derive today's rate and benchmark averages
  const todayRate = currentFx ? currentFx.rate : null;
  const benchmark7d = historyFx?.benchmarks?.['7d']?.average ?? null;
  const benchmark30d = historyFx?.benchmarks?.['30d']?.average ?? null;

  const comparisonResult: ComparisonResult | null = useMemo(() => {
    if (todayRate === null || benchmark7d === null || benchmark30d === null) {
      return null;
    }

    const activeBenchmarkRate = input.benchmark === '7d' ? benchmark7d : benchmark30d;
    const activeBenchmarkName = input.benchmark === '7d' ? '7-day average' : '30-day average';

    return calculateComparison(input, todayRate, activeBenchmarkRate, activeBenchmarkName);
  }, [input, todayRate, benchmark7d, benchmark30d]);

  const handleNavigateTo = (screen: 1 | 2 | 3) => {
    if (screen > 1 && !comparisonResult) {
      return;
    }
    setCurrentScreen(screen);
    if (screen > maxVisitedScreen) {
      setMaxVisitedScreen(screen);
    }
  };

  const handleScreen1Submit = () => {
    if (comparisonResult) {
      handleNavigateTo(2);
    }
  };

  const handleUpdateAmount = (newAmount: number | null) => {
    setInput((prev) => ({ ...prev, amount: newAmount }));
  };

  const handleReset = () => {
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
          canNavigateTo={(step) => step <= maxVisitedScreen && comparisonResult !== null}
        />

        {/* Screen Container with Transitions */}
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
                  status={status}
                  errorMessage={errorMessage}
                  todayRate={todayRate}
                  benchmark7d={benchmark7d}
                  benchmark30d={benchmark30d}
                  lastRefreshed={currentFx?.lastRefreshed || historyFx?.lastRefreshed || null}
                  timeZone={currentFx?.timeZone || historyFx?.timeZone || null}
                  onRetry={loadFxData}
                />
              </motion.div>
            )}

            {currentScreen === 2 && comparisonResult && (
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
                  dailyPoints={historyFx?.daily || []}
                  onBack={() => handleNavigateTo(1)}
                  onNext={() => handleNavigateTo(3)}
                  onUpdateAmount={handleUpdateAmount}
                />
              </motion.div>
            )}

            {currentScreen === 3 && comparisonResult && (
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
          <span>BetterRate • Real-Time Alpha Vantage FX Exchange Rate Data</span>
          <span>Designed for non-trader consumers</span>
        </div>
      </footer>
    </div>
  );
}
