"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Plus, Search } from "lucide-react";

import { Button } from "../../../components/ui/button";

interface Order {
  id: string;
  reference_number?: string;
  supplier: { name: string };
  total_amount: number;
  status: "pending" | "received" | "cancelled";
  created_at: string;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

const getStatusColor = (status: Order["status"]) => {
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

const formatStatus = (status: Order["status"]) =>
  `${status.charAt(0).toUpperCase()}${status.slice(1)}`;

const formatOrderNumber = (id: string) => {
  if (!id) {
    return "-";
  }

  return id.length > 6 ? id.slice(-6) : id;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString();
};

const extractOrders = (data: unknown): Order[] => {
  if (Array.isArray(data)) {
    return data as Order[];
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const list =
      (Array.isArray(record.data) && record.data) ||
      (Array.isArray(record.orders) && record.orders) ||
      (Array.isArray(record.purchase_orders) && record.purchase_orders);

    if (Array.isArray(list)) {
      return list as Order[];
    }
  }

  return [];
};

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadOrders = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/orders", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load purchase orders (status ${response.status}).`
          );
        }

        const data = await response.json();
        setOrders(extractOrders(data));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Failed to load orders."
        );
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    loadOrders();

    return () => controller.abort();
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredOrders = normalizedSearch
    ? orders.filter((order) => {
        const supplierName = order.supplier?.name ?? "";
        const reference = order.reference_number ?? "";
        const status = order.status ?? "";

        return (
          order.id.toLowerCase().includes(normalizedSearch) ||
          supplierName.toLowerCase().includes(normalizedSearch) ||
          reference.toLowerCase().includes(normalizedSearch) ||
          status.toLowerCase().includes(normalizedSearch)
        );
      })
    : orders;
  const emptyMessage =
    orders.length === 0
      ? "No orders found. Create your first order to get started."
      : "No orders match your search.";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Purchase Orders
          </h1>
          <p className="text-sm text-slate-500">
            Track supplier orders and inbound inventory costs.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search orders..."
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
          <Button asChild className="inline-flex items-center gap-2">
            <Link href="/admin/orders/create">
              <Plus className="h-4 w-4" />
              Create Order
            </Link>
          </Button>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">Loading purchase orders...</p>
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
              <th className="px-4 py-3">Order #</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
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
                  Loading orders...
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-sm text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const referenceLabel = order.reference_number?.trim()
                  ? order.reference_number
                  : "-";
                const supplierLabel = order.supplier?.name ?? "Unknown supplier";
                const totalAmount = Number.isFinite(order.total_amount)
                  ? order.total_amount
                  : 0;

                return (
                  <tr key={order.id}>
                    <td className="px-4 py-4 font-semibold text-slate-900">
                      {formatOrderNumber(order.id)}
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {referenceLabel}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {supplierLabel}
                    </td>
                    <td className="px-4 py-4 text-slate-500">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {formatCurrency(totalAmount)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {formatStatus(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="inline-flex items-center gap-2"
                        >
                          <Link href={`/admin/orders/${order.id}`}>
                            <Eye className="h-4 w-4" />
                            View Details
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
