'use client';

import { useMemo } from 'react';
import { History } from 'lucide-react';

type ActivitySale = {
  id: string;
  receiptNumber?: string | null;
  createdAt?: string | null;
  total: number;
};

type ActivityFeedProps = {
  sales: ActivitySale[];
  shiftStart?: string | null;
  isLoading?: boolean;
  error?: string | null;
};

type ActivityEvent = {
  id: string;
  label: string;
  timestamp: number;
  timeLabel: string;
  tone: 'sale' | 'shift';
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const formatDateTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const parseTimestamp = (value?: string | null) => {
  if (!value) return Number.NaN;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export function ActivityFeed({
  sales,
  shiftStart,
  isLoading = false,
  error,
}: ActivityFeedProps) {
  const events = useMemo(() => {
    const saleEvents: ActivityEvent[] = sales.map((sale) => {
      const receiptLabel =
        sale.receiptNumber?.trim() || sale.id || 'Sale';
      const timestamp = parseTimestamp(sale.createdAt);
      const timeLabel = formatDateTime(sale.createdAt);

      return {
        id: sale.id,
        label: `Sale ${receiptLabel} - ${formatCurrency(sale.total)}`,
        timestamp: Number.isFinite(timestamp) ? timestamp : 0,
        timeLabel,
        tone: 'sale',
      };
    });

    saleEvents.sort((a, b) => b.timestamp - a.timestamp);

    if (shiftStart) {
      const shiftTimestamp = parseTimestamp(shiftStart);
      saleEvents.push({
        id: 'shift-opened',
        label: 'Shift Opened',
        timestamp: Number.isFinite(shiftTimestamp) ? shiftTimestamp : 0,
        timeLabel: formatDateTime(shiftStart),
        tone: 'shift',
      });
    }

    return saleEvents;
  }, [sales, shiftStart]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-slate-500" />
        <h2 className="text-base font-semibold text-slate-900">
          Activity Feed
        </h2>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Loading activity...
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {error}
          </div>
        ) : null}

        {!isLoading && !error && events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            No activity yet.
          </div>
        ) : null}

        {!isLoading && !error && events.length > 0 ? (
          <ul className="relative space-y-5 border-l border-slate-200 pl-5">
            {events.map((event) => (
              <li key={event.id} className="relative">
                <span
                  className={`absolute -left-[9px] top-1.5 h-2.5 w-2.5 rounded-full ${
                    event.tone === 'sale'
                      ? 'bg-emerald-400'
                      : 'bg-slate-300'
                  }`}
                />
                <div className="text-sm font-medium text-slate-700">
                  {event.label}
                </div>
                <div className="text-xs text-slate-400">
                  {event.timeLabel || 'Time unavailable'}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
