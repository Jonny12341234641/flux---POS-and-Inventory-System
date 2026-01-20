'use client';

import { useMemo, useState } from 'react';
import { Check, Hand, Trash2 } from 'lucide-react';

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

const sanitizeInput = (value: string) => {
  const cleaned = value.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) {
    return normalizeBuffer(cleaned);
  }
  const withoutExtraDots =
    cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  const [whole, decimals = ''] = withoutExtraDots.split('.');
  return normalizeBuffer(`${whole}.${decimals.slice(0, 2)}`);
};

const paymentTabs = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'cheque', label: 'Cheque' },
  { id: 'other', label: 'Other' },
] as const;

const quickAmounts = [10, 20, 50, 100, 500, 1000, 5000];

const numpadKeys = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '.',
  '0',
  'backspace',
] as const;

export type CheckoutPaymentMethod = (typeof paymentTabs)[number]['id'];

type PaymentRightPanelProps = {
  total: number;
  onPaymentSubmit: (method: CheckoutPaymentMethod, tenderAmount: string) => void;
  onHold: () => void | Promise<void>;
  onVoid: () => void;
  isSubmitting?: boolean;
};

export function PaymentRightPanel({
  total,
  onPaymentSubmit,
  onHold,
  onVoid,
  isSubmitting = false,
}: PaymentRightPanelProps) {
  const [activeTab, setActiveTab] = useState<CheckoutPaymentMethod>('cash');
  const [tenderAmount, setTenderAmount] = useState('0');

  const totalDue = roundCurrency(total);
  const tenderValue = useMemo(() => {
    const parsed = Number.parseFloat(tenderAmount);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [tenderAmount]);
  const changeDue = Math.max(roundCurrency(tenderValue - totalDue), 0);
  const isSubmitDisabled = tenderValue < totalDue;

  const handleNumpadInput = (value: string) => {
    if (value === 'backspace') {
      setTenderAmount((prev) => {
        const next = prev.length <= 1 ? '0' : prev.slice(0, -1);
        return normalizeBuffer(next);
      });
      return;
    }

    if (value === '.') {
      setTenderAmount((prev) => {
        if (prev.includes('.')) return prev;
        return normalizeBuffer(`${prev}.`);
      });
      return;
    }

    if (!/^\d$/.test(value)) return;

    setTenderAmount((prev) => {
      const nextRaw = prev === '0' ? value : `${prev}${value}`;
      if (nextRaw.includes('.')) {
        const decimals = nextRaw.split('.')[1] ?? '';
        if (decimals.length > 2) {
          return prev;
        }
      }
      return normalizeBuffer(nextRaw);
    });
  };

  const handleQuickAmount = (amount: number) => {
    const base = Number.parseFloat(tenderAmount);
    const current = Number.isFinite(base) ? base : 0;
    const nextValue = current + amount;
    setTenderAmount(formatInputValue(nextValue));
  };

  const handleSubmit = () => {
    if (isSubmitDisabled || isSubmitting) return;
    onPaymentSubmit(activeTab, tenderAmount);
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h3 className="text-xl font-semibold text-slate-900">
          Payment Terminal
        </h3>
        <p className="text-sm text-slate-500">
          Select a method and enter the paying amount.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {paymentTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100'
                }`}
                aria-pressed={isActive}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Total Payable
          </label>
          <input
            readOnly
            value={formatCurrency(totalDue)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Paying Amount
          </label>
          <input
            value={tenderAmount}
            onChange={(event) => setTenderAmount(sanitizeInput(event.target.value))}
            inputMode="decimal"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            aria-label="Paying amount"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Change Return
          </label>
          <input
            readOnly
            value={formatCurrency(changeDue)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Quick Cash
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {quickAmounts.map((amount) => (
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
      </div>

      <div className="flex-1">
        <div className="grid grid-cols-3 gap-3">
          {numpadKeys.map((key) => {
            const label = key === 'backspace' ? 'Del' : key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleNumpadInput(key)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-lg font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                aria-label={key === 'backspace' ? 'Backspace' : `Key ${label}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-auto">
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onHold}
            disabled={isSubmitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-amber-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Hand className="h-4 w-4" />
            Hold
          </button>
          <button
            type="button"
            onClick={onVoid}
            disabled={isSubmitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Void
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitDisabled || isSubmitting}
            className={`flex flex-[2] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
              isSubmitDisabled || isSubmitting
                ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                : 'bg-emerald-500 hover:bg-emerald-400'
            }`}
          >
            <Check className="h-4 w-4" />
            {isSubmitting ? 'Processing...' : 'Pay'}
          </button>
        </div>
        {isSubmitDisabled ? (
          <p className="mt-2 text-xs text-slate-400">
            Paying amount must cover the total payable.
          </p>
        ) : null}
      </div>
    </div>
  );
}
