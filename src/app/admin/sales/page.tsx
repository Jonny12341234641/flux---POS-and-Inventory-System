"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Eye, FileText, RefreshCw, Search } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import type { SaleWithDetails as Sale } from "../../../../types/index";

interface BadgeProps {
  className?: string;
  children: ReactNode;
}

const Badge = ({ className, children }: BadgeProps) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
      className ?? ""
    }`}
  >
    {children}
  </span>
);

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const paymentStyles: Record<
  Sale["payment_method"],
  { label: string; className: string }
> = {
  cash: { label: "Cash", className: "bg-emerald-100 text-emerald-700" },
  card: { label: "Card", className: "bg-blue-100 text-blue-700" },
  bank_transfer: {
    label: "Transfer",
    className: "bg-purple-100 text-purple-700",
  },
  split: { label: "Split", className: "bg-orange-100 text-orange-700" },
  loyalty: { label: "Loyalty", className: "bg-indigo-100 text-indigo-700" },
};

const extractSales = (data: unknown): Sale[] => {
  if (Array.isArray(data)) {
    return data as Sale[];
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const list =
      (Array.isArray(record.data) && record.data) ||
      (Array.isArray(record.sales) && record.sales) ||
      (Array.isArray(record.receipts) && record.receipts);

    if (Array.isArray(list)) {
      return list as Sale[];
    }
  }

  return [];
};

const sortByNewest = (sales: Sale[]) =>
  [...sales].sort((a, b) => {
    const first = new Date(a.created_at).getTime();
    const second = new Date(b.created_at).getTime();

    return (Number.isNaN(second) ? 0 : second) - (Number.isNaN(first) ? 0 : first);
  });

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadSales = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/sales", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load sales (status ${response.status}).`);
        }

        const data = await response.json();
        setSales(sortByNewest(extractSales(data)));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Failed to load sales records."
        );
        setSales([]);
      } finally {
        setLoading(false);
      }
    };

    loadSales();

    return () => controller.abort();
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredSales = normalizedSearch
    ? sales.filter((sale) =>
        sale.receipt_number.toLowerCase().includes(normalizedSearch)
      )
    : sales;
  const emptyMessage =
    sales.length === 0
      ? "No sales records found."
      : "No sales records match your search.";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <FileText className="h-5 w-5 text-slate-500" />
            Sales History
          </h1>
          <p className="text-sm text-slate-500">
            Review receipts, refunds, and cashier activity.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search Receipt #..."
              className="pl-9"
            />
          </div>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">Loading sales history...</p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Receipt #</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Cashier</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-sm text-slate-500"
                >
                  Loading sales...
                </td>
              </tr>
            ) : filteredSales.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-5 w-5 text-slate-400" />
                    <span>{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredSales.map((sale) => {
                const paymentStyle = paymentStyles[sale.payment_method];
                const isRefunded = sale.status === "refunded";
                const cashierName = sale.cashier?.full_name ?? "Unknown cashier";
                const receiptLabel =
                  sale.receipt_number?.trim() || sale.id || "-";
                const totalAmount = Number.isFinite(sale.grand_total)
                  ? sale.grand_total
                  : 0;

                return (
                  <tr key={sale.id}>
                    <td className="px-4 py-4 font-mono text-xs text-slate-700">
                      {receiptLabel}
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {formatDateTime(sale.created_at)}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {cashierName}
                    </td>
                    <td className="px-4 py-4">
                      <Badge className={paymentStyle.className}>
                        {paymentStyle.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      {isRefunded ? (
                        <Badge className="bg-red-100 text-red-700">
                          <RefreshCw className="h-3.5 w-3.5" />
                          REFUNDED
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Completed
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-4 ${
                        isRefunded
                          ? "text-slate-400 line-through"
                          : "text-slate-700"
                      }`}
                    >
                      {formatCurrency(totalAmount)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="inline-flex items-center gap-2"
                        >
                          <Link href={`/admin/sales/${sale.id}`}>
                            <Eye className="h-4 w-4" />
                            View
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
