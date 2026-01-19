'use client';

import type { KeyboardEvent, MouseEvent } from 'react';
import { Clock3, Play, Trash2, User } from 'lucide-react';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const formatRelativeTime = (value: string) => {
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

type OrderCardProps = {
  id: string;
  createdAt: string;
  customerName?: string | null;
  itemCount?: number;
  total: number;
  isSelected?: boolean;
  onSelect?: () => void;
};

export function OrderCard({
  id,
  createdAt,
  customerName,
  itemCount = 0,
  total,
  isSelected = false,
  onSelect,
}: OrderCardProps) {
  const resolvedTotal = Number.isFinite(total) ? total : 0;
  const resolvedCount = Number.isFinite(itemCount) ? itemCount : 0;
  const countLabel = resolvedCount === 1 ? 'Item' : 'Items';
  const displayName = customerName?.trim() ? customerName : 'Walk-in';

  const handleResume = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    console.log('Resume order', id);
  };

  const handleDiscard = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const confirmed = window.confirm('Discard this held order?');
    if (confirmed) {
      console.log('Discard order', id);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      aria-pressed={isSelected}
      className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
        isSelected
          ? 'border-emerald-300 ring-1 ring-emerald-200'
          : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Clock3 className="h-3.5 w-3.5" />
          <span>{formatRelativeTime(createdAt)}</span>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Draft
        </span>
      </div>

      <div className="mt-3 space-y-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <User className="h-4 w-4 text-slate-400" />
          <span className="truncate">{displayName}</span>
        </div>
        <div className="text-xs text-slate-500">
          {resolvedCount} {countLabel}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs text-slate-500">Total</div>
        <div className="text-xl font-semibold text-slate-900">
          {formatCurrency(resolvedTotal)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleResume}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
        >
          <Play className="h-3.5 w-3.5" />
          Resume
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:border-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Discard
        </button>
      </div>
    </div>
  );
}
