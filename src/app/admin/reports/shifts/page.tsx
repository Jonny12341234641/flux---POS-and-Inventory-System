"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  User,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Shift {
  id: string;
  user_id: string;
  cashier: { name: string };
  start_time: string;
  end_time?: string;
  starting_cash: number;
  ending_cash?: number;
  expected_cash?: number;
  discrepancy?: number;
  status: "open" | "closed";
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

const formatSignedCurrency = (amount: number) => {
  const absolute = Math.abs(amount);
  const formatted = formatCurrency(absolute);

  if (amount > 0) {
    return `+${formatted}`;
  }

  if (amount < 0) {
    return `-${formatted}`;
  }

  return formatted;
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
};

const extractShifts = (data: unknown): Shift[] => {
  if (Array.isArray(data)) {
    return data as Shift[];
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const list =
      (Array.isArray(record.data) && record.data) ||
      (Array.isArray(record.shifts) && record.shifts) ||
      (Array.isArray(record.history) && record.history);

    if (Array.isArray(list)) {
      return list as Shift[];
    }
  }

  return [];
};

const resolveDiscrepancy = (shift: Shift): number | null => {
  if (shift.status !== "closed") {
    return null;
  }

  if (Number.isFinite(shift.discrepancy)) {
    return shift.discrepancy as number;
  }

  if (
    Number.isFinite(shift.ending_cash) &&
    Number.isFinite(shift.expected_cash)
  ) {
    return (shift.ending_cash as number) - (shift.expected_cash as number);
  }

  return null;
};

const getStatusStyles = (status: Shift["status"]) =>
  status === "open"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-slate-100 text-slate-600";

export default function ShiftReportsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadShifts = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/shifts?all=true", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load shifts history (status ${response.status}).`
          );
        }

        const data = await response.json();
        setShifts(extractShifts(data));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Failed to load shifts history."
        );
        setShifts([]);
      } finally {
        setLoading(false);
      }
    };

    loadShifts();

    return () => controller.abort();
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Shift Reports
          </h1>
          <p className="text-sm text-slate-500">
            Audit cashier sessions to spot shortages or overages fast.
          </p>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">Loading shift history...</p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <Clock className="h-5 w-5 text-slate-400" />
            Shifts History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Cashier</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Cash Flow</th>
                  <th className="px-4 py-3">Discrepancy</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      Loading shift history...
                    </td>
                  </tr>
                ) : shifts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      No shift history found.
                    </td>
                  </tr>
                ) : (
                  shifts.map((shift) => {
                    const cashierName = shift.cashier?.name ?? "Unknown";
                    const startingCash = Number.isFinite(shift.starting_cash)
                      ? shift.starting_cash
                      : 0;
                    const endingCash =
                      shift.status === "closed" &&
                      Number.isFinite(shift.ending_cash)
                        ? (shift.ending_cash as number)
                        : null;
                    const discrepancy = resolveDiscrepancy(shift);

                    return (
                      <tr key={shift.id}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            <span className="font-semibold text-slate-900">
                              {cashierName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-slate-600">
                              <Clock className="h-4 w-4 text-slate-400" />
                              <span>
                                Started: {formatDateTime(shift.start_time)}
                              </span>
                            </div>
                            {shift.status === "closed" ? (
                              <div className="text-slate-500">
                                Ended: {formatDateTime(shift.end_time)}
                              </div>
                            ) : (
                              <div className="text-emerald-600 font-medium">
                                Active Now
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <div className="text-slate-700">
                              Starting: {formatCurrency(startingCash)}
                            </div>
                            <div className="text-slate-500">
                              Ending:{" "}
                              {endingCash === null
                                ? "-"
                                : formatCurrency(endingCash)}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {shift.status !== "closed" || discrepancy === null ? (
                            <span className="text-slate-400">-</span>
                          ) : discrepancy === 0 ? (
                            <span className="inline-flex items-center gap-2 text-emerald-600 font-semibold">
                              <CheckCircle className="h-4 w-4" />
                              Perfect ({formatCurrency(0)})
                            </span>
                          ) : discrepancy < 0 ? (
                            <span className="inline-flex items-center gap-2 text-red-600 font-semibold">
                              <AlertCircle className="h-4 w-4" />
                              {formatSignedCurrency(discrepancy)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-blue-600 font-semibold">
                              <TrendingUp className="h-4 w-4" />
                              {formatSignedCurrency(discrepancy)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusStyles(
                              shift.status
                            )}`}
                          >
                            {shift.status === "open" ? "Open" : "Closed"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
