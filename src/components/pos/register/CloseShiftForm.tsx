'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { Wallet } from 'lucide-react';

type CloseShiftFormProps = {
  expectedCash: number;
  onCloseShift: (finalAmount: number, notes: string) => Promise<void> | void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const parseNumber = (value: unknown, fallback = Number.NaN) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

export function CloseShiftForm({
  expectedCash,
  onCloseShift,
  isSubmitting = false,
  errorMessage,
}: CloseShiftFormProps) {
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const safeExpected = Number.isFinite(expectedCash) ? expectedCash : 0;
  const parsedCounted = useMemo(
    () => parseNumber(countedCash, Number.NaN),
    [countedCash]
  );
  const variance = useMemo(() => {
    if (!Number.isFinite(parsedCounted)) return Number.NaN;
    return parsedCounted - safeExpected;
  }, [parsedCounted, safeExpected]);

  const varianceTone = Number.isFinite(variance)
    ? variance < 0
      ? 'text-red-400'
      : variance > 0
        ? 'text-emerald-400'
        : 'text-slate-400'
    : 'text-slate-400';

  const varianceLabel = Number.isFinite(variance)
    ? formatCurrency(variance)
    : '--';

  const varianceHint = Number.isFinite(variance)
    ? variance === 0
      ? 'Balanced'
      : variance > 0
        ? 'Over'
        : 'Short'
    : 'Enter counted cash to see variance';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);

    const parsed = parseNumber(countedCash, Number.NaN);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setLocalError('Counted cash must be a non-negative number.');
      return;
    }

    try {
      await onCloseShift(parsed, notes.trim());
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'Failed to close shift.'
      );
    }
  };

  const resolvedError = localError ?? errorMessage ?? null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-slate-400" />
        <h2 className="text-base font-semibold text-slate-100">
          Close Shift
        </h2>
      </div>
      <p className="mt-2 text-sm text-slate-400">
        Reconcile the drawer to finalize this shift.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Expected Cash
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-100">
              {formatCurrency(safeExpected)}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">
              Counted Cash
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={countedCash}
              onChange={(event) => {
                setCountedCash(event.target.value);
                setLocalError(null);
              }}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-lg font-semibold text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Variance
            </div>
            <div className="text-xs text-slate-400">{varianceHint}</div>
          </div>
          <div className={`text-lg font-semibold ${varianceTone}`}>
            {varianceLabel}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
            rows={3}
            placeholder="Any discrepancies or remarks..."
          />
        </div>

        {resolvedError ? (
          <div className="rounded-lg border border-red-900/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {resolvedError}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Closing...' : 'Close Shift'}
          </button>
        </div>
      </form>
    </div>
  );
}