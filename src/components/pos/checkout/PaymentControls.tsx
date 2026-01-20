'use client';

import { Banknote, CreditCard, Split } from 'lucide-react';

import { StagingNumpad } from '../staging/StagingNumpad';
import type { PaymentMethod, PaymentRecord } from '../../../types/payment';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const methodLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  split: 'Split',
  other: 'Other',
};

const paymentTabs = [
  { id: 'cash' as const, label: 'Cash', icon: Banknote },
  { id: 'card' as const, label: 'Card', icon: CreditCard },
  { id: 'other' as const, label: 'Other', icon: Split },
];

type PaymentControlsProps = {
  selectedMethod: PaymentMethod;
  tenderInput: string;
  payments: PaymentRecord[];
  totalPaid: number;
  remainingDue: number;
  changeDue: number;
  onSelectMethod: (method: PaymentMethod) => void;
  onInput: (value: string) => void;
  onConfirmPayment: () => void;
  onClearInput: () => void;
  onQuickTender: (value: number | 'exact') => void;
  errorMessage?: string | null;
};

export function PaymentControls({
  selectedMethod,
  tenderInput,
  payments,
  totalPaid,
  remainingDue,
  changeDue,
  onSelectMethod,
  onInput,
  onConfirmPayment,
  onClearInput,
  onQuickTender,
  errorMessage,
}: PaymentControlsProps) {
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-2">
        <div className="grid grid-cols-3 gap-2">
          {paymentTabs.map((tab) => {
            const isActive = selectedMethod === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectMethod(tab.id)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                    : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200'
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

      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Remaining Due
          </span>
          <span className="text-2xl font-semibold text-white">
            {formatCurrency(remainingDue)}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
          <span>Paid so far</span>
          <span className="font-semibold text-slate-200">
            {formatCurrency(totalPaid)}
          </span>
        </div>
        {changeDue > 0 ? (
          <div className="mt-3 flex items-center justify-between text-sm text-emerald-300">
            <span>Change Due</span>
            <span className="font-semibold text-emerald-200">
              {formatCurrency(changeDue)}
            </span>
          </div>
        ) : null}
      </div>

      {payments.length > 1 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Split Payments
          </p>
          <div className="mt-3 space-y-2">
            {payments.map((payment, index) => (
              <div
                key={`${payment.method}-${index}`}
                className="flex items-center justify-between text-sm text-slate-200"
              >
                <span>
                  Paid: {formatCurrency(payment.amount)} (
                  {methodLabels[payment.method]})
                </span>
                <span className="text-xs text-slate-500">#{index + 1}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Tendered Amount
            </p>
            <p className="text-xs text-slate-500">
              Enter amount for {methodLabels[selectedMethod]}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[10, 20, 50].map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => onQuickTender(amount)}
              className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-emerald-400 hover:text-emerald-200"
            >
              {formatCurrency(amount)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onQuickTender('exact')}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400 hover:text-emerald-200"
          >
            Exact
          </button>
        </div>
        <StagingNumpad
          value={tenderInput}
          onInput={onInput}
          onConfirm={onConfirmPayment}
          onCancel={onClearInput}
          mode="add"
          confirmLabel="Add Payment"
          cancelLabel="Clear"
          inputAriaLabel="Tendered amount"
          errorMessage={errorMessage}
        />
      </div>
    </div>
  );
}
