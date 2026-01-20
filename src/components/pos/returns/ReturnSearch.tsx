'use client';

import { ScanLine, Search } from 'lucide-react';
import type { FormEvent } from 'react';

import type { ReturnMode } from './ReturnModeToggle';

type ReturnSearchProps = {
  mode: ReturnMode;
  query: string;
  onQueryChange: (value: string) => void;
  onSearchReceipt: (query: string) => void;
  onSearchProduct: (query: string) => void;
  isLoading?: boolean;
};

export function ReturnSearch({
  mode,
  query,
  onQueryChange,
  onSearchReceipt,
  onSearchProduct,
  isLoading = false,
}: ReturnSearchProps) {
  const isReceiptMode = mode === 'receipt';
  const placeholder = isReceiptMode
    ? 'Scan Receipt or type Order ID'
    : 'Search Item Name or SKU';
  const helperText = isReceiptMode
    ? 'Search receipts by order number or customer.'
    : 'Search inventory by name, SKU, or barcode.';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    if (isReceiptMode) {
      onSearchReceipt(trimmed);
    } else {
      onSearchProduct(trimmed);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-900">
          {isReceiptMode ? 'Receipt Lookup' : 'Manual Item Search'}
        </h3>
        <p className="text-xs text-slate-500">{helperText}</p>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
          />
          <div className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 text-xs text-slate-400 sm:flex">
            <ScanLine className="h-3.5 w-3.5" />
            <span>Enter</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || query.trim().length === 0}
          className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>
    </form>
  );
}
