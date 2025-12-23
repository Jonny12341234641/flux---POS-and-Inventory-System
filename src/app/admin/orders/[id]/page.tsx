"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Printer,
  Calendar,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

interface Order {
  id: string;
  reference_number?: string;
  status: "pending" | "received" | "cancelled";
  created_at: string;
  supplier: {
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
  };
  items: OrderItem[];
}

type ParamsShape = { id?: string | string[] };
type ReactUse = <T,>(value: T) => T;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const formatStatus = (status: Order["status"]) =>
  `${status.charAt(0).toUpperCase()}${status.slice(1)}`;

const getStatusStyles = (status: Order["status"]) => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "received":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getFirstParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

const resolveParams = (value: ParamsShape | Promise<ParamsShape>) => {
  const reactUse = (React as unknown as { use?: ReactUse }).use;

  // Support Next.js versions that resolve params as promises.
  if (reactUse && typeof (value as Promise<ParamsShape>)?.then === "function") {
    return reactUse(value as Promise<ParamsShape>);
  }

  return value as ParamsShape;
};

const extractOrder = (data: unknown): Order | null => {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const candidate =
    (record.data as Order) ||
    (record.order as Order) ||
    (record.purchase_order as Order) ||
    (record.purchaseOrder as Order) ||
    (record as Order);

  if (!candidate || typeof candidate !== "object" || !candidate.id) {
    return null;
  }

  const items = Array.isArray(candidate.items) ? candidate.items : [];

  return {
    ...candidate,
    items: items.map((item) => ({
      ...item,
      total_cost:
        Number.isFinite(item.total_cost) && item.total_cost !== 0
          ? item.total_cost
          : Number.isFinite((item as { total?: number }).total ?? NaN)
          ? (item as { total?: number }).total ?? 0
          : (item.quantity ?? 0) * (item.unit_cost ?? 0),
    })),
  };
};

const resolveLineTotal = (item: OrderItem) => {
  const quantity = Number.isFinite(item.quantity) ? item.quantity : 0;
  const unitCost = Number.isFinite(item.unit_cost) ? item.unit_cost : 0;
  const computed = quantity * unitCost;

  if (Number.isFinite(item.total_cost) && item.total_cost !== 0) {
    return item.total_cost;
  }

  return computed;
};

export default function OrderDetailsPage() {
  const router = useRouter();
  const params = useParams() as ParamsShape | Promise<ParamsShape>;
  const resolvedParams = resolveParams(params);
  const orderId = getFirstParam(resolvedParams?.id);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<
    "receive" | "cancel" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async (signal?: AbortSignal) => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      setError("Order ID is missing.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load order details (status ${response.status}).`
        );
      }

      const data = await response.json();
      const loadedOrder = extractOrder(data);

      if (!loadedOrder) {
        throw new Error("Order details could not be found.");
      }

      setOrder(loadedOrder);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      setError(
        err instanceof Error ? err.message : "Failed to load order details."
      );
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchOrder(controller.signal);

    return () => controller.abort();
  }, [orderId]);

  const handleReceive = async () => {
    if (!order || order.status !== "pending") {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to receive this stock? Inventory levels will be updated."
    );

    if (!confirmed) {
      return;
    }

    setIsProcessing(true);
    setProcessingAction("receive");
    setError(null);

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "received" }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to receive order (status ${response.status}).`
        );
      }

      await fetchOrder();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to receive the order."
      );
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
    }
  };

  const handleCancel = async () => {
    if (!order || order.status !== "pending") {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to cancel this order? This action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setIsProcessing(true);
    setProcessingAction("cancel");
    setError(null);

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel order (status ${response.status}).`);
      }

      await fetchOrder();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to cancel the order."
      );
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
    }
  };

  const orderItems = order?.items ?? [];
  const grandTotal = orderItems.reduce(
    (sum, item) => sum + resolveLineTotal(item),
    0
  );
  const status = order?.status ?? "pending";
  const statusLabel = order ? formatStatus(status) : "Loading";
  const statusStyles = order
    ? getStatusStyles(status)
    : "bg-slate-100 text-slate-600";
  const supplierName = order?.supplier?.name ?? "Unknown supplier";
  const contactPerson = order?.supplier?.contact_person ?? "-";
  const supplierPhone = order?.supplier?.phone ?? "-";
  const supplierEmail = order?.supplier?.email ?? "-";
  const referenceNumber = order?.reference_number?.trim()
    ? order.reference_number
    : "-";
  const orderDate = order?.created_at ? formatDate(order.created_at) : "-";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/orders")}
            className="inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Order Details
            </h1>
            <p className="text-sm text-slate-500">
              Review purchase order details and update stock status.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusStyles}`}
          >
            {statusLabel}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">Loading order details...</p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!loading && !order && !error ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          No order details available.
        </div>
      ) : null}

      {order ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Supplier Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Name</span>
                  <span className="font-medium text-slate-900">
                    {supplierName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Contact Person</span>
                  <span className="font-medium text-slate-900">
                    {contactPerson}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Phone</span>
                  <span className="font-medium text-slate-900">
                    {supplierPhone}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Email</span>
                  <span className="font-medium text-slate-900">
                    {supplierEmail}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Order Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Order ID</span>
                  <span className="font-medium text-slate-900">
                    {order.id}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-slate-500">
                    <FileText className="h-4 w-4" />
                    Reference Number
                  </span>
                  <span className="font-medium text-slate-900">
                    {referenceNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 text-slate-500">
                    <Calendar className="h-4 w-4" />
                    Date
                  </span>
                  <span className="font-medium text-slate-900">
                    {orderDate}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3">Quantity</th>
                      <th className="px-4 py-3">Unit Cost</th>
                      <th className="px-4 py-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {orderItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-6 text-center text-sm text-slate-500"
                        >
                          No items found for this order.
                        </td>
                      </tr>
                    ) : (
                      orderItems.map((item, index) => {
                        const lineTotal = resolveLineTotal(item);

                        return (
                          <tr key={item.id}>
                            <td className="px-4 py-4 text-slate-500">
                              {index + 1}
                            </td>
                            <td className="px-4 py-4 font-semibold text-slate-900">
                              {item.product_name}
                            </td>
                            <td className="px-4 py-4 text-slate-700">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-4 text-slate-700">
                              {formatCurrency(item.unit_cost)}
                            </td>
                            <td className="px-4 py-4 text-right font-semibold text-slate-900">
                              {formatCurrency(lineTotal)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-slate-500">Grand Total</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {formatCurrency(grandTotal)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {order.status === "pending" ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                onClick={handleReceive}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <CheckCircle className="h-4 w-4" />
                {isProcessing && processingAction === "receive"
                  ? "Receiving..."
                  : "Receive Stock"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancel}
                disabled={isProcessing}
                className="inline-flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                {isProcessing && processingAction === "cancel"
                  ? "Cancelling..."
                  : "Cancel Order"}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
