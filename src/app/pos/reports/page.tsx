'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';

import type { SaleWithDetails, ShiftSession } from '../../../types';
import {
  ReportsSidebar,
  type ReportsTab,
} from '../../../components/pos/reports/ReportsSidebar';
import { XReportPreview } from '../../../components/pos/reports/XReportPreview';
import { ZReportList } from '../../../components/pos/reports/ZReportList';
import { ActivityLog } from '../../../components/pos/reports/ActivityLog';

type ShiftWithCashier = ShiftSession & {
  cashier?: { name?: string | null } | null;
};

const MAX_SALES_PAGES = 20;

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toCurrencyString = (value: unknown) =>
  (Math.round(parseNumber(value, 0) * 100) / 100).toFixed(2);

const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

const getErrorMessage = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === 'object') {
    const record = payload as { error?: unknown; message?: unknown };
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error;
    }
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
  }
  return fallback;
};

const assertSuccess = (payload: unknown, fallback: string) => {
  if (payload && typeof payload === 'object' && 'success' in payload) {
    const record = payload as { success?: boolean };
    if (record.success === false) {
      throw new Error(getErrorMessage(payload, fallback));
    }
  }
};

const extractSales = (data: unknown): SaleWithDetails[] => {
  if (Array.isArray(data)) {
    return data as SaleWithDetails[];
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const list =
      (Array.isArray(record.data) && record.data) ||
      (Array.isArray(record.sales) && record.sales) ||
      (Array.isArray(record.receipts) && record.receipts);

    if (Array.isArray(list)) {
      return list as SaleWithDetails[];
    }
  }

  return [];
};

const extractSale = (data: unknown): SaleWithDetails | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;
  if (record.data && typeof record.data === 'object') {
    return record.data as SaleWithDetails;
  }

  return record as SaleWithDetails;
};

const extractShift = (data: unknown): ShiftWithCashier | null => {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const record = data as Record<string, unknown>;
  if (record.data === null) {
    return null;
  }

  if (record.data && typeof record.data === 'object') {
    return record.data as ShiftWithCashier;
  }

  return record as ShiftWithCashier;
};

const extractShifts = (data: unknown): ShiftWithCashier[] => {
  if (Array.isArray(data)) {
    return data as ShiftWithCashier[];
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return record.data as ShiftWithCashier[];
    }
  }

  return [];
};

const isWithinShift = (sale: SaleWithDetails, shift: ShiftSession) => {
  if (!shift.start_time || !sale.created_at) {
    return true;
  }

  const createdAt = new Date(sale.created_at).getTime();
  const startTime = new Date(shift.start_time).getTime();
  if (!Number.isFinite(createdAt) || !Number.isFinite(startTime)) {
    return true;
  }

  if (createdAt < startTime) {
    return false;
  }

  if (shift.end_time) {
    const endTime = new Date(shift.end_time).getTime();
    if (Number.isFinite(endTime) && createdAt > endTime) {
      return false;
    }
  }

  return true;
};

const fetchSaleDetails = async (
  sales: SaleWithDetails[],
  signal: AbortSignal
) => {
  const needsDetails = sales.some((sale) => {
    const hasItems =
      Array.isArray((sale as { sale_items?: unknown }).sale_items) ||
      Array.isArray((sale as { items?: unknown }).items);
    const hasPayments = Array.isArray(
      (sale as { payments?: unknown }).payments
    );
    return !hasItems || !hasPayments;
  });

  if (!needsDetails) {
    return sales;
  }

  return Promise.all(
    sales.map(async (sale) => {
      if (signal.aborted) {
        throw new DOMException('AbortError', 'AbortError');
      }

      try {
        if (!sale.id) {
          return sale;
        }

        const response = await fetch(`/api/sales/${sale.id}`, {
          cache: 'no-store',
          signal,
        });

        if (!response.ok) {
          return sale;
        }

        const payload = await response.json();
        assertSuccess(payload, 'Failed to load sale details.');
        const detail = extractSale(payload);
        return detail ?? sale;
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          throw error;
        }
        return sale;
      }
    })
  );
};

const loadShiftSales = async (
  shift: ShiftSession,
  signal: AbortSignal
) => {
  const allSales: SaleWithDetails[] = [];
  let page = 1;

  while (page <= MAX_SALES_PAGES) {
    if (signal.aborted) {
      throw new DOMException('AbortError', 'AbortError');
    }

    const params = new URLSearchParams();
    params.set('page', String(page));
    if (shift.start_time) {
      params.set('from', shift.start_time);
    }
    if (shift.end_time) {
      params.set('to', shift.end_time);
    }

    const response = await fetch(`/api/sales?${params.toString()}`, {
      cache: 'no-store',
      signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to load sales (status ${response.status}).`);
    }

    const payload = await response.json();
    assertSuccess(payload, 'Failed to load sales.');

    const pageSales = extractSales(payload);
    if (pageSales.length === 0) {
      break;
    }

    allSales.push(...pageSales);
    page += 1;
  }

  const filteredSales = allSales.filter((sale) =>
    isWithinShift(sale, shift)
  );

  return fetchSaleDetails(filteredSales, signal);
};

const buildSalesCsv = (sales: SaleWithDetails[]) => {
  const rows = [
    ['Receipt', 'Date', 'Status', 'Payment Method', 'Tax', 'Total'],
    ...sales.map((sale) => [
      sale.receipt_number ?? sale.id,
      sale.created_at ?? '',
      sale.status ?? '',
      sale.payment_method ?? '',
      toCurrencyString(sale.tax_total),
      toCurrencyString(sale.grand_total),
    ]),
  ];

  return rows
    .map((row) => row.map((value) => escapeCsv(String(value))).join(','))
    .join('\n');
};

const downloadCsv = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportsTab>('x-report');
  const [currentShift, setCurrentShift] = useState<ShiftSession | null>(
    null
  );
  const [currentSales, setCurrentSales] = useState<SaleWithDetails[]>(
    []
  );
  const [currentShiftLoading, setCurrentShiftLoading] = useState(false);
  const [currentSalesLoading, setCurrentSalesLoading] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);

  const [shiftHistory, setShiftHistory] = useState<ShiftWithCashier[]>(
    []
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<ShiftWithCashier | null>(
    null
  );
  const [selectedSales, setSelectedSales] = useState<SaleWithDetails[]>(
    []
  );
  const [selectedSalesLoading, setSelectedSalesLoading] = useState(false);
  const [selectedSalesError, setSelectedSalesError] = useState<
    string | null
  >(null);

  useEffect(() => {
    document.body.classList.add('print-root');
    return () => {
      document.body.classList.remove('print-root');
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadCurrentShift = async () => {
      setCurrentShiftLoading(true);
      setCurrentError(null);

      try {
        const response = await fetch('/api/shifts', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load current shift (status ${response.status}).`
          );
        }

        const payload = await response.json();
        assertSuccess(payload, 'Failed to load current shift.');
        setCurrentShift(extractShift(payload));
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return;
        }
        setCurrentShift(null);
        setCurrentError(
          error instanceof Error
            ? error.message
            : 'Failed to load current shift.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setCurrentShiftLoading(false);
        }
      }
    };

    loadCurrentShift();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    if (!currentShift) {
      setCurrentSales([]);
      setCurrentSalesLoading(false);
      return () => controller.abort();
    }

    const loadSales = async () => {
      setCurrentSalesLoading(true);
      setCurrentError(null);

      try {
        const sales = await loadShiftSales(
          currentShift,
          controller.signal
        );
        if (!controller.signal.aborted) {
          setCurrentSales(sales);
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return;
        }
        if (!controller.signal.aborted) {
          setCurrentSales([]);
          setCurrentError(
            error instanceof Error ? error.message : 'Failed to load sales.'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setCurrentSalesLoading(false);
        }
      }
    };

    loadSales();

    return () => controller.abort();
  }, [currentShift]);

  useEffect(() => {
    const controller = new AbortController();

    const loadShiftHistory = async () => {
      setHistoryLoading(true);
      setHistoryError(null);

      try {
        const response = await fetch('/api/shifts?all=true', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load shift history (status ${response.status}).`
          );
        }

        const payload = await response.json();
        assertSuccess(payload, 'Failed to load shift history.');
        setShiftHistory(extractShifts(payload));
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return;
        }
        setShiftHistory([]);
        setHistoryError(
          error instanceof Error
            ? error.message
            : 'Failed to load shift history.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setHistoryLoading(false);
        }
      }
    };

    loadShiftHistory();

    return () => controller.abort();
  }, []);

  const closedShifts = useMemo(
    () => shiftHistory.filter((shift) => shift.status === 'closed'),
    [shiftHistory]
  );

  useEffect(() => {
    if (selectedShift || closedShifts.length === 0) {
      return;
    }

    setSelectedShift(closedShifts[0]);
  }, [closedShifts, selectedShift]);

  useEffect(() => {
    const controller = new AbortController();

    if (!selectedShift) {
      setSelectedSales([]);
      setSelectedSalesLoading(false);
      setSelectedSalesError(null);
      return () => controller.abort();
    }

    const loadSales = async () => {
      setSelectedSalesLoading(true);
      setSelectedSalesError(null);

      try {
        const sales = await loadShiftSales(
          selectedShift,
          controller.signal
        );
        if (!controller.signal.aborted) {
          setSelectedSales(sales);
        }
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return;
        }
        if (!controller.signal.aborted) {
          setSelectedSales([]);
          setSelectedSalesError(
            error instanceof Error
              ? error.message
              : 'Failed to load shift sales.'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setSelectedSalesLoading(false);
        }
      }
    };

    loadSales();

    return () => controller.abort();
  }, [selectedShift]);

  const previewShift =
    activeTab === 'z-report' ? selectedShift : currentShift;
  const previewSales =
    activeTab === 'z-report' ? selectedSales : currentSales;
  const previewLoading =
    activeTab === 'z-report'
      ? selectedSalesLoading
      : currentShiftLoading || currentSalesLoading;
  const previewError =
    activeTab === 'z-report' ? selectedSalesError : currentError;

  const canPrint = activeTab !== 'activity' && Boolean(previewShift);
  const canExport =
    activeTab !== 'activity' && previewSales.length > 0;

  const handlePrint = () => {
    if (!canPrint) return;
    window.print();
  };

  const handleExport = () => {
    if (!canExport) return;
    const csv = buildSalesCsv(previewSales);
    downloadCsv(csv, 'shift-report.csv');
  };

  return (
    <div className="relative flex flex-col gap-6 lg:flex-row">
      <style>{`
        @media print {
          body.print-root * {
            visibility: hidden;
          }
          body.print-root .print-area,
          body.print-root .print-area * {
            visibility: visible;
          }
          body.print-root .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: none !important;
            border: none !important;
            box-shadow: none !important;
          }
          header,
          aside,
          .reports-sidebar,
          .reports-actions,
          .reports-list {
            display: none !important;
          }
          .reports-stage {
            background: transparent !important;
            padding: 0 !important;
          }
        }
      `}</style>
      <div className="w-full lg:w-64">
        <ReportsSidebar activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="relative flex-1">
        <div className="reports-actions absolute right-6 top-6 z-10 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={!canPrint}
            className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 ${
              !canPrint ? 'cursor-not-allowed opacity-60' : ''
            }`}
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport}
            className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 ${
              !canExport ? 'cursor-not-allowed opacity-60' : ''
            }`}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        <div
          className={`reports-stage flex min-h-[560px] w-full rounded-3xl bg-slate-100 p-6 ${
            activeTab === 'z-report'
              ? 'items-start'
              : 'items-center justify-center'
          }`}
        >
          {activeTab === 'activity' ? (
            <ActivityLog />
          ) : activeTab === 'z-report' ? (
            <div className="flex w-full flex-col gap-6 xl:flex-row">
              <div className="w-full xl:w-[420px]">
                <ZReportList
                  shifts={closedShifts}
                  selectedShiftId={selectedShift?.id ?? null}
                  onSelect={setSelectedShift}
                  isLoading={historyLoading}
                  error={historyError}
                />
              </div>
              <div className="flex flex-1 flex-col items-center justify-center gap-4">
                {previewLoading ? (
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
                    Loading shift report...
                  </div>
                ) : null}
                {previewError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                    {previewError}
                  </div>
                ) : null}
                <XReportPreview
                  sales={selectedSales}
                  shift={selectedShift}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {previewLoading ? (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500">
                  Loading current shift report...
                </div>
              ) : null}
              {previewError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {previewError}
                </div>
              ) : null}
              <XReportPreview sales={currentSales} shift={currentShift} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
