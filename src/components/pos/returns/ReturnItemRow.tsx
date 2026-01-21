'use client';

import { Check, Lock, Minus, Plus, X } from 'lucide-react';

export type ReturnCondition = 'restock' | 'damaged';

export type ReturnItemRowItem = {
  id: string;
  name: string;
  sku?: string | null;
  unitPrice: number;
  unit?: string | null;
  maxQty?: number | null;
};

export type ReturnItemUpdate = {
  returnQty?: number;
  refundPrice?: number;
  condition?: ReturnCondition;
};

type ReturnItemRowProps = {
  item: ReturnItemRowItem;
  isManualMode: boolean;
  returnQty: number;
  refundPrice: number;
  condition: ReturnCondition;
  onChange: (update: ReturnItemUpdate) => void;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function ReturnItemRow({
  item,
  isManualMode,
  returnQty,
  refundPrice,
  condition,
  onChange,
}: ReturnItemRowProps) {
  const maxQty =
    typeof item.maxQty === 'number' && Number.isFinite(item.maxQty)
      ? item.maxQty
      : null;
  const canIncrease = maxQty === null || returnQty < maxQty;
  const lineTotal = returnQty * refundPrice;

  const handleQtyChange = (nextQty: number) => {
    const resolvedQty =
      maxQty === null ? Math.max(nextQty, 0) : clampNumber(nextQty, 0, maxQty);
    onChange({ returnQty: resolvedQty });
  };

  const handlePriceChange = (value: string) => {
    const parsed = Number(value);
    const resolved = Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
    onChange({ refundPrice: resolved });
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-100">{item.name}</p>
          {item.sku ? (
            <p className="text-xs text-slate-400">SKU: {item.sku}</p>
          ) : null}
          {maxQty !== null ? (
            <p className="text-[11px] text-slate-500">
              Purchased: {maxQty} {item.unit ?? 'qty'}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ condition: 'restock' })}
            aria-pressed={condition === 'restock'}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition ${
              condition === 'restock'
                ? 'border-emerald-900/50 bg-emerald-900/30 text-emerald-400'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            Restock
          </button>
          <button
            type="button"
            onClick={() => onChange({ condition: 'damaged' })}
            aria-pressed={condition === 'damaged'}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition ${
              condition === 'damaged'
                ? 'border-red-900/50 bg-red-900/30 text-red-400'
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
            }`}
          >
            <X className="h-3.5 w-3.5" />
            Damaged
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleQtyChange(returnQty - 1)}
            disabled={returnQty <= 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition hover:border-slate-700 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Decrease ${item.name}`}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[32px] text-center text-sm font-semibold text-slate-100">
            {returnQty}
          </span>
          <button
            type="button"
            onClick={() => handleQtyChange(returnQty + 1)}
            disabled={!canIncrease}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition hover:border-slate-700 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Increase ${item.name}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Refund Price
          </p>
          {isManualMode ? (
            <input
              type="number"
              min={0}
              step="0.01"
              value={Number.isFinite(refundPrice) ? refundPrice : 0}
              onChange={(event) => handlePriceChange(event.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
            />
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Lock className="h-4 w-4 text-slate-500" />
              <span>{formatCurrency(refundPrice)}</span>
            </div>
          )}
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Line Total
          </p>
          <p className="text-sm font-semibold text-slate-100">
            {formatCurrency(lineTotal)}
          </p>
        </div>
      </div>
    </div>
  );
}
