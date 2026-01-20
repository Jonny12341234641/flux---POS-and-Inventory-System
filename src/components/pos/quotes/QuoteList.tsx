'use client';

import type { KeyboardEvent } from 'react';
import { Clock3, FileText, User } from 'lucide-react';

export type QuoteListItem = {
  id: string;
  createdAt?: string;
  customerName?: string | null;
  total: number;
};

type QuoteListProps = {
  quotes: QuoteListItem[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const formatRelativeTime = (value?: string) => {
  if (!value) return 'Unknown time';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const buildReference = (id: string) => {
  const trimmed = id.trim();
  if (!trimmed) return '#QT-0000';
  const suffix = trimmed.slice(-4).toUpperCase();
  return `#QT-${suffix}`;
};

const isExpiredQuote = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const diffMs = Date.now() - date.getTime();
  const days = diffMs / (1000 * 60 * 60 * 24);
  return days > 30;
};

export function QuoteList({
  quotes,
  selectedId,
  onSelect,
}: QuoteListProps) {
  return (
    <div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
      {quotes.map((quote) => {
        const displayName = quote.customerName?.trim()
          ? quote.customerName
          : 'Guest';
        const resolvedTotal = Number.isFinite(quote.total) ? quote.total : 0;
        const isSelected = selectedId === quote.id;
        const expired = isExpiredQuote(quote.createdAt);
        const statusLabel = expired ? 'Expired' : 'Active';
        const statusClasses = expired
          ? 'bg-slate-100 text-slate-500'
          : 'bg-emerald-50 text-emerald-700';

        const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect?.(quote.id);
          }
        };

        return (
          <div
            key={quote.id}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            onClick={() => onSelect?.(quote.id)}
            onKeyDown={handleKeyDown}
            className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
              isSelected
                ? 'border-emerald-300 ring-1 ring-emerald-200'
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                <span className="font-mono text-xs text-slate-600">
                  {buildReference(quote.id)}
                </span>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClasses}`}
              >
                {statusLabel}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <User className="h-4 w-4 text-slate-400" />
              <span className="truncate">{displayName}</span>
            </div>

            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              <span>{formatRelativeTime(quote.createdAt)}</span>
            </div>

            <div className="mt-4">
              <div className="text-xs text-slate-500">Total</div>
              <div className="text-lg font-semibold text-slate-900">
                {formatCurrency(resolvedTotal)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
