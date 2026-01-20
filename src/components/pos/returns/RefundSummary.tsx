'use client';

import { Banknote, Wallet } from 'lucide-react';
import { useMemo } from 'react';

export type RefundSummaryItem = {
  returnQty: number;
  refundPrice: number;
};

type RefundSummaryProps = {
  items: RefundSummaryItem[];
  onRefund: (method: 'cash' | 'store_credit') => void;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

export function RefundSummary({ items, onRefund }: RefundSummaryProps) {
  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const qty = Number.isFinite(item.returnQty) ? item.returnQty : 0;
        const price = Number.isFinite(item.refundPrice)
          ? item.refundPrice
          : 0;
        acc.total += qty * price;
        acc.unitCount += qty;
        return acc;
      },
      { total: 0, unitCount: 0 }
    );
  }, [items]);

  const isDisabled = summary.total <= 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Refund Summary
          </h3>
          <p className="text-xs text-slate-500">
            {summary.unitCount} item{summary.unitCount === 1 ? '' : 's'} selected
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Total Refund</p>
          <p className="text-2xl font-semibold text-slate-900">
            {formatCurrency(summary.total)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onRefund('cash')}
          disabled={isDisabled}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Banknote className="h-4 w-4" />
          Cash Refund
        </button>
        <button
          type="button"
          onClick={() => onRefund('store_credit')}
          disabled={isDisabled}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Wallet className="h-4 w-4" />
          Store Credit
        </button>
      </div>
    </section>
  );
}
