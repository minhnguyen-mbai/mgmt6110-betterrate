import React from 'react';
import { motion } from 'motion/react';
import { BenchmarkType, ComparisonResult, CurrencyCode } from '../types';
import { ComparisonState } from '../state/comparisonState';
import { RateInputSection } from './RateInputSection';
import { DecisionResult } from './DecisionResult';

interface ComparisonPageProps {
  state: ComparisonState;
  result: ComparisonResult | null;
  onChangeCurrency: (side: 'have' | 'want', code: CurrencyCode) => void;
  onSwap: () => void;
  onBenchmarkChange: (benchmark: BenchmarkType) => void;
  onAmountChange: (amount: number | null) => void;
  onCheck: () => void;
  onCheckAnother: () => void;
  haveSelectRef?: React.Ref<HTMLSelectElement>;
}

/**
 * Single-page decision support: input, then (after "Check today's rate") the decision,
 * optional amount calculator, trend and collapsed details, then the disclaimer.
 */
export const ComparisonPage: React.FC<ComparisonPageProps> = ({
  state,
  result,
  onChangeCurrency,
  onSwap,
  onBenchmarkChange,
  onAmountChange,
  onCheck,
  onCheckAnother,
  haveSelectRef,
}) => {
  return (
    <div id="comparison-page" className="w-full">
      <RateInputSection
        haveCurrency={state.haveCurrency}
        wantCurrency={state.wantCurrency}
        benchmark={state.benchmark}
        status={state.status}
        errorMessage={state.errorMessage}
        onChangeCurrency={onChangeCurrency}
        onSwap={onSwap}
        onBenchmarkChange={onBenchmarkChange}
        onCheck={onCheck}
        haveSelectRef={haveSelectRef}
      />

      {result && state.data && (
        <motion.div
          key={state.data.pairKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          <DecisionResult
            haveCurrency={state.haveCurrency}
            wantCurrency={state.wantCurrency}
            benchmark={state.benchmark}
            result={result}
            current={state.data.current}
            history={state.data.history}
            onAmountChange={onAmountChange}
            onCheckAnother={onCheckAnother}
          />
        </motion.div>
      )}

      <div className="w-full max-w-xl mx-auto mt-5">
        {/* Product Positioning & Non-Advice Disclaimer */}
        <div id="disclaimer-note" className="p-4 rounded-xl bg-slate-100/60 border border-slate-200/70 text-[11px] text-slate-500 space-y-1 leading-relaxed">
          <p className="font-semibold text-slate-700">BetterRate Decision-Support Disclaimer</p>
          <p>
            BetterRate is an exchange-rate comparison tool using transparent deterministic formulas and daily exchange-rate data. It is not financial advice, a forex trading platform, a currency exchange service, or an investment forecast.
          </p>
        </div>
      </div>
    </div>
  );
};
