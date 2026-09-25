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
  onCheck: () => void;
  onCheckAnother: () => void;
  haveSelectRef?: React.Ref<HTMLSelectElement>;
}

/**
 * Single-page decision support: input, then (after "Compare today's rate") the decision
 * with collapsed trend and calculation details.
 */
export const ComparisonPage: React.FC<ComparisonPageProps> = ({
  state,
  result,
  onChangeCurrency,
  onSwap,
  onBenchmarkChange,
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
            benchmark={state.benchmark}
            result={result}
            current={state.data.current}
            history={state.data.history}
            onCheckAnother={onCheckAnother}
          />
        </motion.div>
      )}
    </div>
  );
};
