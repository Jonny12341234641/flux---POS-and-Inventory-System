"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, CreditCard, User, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Sale {
  id: string;
  receipt_number: string;
  created_at: string;
  payment_method: string;
  total_amount: number;
  amount_paid: number;
  change_given: number;
  status: "completed" | "refunded";
  cashier: { name: string };
  items: SaleItem[];
}

type ParamsShape = { id?: string | string[] };
type ReactUse = <T,>(value: T) => T;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const formatPaymentMethod = (value?: string) => {
  if (!value) {
    return "-";
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
};

const getFirstParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

const resolveParams = (value: ParamsShape | Promise<ParamsShape>) => {
  const reactUse = (React as unknown as { use?: ReactUse }).use;

  if (reactUse && typeof (value as Promise<ParamsShape>)?.then === "function") {
    return reactUse(value as Promise<ParamsShape>);
  }

  return value as ParamsShape;
};

const extractSale = (data: unknown): Sale | null => {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const candidate =
    (record.data as Sale) ||
    (record.sale as Sale) ||
    (record.receipt as Sale) ||
    (record as Sale);

  if (!candidate || typeof candidate !== "object" || !candidate.id) {
    return null;
  }

  const items = Array.isArray(candidate.items) ? candidate.items : [];
  const cashier =
    candidate.cashier && typeof candidate.cashier === "object"
      ? (candidate.cashier as { name?: string })
      : null;

  return {
    ...candidate,
    cashier: { name: cashier?.name?.trim() || "Unknown cashier" },
    items: items.map((item) => ({
      ...item,
      total:
        Number.isFinite(item.total) && item.total !== 0
          ? item.total
          : (item.quantity ?? 0) * (item.unit_price ?? 0),
    })),
  };
};

const resolveLineTotal = (item: SaleItem) => {
  const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
  const unitPrice = Number.isFinite(item.unit_price) ? item.unit_price : 0;
  const computed = quantity * unitPrice;

  if (Number.isFinite(item.total) && item.total !== 0) {
    return item.total;
  }

  return computed;
};

const parseApiError = async (response: Response, fallback: string) => {
  try {
    const data = await response.json();
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      if (typeof record.error === "string" && record.error.trim()) {
        return record.error;
      }
    }
  } catch (error) {
    return fallback;
  }

  return fallback;
};

export default function SaleDetailsPage() {
  const router = useRouter();
  const params = useParams() as ParamsShape | Promise<ParamsShape>;
  const resolvedParams = resolveParams(params);
  const saleId = getFirstParam(resolvedParams?.id);

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSale = async (signal?: AbortSignal) => {
    if (!saleId) {
      setSale(null);
      setLoading(false);
      setError("Sale ID is missing.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/sales/${saleId}`, {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        const message = await parseApiError(
          response,
          `Failed to load sale details (status ${response.status}).`
        );
        throw new Error(message);
      }

      const data = await response.json();
      const loadedSale = extractSale(data);

      if (!loadedSale) {
        throw new Error("Sale details could not be found.");
      }

      setSale(loadedSale);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      setError(
        err instanceof Error ? err.message : "Failed to load sale details."
      );
      setSale(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchSale(controller.signal);

    return () => controller.abort();
  }, [saleId]);

  const handleRefund = async () => {
    if (!sale || sale.status !== "completed" || processing) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to refund this sale? Inventory will be restocked."
    );

    if (!confirmed) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/sales/${sale.id}`, {
        method: "POST",
      });

      if (!response.ok) {
        const message = await parseApiError(
          response,
          `Failed to refund sale (status ${response.status}).`
        );
        window.alert(message);
        throw new Error(message);
      }

      await fetchSale();
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to refund sale.";
      window.alert(message);
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  const items = sale?.items ?? [];
  const subtotal = items.reduce(
    (sum, item) => sum + resolveLineTotal(item),
    0
  );
  const totalAmountValue = sale?.total_amount ?? Number.NaN;
  const totalAmount = Number.isFinite(totalAmountValue)
    ? totalAmountValue
    : subtotal;
  const taxAmount = Math.max(0, totalAmount - subtotal);
  const amountPaidValue = sale?.amount_paid ?? Number.NaN;
  const amountPaid = Number.isFinite(amountPaidValue)
    ? amountPaidValue
    : totalAmount;
  const changeGivenValue = sale?.change_given ?? Number.NaN;
  const changeGiven = Number.isFinite(changeGivenValue)
    ? changeGivenValue
    : 0;
  const receiptNumber = sale?.receipt_number?.trim() || sale?.id || "-";
  const saleDate = sale?.created_at ? formatDateTime(sale.created_at) : "-";
  const cashierName = sale?.cashier?.name?.trim() || "Unknown cashier";
  const paymentMethod = formatPaymentMethod(sale?.payment_method);
  const isRefunded = sale?.status === "refunded";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/sales")}
          className="inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2"
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">Loading sale details...</p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!loading && !sale && !error ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          No sale details available.
        </div>
      ) : null}

      {sale ? (
        <Card className="mx-auto w-full max-w-lg border-slate-200 bg-white">
          <CardHeader className="relative space-y-2 border-b border-dashed border-slate-200 pb-6 pt-8 text-center">
            {isRefunded ? (
              <div className="absolute right-4 top-4 rotate-12 rounded border-2 border-red-500 px-4 py-1 text-sm font-bold uppercase tracking-widest text-red-600">
                Refunded
              </div>
            ) : null}
            <CardTitle className="text-xl font-semibold text-slate-900">
              {APP_NAME}
            </CardTitle>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Digital Receipt
            </p>
            <p className="text-xs text-slate-500">Receipt #{receiptNumber}</p>
            <p className="text-xs text-slate-500">{saleDate}</p>
          </CardHeader>

          <CardContent className="space-y-6 py-6">
            <div className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-slate-500">
                  <User className="h-4 w-4" />
                  Cashier
                </span>
                <span className="font-medium text-slate-900">
                  {cashierName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-slate-500">
                  <CreditCard className="h-4 w-4" />
                  Payment Method
                </span>
                <span className="font-medium text-slate-900">
                  {paymentMethod}
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-dashed border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-white text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-slate-200 bg-white">
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-6 text-center text-sm text-slate-500"
                      >
                        No items found for this sale.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => {
                      const lineTotal = resolveLineTotal(item);

                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {item.product_name}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(lineTotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-4 border-t border-dashed border-slate-200 pt-4">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-right text-slate-700">
                  {formatCurrency(subtotal)}
                </span>
                <span className="text-slate-500">Tax</span>
                <span className="text-right text-slate-700">
                  {formatCurrency(taxAmount)}
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  Grand Total
                </span>
                <span className="text-right text-base font-semibold text-slate-900">
                  {formatCurrency(totalAmount)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-slate-500">Cash Tendered</span>
                <span className="text-right text-slate-700">
                  {formatCurrency(amountPaid)}
                </span>
                <span className="text-slate-500">Change Due</span>
                <span className="text-right text-slate-700">
                  {formatCurrency(changeGiven)}
                </span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 border-t border-dashed border-slate-200 py-5 sm:flex-row sm:justify-end">
            {sale.status === "completed" ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleRefund}
                disabled={processing}
                className="inline-flex items-center gap-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    processing ? "animate-spin" : ""
                  }`}
                />
                {processing ? "Processing..." : "Process Refund"}
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      ) : null}
    </div>
  );
}
