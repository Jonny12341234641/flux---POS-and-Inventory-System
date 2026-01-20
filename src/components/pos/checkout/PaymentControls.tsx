'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { Banknote, CreditCard, FileText, Repeat } from 'lucide-react';

import { StagingNumpad } from '../staging/StagingNumpad';
import type { PaymentMethod } from '../../../types/payment';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const normalizeBuffer = (value: string) => {
  if (!value) return '0';
  if (value === '.') return '0.';
  if (value.startsWith('.')) return `0${value}`;
  if (value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) {
    const trimmed = value.replace(/^0+/, '');
    return trimmed.length > 0 ? trimmed : '0';
  }
  return value;
};

const formatInputValue = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  const rounded = roundCurrency(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
};

const paymentTabs = [
  { id: 'cash' as const, label: 'Cash', icon: Banknote },
  { id: 'card' as const, label: 'Card', icon: CreditCard },
  { id: 'transfer' as const, label: 'Transfer', icon: Repeat },
  { id: 'cheque' as const, label: 'Cheque', icon: FileText },
];

type PaymentControlsProps = {
  total: number;
  remaining: number;
  tenderAmount: string;
  setTenderAmount: Dispatch<SetStateAction<string>>;
  onAddPayment: (method: PaymentMethod) => void;
  onComplete: () => void;
  onHold: () => void;
  onVoid: () => void;
  isSubmitDisabled: boolean;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClearError?: () => void;
};

export function PaymentControls({
  total,
  remaining,
  tenderAmount,
  setTenderAmount,
  onAddPayment,
  onComplete,
  onHold,
  onVoid,
  isSubmitDisabled,
  errorMessage,
  isSubmitting = false,
  onClearError,
}: PaymentControlsProps) {
  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethod>('cash');
  const [isFreshInput, setIsFreshInput] = useState(true);

  const tenderValue = Number.parseFloat(tenderAmount);
  const normalizedTender = Number.isFinite(tenderValue) ? tenderValue : 0;
  const changeReturn = Math.max(
    roundCurrency(normalizedTender - remaining),
    0
  );

  const clearError = () => {
    if (onClearError) {
      onClearError();
    }
  };

  const handleInput = (value: string) => {
    clearError();

    if (value === 'backspace') {
      setTenderAmount((prev) => {
        const next = prev.length <= 1 ? '0' : prev.slice(0, -1);
        return normalizeBuffer(next);
      });
      setIsFreshInput(false);
      return;
    }

    if (value === '.') {
      setTenderAmount((prev) => {
        if (prev.includes('.')) return prev;
        return normalizeBuffer(`${prev}.`);
      });
      setIsFreshInput(false);
      return;
    }

    if (!/^\d$/.test(value)) return;

    setTenderAmount((prev) => {
      const shouldReplace = isFreshInput || prev === '0';
      const nextRaw = shouldReplace ? value : `${prev}${value}`;
      if (nextRaw.includes('.')) {
        const decimals = nextRaw.split('.')[1] ?? '';
        if (decimals.length > 2) {
          return prev;
        }
      }
      return normalizeBuffer(nextRaw);
    });
    setIsFreshInput(false);
  };

  const handleClearInput = () => {
    setTenderAmount('0');
    setIsFreshInput(true);
    clearError();
  };

  const handleQuickAmount = (value: number) => {
    const current = Number.parseFloat(tenderAmount);
    const base = Number.isFinite(current) ? current : 0;
    const nextValue = base + value;
    setTenderAmount(formatInputValue(nextValue));
    setIsFreshInput(true);
    clearError();
  };

  const handleAddPayment = () => {
    onAddPayment(selectedMethod);
    setIsFreshInput(true);
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-2">
        <div className="grid grid-cols-4 gap-2">
          {paymentTabs.map((tab) => {
            const isActive = selectedMethod === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSelectedMethod(tab.id);
                  clearError();
                }}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
                aria-pressed={isActive}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Total Due</span>
          <span className="font-semibold text-slate-900">
            {formatCurrency(total)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
          <span>Remaining</span>
          <span className="font-semibold text-slate-900">
            {formatCurrency(remaining)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Paying Amount
          </label>
          <input
            readOnly
            value={formatCurrency(normalizedTender)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Change Return
          </label>
          <input
            readOnly
            value={formatCurrency(changeReturn)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {[10, 20, 50, 100, 500, 1000, 5000].map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => handleQuickAmount(amount)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            {formatCurrency(amount)}
          </button>
        ))}
      </div>

      <div className="flex-1">
        <StagingNumpad
          value={tenderAmount}
          onInput={handleInput}
          onConfirm={handleAddPayment}
          onCancel={handleClearInput}
          mode="add"
          confirmLabel="Add Payment"
          cancelLabel="Clear"
          inputAriaLabel="Paying amount"
          errorMessage={errorMessage}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={onHold}
          disabled={isSubmitting}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Hold
        </button>
        <button
          type="button"
          onClick={onVoid}
          disabled={isSubmitting}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Void
        </button>
        <button
          type="button"
          onClick={onComplete}
          disabled={isSubmitDisabled || isSubmitting}
          className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
            isSubmitDisabled || isSubmitting
              ? 'cursor-not-allowed bg-slate-200 text-slate-400'
              : 'bg-emerald-500 text-white hover:bg-emerald-400'
          }`}
        >
          {isSubmitting ? 'Processing...' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
