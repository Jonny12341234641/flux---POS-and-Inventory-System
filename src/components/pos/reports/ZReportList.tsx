'use client';

import type { ShiftSession } from '../../../types';

type ShiftRecord = ShiftSession & {
  cashier?: { name?: string | null } | null;
};

type ZReportListProps = {
  shifts: ShiftRecord[];
  selectedShiftId?: string | null;
  onSelect?: (shift: ShiftRecord) => void;
  isLoading?: boolean;
  error?: string | null;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const formatDate = (value?: string) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatAmount = (value: unknown) =>
  formatCurrency(Math.round(parseNumber(value, 0) * 100) / 100);

const resolveVariance = (shift: ShiftRecord) => {
  if (typeof shift.difference === 'number') {
    return shift.difference;
  }

  const ending = parseNumber(shift.ending_cash, 0);
  const expected = parseNumber(shift.expected_cash, 0);
  return ending - expected;
};

export function ZReportList({
  shifts,
  selectedShiftId,
  onSelect,
  isLoading = false,
  error,
}: ZReportListProps) {
  return (
    <div className="reports-list rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Shift History
          </p>
          <h3 className="mt-2 text-sm font-semibold text-slate-900">
            Closed Z-Reports
          </h3>
        </div>
        <span className="text-xs text-slate-400">
          {shifts.length} total
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading shift history...</p>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Opened By</th>
                <th className="px-4 py-3 text-right">Closing Cash</th>
                <th className="px-4 py-3 text-right">Variance</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!isLoading && !error && shifts.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    No closed shifts yet.
                  </td>
                </tr>
              ) : null}
              {shifts.map((shift) => {
                const variance = resolveVariance(shift);
                const varianceClass =
                  variance < 0
                    ? 'text-red-600'
                    : variance > 0
                      ? 'text-emerald-600'
                      : 'text-slate-600';
                const isSelected = selectedShiftId === shift.id;

                return (
                  <tr
                    key={shift.id}
                    className={
                      isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'
                    }
                  >
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(shift.end_time ?? shift.start_time)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {shift.cashier?.name ?? shift.user_id ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatAmount(shift.ending_cash ?? 0)}
                    </td>
                    <td className={`px-4 py-3 text-right ${varianceClass}`}>
                      {formatAmount(variance)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelect?.(shift)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          isSelected
                            ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        View/Reprint
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
