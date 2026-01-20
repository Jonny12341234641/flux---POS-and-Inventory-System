'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';

import type {
  SalePayment,
  SaleWithDetails,
  ShiftSession,
} from '../../../types';
import { ActivityFeed } from '../../../components/pos/register/ActivityFeed';
import { CashTransactionModal } from '../../../components/pos/register/CashTransactionModal';
import { CloseShiftForm } from '../../../components/pos/register/CloseShiftForm';
import { RegisterStats } from '../../../components/pos/register/RegisterStats';

type SaleRecord = SaleWithDetails & {
  sale_payments?: SalePayment[];
};

type CashTransactionType = 'pay_in' | 'pay_out';

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

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

const extractSales = (data: unknown): SaleRecord[] => {
  if (Array.isArray(data)) {
    return data as SaleRecord[];
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const list =
      (Array.isArray(record.data) && record.data) ||
      (Array.isArray(record.sales) && record.sales) ||
      (Array.isArray(record.receipts) && record.receipts);

    if (Array.isArray(list)) {
      return list as SaleRecord[];
    }
  }

  return [];
};

const resolveCashAmount = (sale: SaleRecord) => {
  const payments = Array.isArray(sale.payments)
    ? sale.payments
    : Array.isArray(sale.sale_payments)
      ? sale.sale_payments
      : [];

  if (payments.length > 0) {
    return payments.reduce((total, payment) => {
      if (payment?.method !== 'cash') return total;
      return total + parseNumber(payment.amount, 0);
    }, 0);
  }

  if (sale.payment_method === 'cash') {
    return parseNumber(sale.grand_total, parseNumber(sale.amount_paid, 0));
  }

  return 0;
};

export default function RegisterPage() {
  const [currentShift, setCurrentShift] = useState<ShiftSession | null>(
    null
  );
  const [isShiftLoading, setIsShiftLoading] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [isSalesLoading, setIsSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);

  const [activeTransaction, setActiveTransaction] =
    useState<CashTransactionType | null>(null);

  const [isClosingShift, setIsClosingShift] = useState(false);
  const [closeShiftError, setCloseShiftError] = useState<string | null>(
    null
  );

  const loadCurrentShift = async (signal?: AbortSignal) => {
    setIsShiftLoading(true);
    setShiftError(null);

    try {
      const response = await fetch('/api/shifts', {
        cache: 'no-store',
        signal,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load shift status (status ${response.status}).`
        );
      }

      const data = await response.json();
      if (
        data &&
        typeof data === 'object' &&
        'success' in data &&
        (data as { success?: boolean; error?: string }).success === false
      ) {
        throw new Error(
          (data as { error?: string }).error ?? 'Failed to load shift.'
        );
      }

      if (!signal?.aborted) {
        setCurrentShift((data?.data as ShiftSession | null) ?? null);
      }
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        return;
      }

      if (!signal?.aborted) {
        setCurrentShift(null);
        setShiftError(
          error instanceof Error
            ? error.message
            : 'Failed to load shift status.'
        );
      }
    } finally {
      if (!signal?.aborted) {
        setIsShiftLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadCurrentShift(controller.signal);

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!currentShift) {
      setSales([]);
      setSalesError(null);
      setIsSalesLoading(false);
      setCloseShiftError(null);
      return;
    }

    const controller = new AbortController();

    const loadSales = async () => {
      setIsSalesLoading(true);
      setSalesError(null);

      try {
        const response = await fetch('/api/sales?status=completed', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load sales (status ${response.status}).`
          );
        }

        const data = await response.json();
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          (data as { success?: boolean; error?: string }).success === false
        ) {
          throw new Error(
            (data as { error?: string }).error ??
              'Failed to load sales.'
          );
        }

        if (!controller.signal.aborted) {
          setSales(extractSales(data));
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return;
        }

        if (!controller.signal.aborted) {
          setSales([]);
          setSalesError(
            error instanceof Error
              ? error.message
              : 'Failed to load sales.'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSalesLoading(false);
        }
      }
    };

    loadSales();

    return () => controller.abort();
  }, [currentShift]);

  useEffect(() => {
    if (!currentShift) {
      setActiveTransaction(null);
    }
  }, [currentShift]);

  const shiftStartMs = useMemo(() => {
    if (!currentShift?.start_time) return null;
    const parsed = parseTimestamp(currentShift.start_time);
    return Number.isFinite(parsed) ? parsed : null;
  }, [currentShift?.start_time]);

  const filteredSales = useMemo(() => {
    if (!shiftStartMs) return [];

    return sales.filter((sale) => {
      if (sale.status && sale.status !== 'completed') {
        return false;
      }
      const saleTime = parseTimestamp(sale.created_at);
      if (!Number.isFinite(saleTime)) return false;
      return saleTime >= shiftStartMs;
    });
  }, [sales, shiftStartMs]);

  const cashSalesTotal = useMemo(() => {
    return filteredSales.reduce(
      (total, sale) => total + resolveCashAmount(sale),
      0
    );
  }, [filteredSales]);

  const startCash = parseNumber(currentShift?.starting_cash, 0);
  const dropsTotal = 0;
  const expectedCash = startCash + cashSalesTotal - dropsTotal;

  const activitySales = useMemo(() => {
    const sorted = [...filteredSales].sort((first, second) => {
      const firstTime = parseTimestamp(first.created_at);
      const secondTime = parseTimestamp(second.created_at);
      return (Number.isFinite(secondTime) ? secondTime : 0) -
        (Number.isFinite(firstTime) ? firstTime : 0);
    });

    return sorted.slice(0, 8).map((sale) => ({
      id: sale.id,
      receiptNumber: sale.receipt_number ?? sale.id,
      createdAt: sale.created_at,
      total: parseNumber(sale.grand_total, 0),
    }));
  }, [filteredSales]);

  const handleCloseShift = async (
    finalAmount: number,
    notes: string
  ) => {
    if (!currentShift) {
      setCloseShiftError('No open shift to close.');
      return;
    }

    setIsClosingShift(true);
    setCloseShiftError(null);

    try {
      const response = await fetch(
        `/api/shifts/${currentShift.id}/close`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ending_cash: finalAmount,
            notes,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ??
            `Failed to close shift (status ${response.status}).`
        );
      }

      setCurrentShift(null);
      setSales([]);
      setActiveTransaction(null);
    } catch (error) {
      setCloseShiftError(
        error instanceof Error ? error.message : 'Failed to close shift.'
      );
    } finally {
      setIsClosingShift(false);
    }
  };

  const handleOpenTransaction = (type: CashTransactionType) => {
    if (!currentShift) return;
    setActiveTransaction(type);
  };

  const isRegisterClosed = !isShiftLoading && !currentShift;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Wallet className="h-5 w-5 text-slate-500" />
            Cash Register
          </h1>
          <p className="text-sm text-slate-500">
            Manage the drawer, cash movement, and shift reconciliation.
          </p>
          {currentShift ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                Shift Open
              </span>
              <span>
                Opened {formatDateTime(currentShift.start_time)}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => handleOpenTransaction('pay_in')}
            disabled={!currentShift}
            className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              currentShift
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
            }`}
          >
            <ArrowUpCircle className="h-4 w-4" />
            Pay In
          </button>
          <button
            type="button"
            onClick={() => handleOpenTransaction('pay_out')}
            disabled={!currentShift}
            className={`inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
              currentShift
                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
            }`}
          >
            <ArrowDownCircle className="h-4 w-4" />
            Pay Out
          </button>
        </div>
      </header>

      {shiftError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {shiftError}
        </div>
      ) : null}

      {isShiftLoading ? (
        <p className="text-sm text-slate-500">
          Loading shift status...
        </p>
      ) : null}

      {isRegisterClosed ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
          <Wallet className="mx-auto h-8 w-8 text-slate-300" />
          <div className="mt-3 text-base font-semibold text-slate-700">
            Register Closed
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Open a shift to track cash activity and close the drawer.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 space-y-6 lg:col-span-7">
            <RegisterStats
              startCash={startCash}
              salesTotal={cashSalesTotal}
              dropsTotal={dropsTotal}
            />
            {isSalesLoading ? (
              <p className="text-xs text-slate-500">
                Updating cash totals...
              </p>
            ) : null}
            {salesError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {salesError}
              </div>
            ) : null}
            <CloseShiftForm
              key={currentShift?.id}
              expectedCash={expectedCash}
              onCloseShift={handleCloseShift}
              isSubmitting={isClosingShift}
              errorMessage={closeShiftError}
            />
          </div>
          <div className="col-span-12 lg:col-span-5">
            <ActivityFeed
              sales={activitySales}
              shiftStart={currentShift?.start_time}
              isLoading={isSalesLoading}
              error={salesError}
            />
          </div>
        </div>
      )}

      <CashTransactionModal
        isOpen={activeTransaction !== null}
        type={activeTransaction ?? 'pay_in'}
        onClose={() => setActiveTransaction(null)}
      />
    </div>
  );
}
